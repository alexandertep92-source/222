import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:tresor_browser/core/key_manager.dart';
import 'package:tresor_browser/core/native_bridge.dart';
import 'package:tresor_browser/core/vault.dart';
import 'package:tresor_browser/core/vault_format.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory dir;
  setUp(() async => dir = await Directory.systemTemp.createTemp('vault_test'));
  tearDown(() => dir.delete(recursive: true));

  Uint8List key() => Uint8List.fromList(List.generate(32, (i) => i));
  final crypto = FileCrypto(useNative: false);

  Future<Vault> open(Uint8List key) => Vault.open(
    root: Directory('${dir.path}/vault'),
    key: key,
    crypto: crypto,
    tempRoot: Directory('${dir.path}/tmp'),
  );

  test('items survive reopening and stay encrypted on disk', () async {
    final clear = Uint8List.fromList(List.generate(5000, (i) => i % 251));
    final source = File('${dir.path}/photo.jpg')..writeAsBytesSync(clear);

    final vault = await open(key());
    final item = await vault.add(
      source: source.path,
      name: 'photo.jpg',
      mime: 'image/jpeg',
      category: VaultCategory.photos,
      thumbnail: Uint8List.fromList([1, 2, 3]),
    );
    expect(item.size, clear.length);
    expect(vault.itemsOf(VaultCategory.photos), hasLength(1));
    expect(vault.itemsOf(VaultCategory.videos), isEmpty);

    final stored = File(vault.filePath(item)).readAsBytesSync();
    expect(stored.sublist(0, 4), VaultFormat.magic);
    expect(
      String.fromCharCodes(stored).contains(String.fromCharCodes(clear.sublist(0, 64))),
      isFalse,
    );
    final index = File('${dir.path}/vault/index.trv').readAsStringSync(encoding: latin1);
    expect(index.contains('photo.jpg'), isFalse);

    final reopened = await open(key());
    final again = reopened.itemsOf(VaultCategory.photos).single;
    expect(again.name, 'photo.jpg');
    expect(await reopened.readBytes(again), clear);
    expect(await reopened.thumbnail(again), [1, 2, 3]);
    final temp = await reopened.decryptToTemp(again);
    expect(temp.readAsBytesSync(), clear);

    await reopened.rename(again, 'urlaub.jpg');
    await reopened.remove([reopened.allItems.single]);
    expect(reopened.allItems, isEmpty);
    expect(Directory('${dir.path}/vault/files').listSync(), isEmpty);
    expect((await open(key())).allItems, isEmpty);
  });

  test('index does not open with another key', () async {
    final source = File('${dir.path}/a.txt')..writeAsStringSync('hallo');
    final vault = await open(key());
    await vault.add(
      source: source.path,
      name: 'a.txt',
      mime: 'text/plain',
      category: VaultCategory.documents,
    );
    final other = Uint8List.fromList(List.filled(32, 9));
    expect(() => open(other), throwsA(isA<VaultAuthenticationException>()));
  });

  test('a failed import leaves no files behind', () async {
    final vault = await open(key());
    await expectLater(
      vault.add(
        source: '${dir.path}/missing.jpg',
        name: 'missing.jpg',
        mime: 'image/jpeg',
        category: VaultCategory.photos,
      ),
      throwsA(isA<FileSystemException>()),
    );
    expect(vault.allItems, isEmpty);
    expect(Directory('${dir.path}/vault/files').listSync(), isEmpty);
  });

  group('KeyManager', () {
    test('PIN unlocks the same master key; wrong PIN does not', () async {
      final keys = KeyManager(dir, iterations: 1000);
      expect(await keys.isSetUp, isFalse);
      final master = await keys.create('482916');
      expect(master, hasLength(32));
      expect(await keys.isSetUp, isTrue);
      expect(await keys.unlock('482916'), master);
      expect(await keys.unlock('482917'), isNull);
      expect(File('${dir.path}/keys.json').readAsStringSync().contains('482916'), isFalse);
    });

    test('changing the PIN keeps the master key', () async {
      final keys = KeyManager(dir, iterations: 1000);
      final master = await keys.create('1357');
      expect(await keys.changePin('0000', '97531'), isFalse);
      expect(await keys.changePin('1357', '97531'), isTrue);
      expect(await keys.unlock('1357'), isNull);
      expect(await keys.unlock('97531'), master);
    });

    test('PBKDF2 matches a known vector', () async {
      // RFC 7914 section 11 (PBKDF2-HMAC-SHA256, c = 1, dkLen = 64), first 32 bytes.
      final key = await derivePinKey('passwd', 'salt'.codeUnits, 1);
      expect(
        key.map((b) => b.toRadixString(16).padLeft(2, '0')).join(),
        '55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc',
      );
    });
  });

  test('random keys differ', () async {
    final keys = KeyManager(dir, iterations: 1000);
    final a = await keys.create('1234');
    final b = await keys.create('1234');
    expect(a, isNot(b));
  });
}
