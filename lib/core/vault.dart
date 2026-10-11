import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;

import 'native_bridge.dart';

enum VaultCategory {
  photos('fotos', 'Fotos', 'Foto'),
  videos('videos', 'Videos', 'Video'),
  documents('dokumente', 'Dokumente', 'Dokument');

  const VaultCategory(this.slug, this.label, this.singular);

  /// Shown in the address bar, e.g. `tresor://fotos`.
  final String slug;
  final String label;
  final String singular;
}

@immutable
class VaultItem {
  const VaultItem({
    required this.id,
    required this.category,
    required this.name,
    required this.mime,
    required this.size,
    required this.addedAt,
    this.takenAt,
    this.hasThumbnail = false,
    this.durationMs,
  });

  factory VaultItem.fromJson(Map<String, Object?> json) {
    return VaultItem(
      id: json['id']! as String,
      category: VaultCategory.values.byName(json['category']! as String),
      name: json['name']! as String,
      mime: json['mime']! as String,
      size: json['size']! as int,
      addedAt: DateTime.fromMillisecondsSinceEpoch(json['addedAt']! as int),
      takenAt: json['takenAt'] == null
          ? null
          : DateTime.fromMillisecondsSinceEpoch(json['takenAt']! as int),
      hasThumbnail: json['thumb'] as bool? ?? false,
      durationMs: json['durationMs'] as int?,
    );
  }

  final String id;
  final VaultCategory category;
  final String name;
  final String mime;
  final int size;
  final DateTime addedAt;
  final DateTime? takenAt;
  final bool hasThumbnail;
  final int? durationMs;

  bool get isImage => mime.startsWith('image/');
  bool get isVideo => mime.startsWith('video/');

  bool get isText =>
      mime.startsWith('text/') || const {'application/json', 'application/xml'}.contains(mime);

  String get extension {
    final ext = p.extension(name);
    return ext.isEmpty ? '' : ext.substring(1).toLowerCase();
  }

  Map<String, Object?> toJson() => {
    'id': id,
    'category': category.name,
    'name': name,
    'mime': mime,
    'size': size,
    'addedAt': addedAt.millisecondsSinceEpoch,
    if (takenAt != null) 'takenAt': takenAt!.millisecondsSinceEpoch,
    if (hasThumbnail) 'thumb': true,
    if (durationMs != null) 'durationMs': durationMs,
  };
}

/// The unlocked vault: an encrypted index plus one encrypted file per item.
///
/// ```text
/// <root>/index.trv       encrypted JSON list of all items
/// <root>/files/<id>.trv  encrypted file content
/// <root>/thumbs/<id>.trv encrypted preview image
/// ```
///
/// Everything lives in the app's private storage, so the system gallery and
/// other apps never see these files.
class Vault extends ChangeNotifier {
  Vault._(this.root, this._key, this._crypto, this._tempRoot);

  static Future<Vault> open({
    required Directory root,
    required Uint8List key,
    required FileCrypto crypto,
    required Directory tempRoot,
  }) async {
    final vault = Vault._(root, key, crypto, tempRoot);
    await vault._filesDir.create(recursive: true);
    await vault._thumbsDir.create(recursive: true);
    await vault._load();
    return vault;
  }

  final Directory root;
  final Directory _tempRoot;
  final FileCrypto _crypto;
  Uint8List _key;
  final List<VaultItem> _items = [];
  final _thumbCache = <String, Uint8List>{};
  static const _thumbCacheSize = 300;

  Directory get _filesDir => Directory(p.join(root.path, 'files'));
  Directory get _thumbsDir => Directory(p.join(root.path, 'thumbs'));
  File get _indexFile => File(p.join(root.path, 'index.trv'));

  Uint8List get key => _key;

  List<VaultItem> get allItems => List.unmodifiable(_items);

  List<VaultItem> itemsOf(VaultCategory category) {
    final list = _items.where((i) => i.category == category).toList()
      ..sort((a, b) => b.addedAt.compareTo(a.addedAt));
    return list;
  }

  List<VaultItem> recent(int count) {
    final list = [..._items]..sort((a, b) => b.addedAt.compareTo(a.addedAt));
    return list.take(count).toList();
  }

  int countOf(VaultCategory category) => _items.where((i) => i.category == category).length;

  int get totalBytes => _items.fold(0, (sum, i) => sum + i.size);

  String filePath(VaultItem item) => p.join(_filesDir.path, '${item.id}.trv');
  String _thumbPath(String id) => p.join(_thumbsDir.path, '$id.trv');

  Future<void> _load() async {
    _items.clear();
    if (!await _indexFile.exists()) return;
    final clear = await _crypto.decryptToBytes(_indexFile.path, _key);
    final json = jsonDecode(utf8.decode(clear)) as Map<String, Object?>;
    for (final entry in json['items']! as List<Object?>) {
      _items.add(VaultItem.fromJson(entry! as Map<String, Object?>));
    }
  }

  Future<void> _saveIndex() async {
    final json = jsonEncode({
      'version': 1,
      'items': [for (final i in _items) i.toJson()],
    });
    final encrypted = await _crypto.dart.encryptBytes(utf8.encode(json), _key);
    final tmp = File('${_indexFile.path}.tmp');
    await tmp.writeAsBytes(encrypted, flush: true);
    await tmp.rename(_indexFile.path);
  }

  static String _newId() {
    final random = Random.secure();
    return List.generate(16, (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
  }

  /// Encrypts [source] (a path or a `content://` URI) into the vault.
  Future<VaultItem> add({
    required String source,
    required String name,
    required String mime,
    required VaultCategory category,
    Uint8List? thumbnail,
    int? durationMs,
    DateTime? takenAt,
  }) async {
    final id = _newId();
    final target = p.join(_filesDir.path, '$id.trv');
    final partial = File('$target.part');
    try {
      final size = await _crypto.encryptFile(source, partial.path, _key);
      await partial.rename(target);
      var hasThumb = false;
      if (thumbnail != null && thumbnail.isNotEmpty) {
        await _crypto.encryptBytesToFile(thumbnail, _thumbPath(id), _key);
        _cacheThumb(id, thumbnail);
        hasThumb = true;
      }
      final item = VaultItem(
        id: id,
        category: category,
        name: name,
        mime: mime,
        size: size,
        addedAt: DateTime.now(),
        takenAt: takenAt,
        hasThumbnail: hasThumb,
        durationMs: durationMs,
      );
      _items.add(item);
      await _saveIndex();
      notifyListeners();
      return item;
    } catch (_) {
      for (final path in [partial.path, target, _thumbPath(id)]) {
        final f = File(path);
        if (await f.exists()) await f.delete();
      }
      rethrow;
    }
  }

  Future<void> remove(Iterable<VaultItem> items) async {
    final ids = items.map((i) => i.id).toSet();
    if (ids.isEmpty) return;
    _items.removeWhere((i) => ids.contains(i.id));
    await _saveIndex();
    for (final id in ids) {
      _thumbCache.remove(id);
      for (final path in [p.join(_filesDir.path, '$id.trv'), _thumbPath(id)]) {
        final f = File(path);
        if (await f.exists()) await f.delete();
      }
    }
    notifyListeners();
  }

  Future<void> rename(VaultItem item, String newName) async {
    final index = _items.indexWhere((i) => i.id == item.id);
    if (index < 0) return;
    _items[index] = VaultItem(
      id: item.id,
      category: item.category,
      name: newName,
      mime: item.mime,
      size: item.size,
      addedAt: item.addedAt,
      takenAt: item.takenAt,
      hasThumbnail: item.hasThumbnail,
      durationMs: item.durationMs,
    );
    await _saveIndex();
    notifyListeners();
  }

  void _cacheThumb(String id, Uint8List bytes) {
    _thumbCache.remove(id);
    _thumbCache[id] = bytes;
    while (_thumbCache.length > _thumbCacheSize) {
      _thumbCache.remove(_thumbCache.keys.first);
    }
  }

  Uint8List? cachedThumbnail(VaultItem item) => _thumbCache[item.id];

  Future<Uint8List?> thumbnail(VaultItem item) async {
    if (!item.hasThumbnail) return null;
    final cached = _thumbCache[item.id];
    if (cached != null) return cached;
    final bytes = await _crypto.decryptToBytes(_thumbPath(item.id), _key);
    _cacheThumb(item.id, bytes);
    return bytes;
  }

  Future<Uint8List> readBytes(VaultItem item) => _crypto.decryptToBytes(filePath(item), _key);

  /// Decrypts [item] into the app's private temp folder. The copy is removed
  /// when the vault locks or the app starts again.
  Future<File> decryptToTemp(VaultItem item) async {
    final dir = Directory(p.join(_tempRoot.path, item.id));
    await dir.create(recursive: true);
    final target = File(p.join(dir.path, safeFileName(item.name)));
    if (!await target.exists()) {
      await _crypto.decryptFile(filePath(item), '${target.path}.part', _key);
      await File('${target.path}.part').rename(target.path);
    }
    return target;
  }

  static String safeFileName(String name) {
    final cleaned = name.replaceAll(RegExp(r'[\\/:*?"<>|\x00-\x1F]'), '_').trim();
    return cleaned.isEmpty ? 'datei' : cleaned;
  }

  /// Forgets the key and cached previews. The object must not be used after.
  void close() {
    _key.fillRange(0, _key.length, 0);
    _key = Uint8List(0);
    _thumbCache.clear();
    _items.clear();
  }
}
