import 'dart:io';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:mime/mime.dart';
import 'package:photo_manager/photo_manager.dart';
import 'package:share_plus/share_plus.dart';

import '../core/native_bridge.dart';
import '../core/session.dart';
import '../core/vault.dart';
import 'gallery_picker.dart';
import 'vault_thumbnail.dart';

class _Progress {
  const _Progress(this.done, this.total, this.label);

  final int done;
  final int total;
  final String label;
}

/// Import into and export out of the vault, with progress dialogs.
class Transfers {
  Transfers(this.context, this.session);

  final BuildContext context;
  final Session session;

  Vault get _vault => session.vault;

  void _snack(String text) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text)));
  }

  /// Runs [task] while showing a non-dismissable progress dialog.
  Future<T> _withProgress<T>(
    String title,
    int total,
    Future<T> Function(void Function(int done, String label) report) task,
  ) async {
    final progress = ValueNotifier(_Progress(0, total, ''));
    final navigator = Navigator.of(context, rootNavigator: true);
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      useRootNavigator: true,
      builder: (context) => PopScope(
        canPop: false,
        child: AlertDialog(
          title: Text(title),
          content: ValueListenableBuilder(
            valueListenable: progress,
            builder: (context, p, _) => Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LinearProgressIndicator(value: p.total > 1 ? p.done / p.total : null),
                const SizedBox(height: 12),
                if (p.total > 1) Text('${p.done} von ${p.total}'),
                if (p.label.isNotEmpty)
                  Text(
                    p.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
    try {
      return await session.busy(
        () => task((done, label) => progress.value = _Progress(done, total, label)),
      );
    } finally {
      navigator.pop();
      progress.dispose();
    }
  }

  // ---------------------------------------------------------------- import

  Future<void> importInto(VaultCategory category) async {
    if (category == VaultCategory.documents) {
      return _importFiles(category);
    }
    final fromGallery = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
              child: Text(
                '${category.label} importieren',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Aus der Galerie'),
              subtitle: const Text('Originale können danach aus der Galerie entfernt werden'),
              onTap: () => Navigator.pop(context, true),
            ),
            ListTile(
              leading: const Icon(Icons.folder_open_outlined),
              title: const Text('Aus Dateien'),
              subtitle: const Text('Downloads, Speicherkarte, Cloud …'),
              onTap: () => Navigator.pop(context, false),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (fromGallery == null || !context.mounted) return;
    if (fromGallery) {
      await _importFromGallery(category);
    } else {
      await _importFiles(category);
    }
  }

  Future<void> _importFromGallery(VaultCategory category) async {
    final result = await Navigator.of(context).push<GalleryPickResult>(
      MaterialPageRoute(
        builder: (_) => GalleryPickerScreen(
          session: session,
          videos: category == VaultCategory.videos,
          deleteOriginals: session.settings.deleteOriginals,
        ),
      ),
    );
    if (result == null || result.assets.isEmpty || !context.mounted) return;
    if (result.deleteOriginals != session.settings.deleteOriginals) {
      await session.updateSettings((s) => s.deleteOriginals = result.deleteOriginals);
    }

    final imported = <AssetEntity>[];
    final failed = <String>[];
    await _withProgress('Wird verschlüsselt …', result.assets.length, (report) async {
      for (final (i, asset) in result.assets.indexed) {
        var name = 'Datei ${i + 1}';
        try {
          name = await asset.titleAsync;
          report(i, name);
          final file = Platform.isIOS ? await asset.file : await asset.originFile;
          if (file == null) throw const FileSystemException('Datei nicht verfügbar');
          final isVideo = asset.type == AssetType.video;
          if (name.isEmpty) name = '${isVideo ? 'VID' : 'IMG'}_${asset.id.hashCode}';
          final mime =
              await asset.mimeTypeAsync ??
              lookupMimeType(file.path) ??
              (isVideo ? 'video/mp4' : 'image/jpeg');
          final thumbnail = await asset.thumbnailDataWithSize(
            const ThumbnailSize.square(360),
            quality: 85,
          );
          final item = await _vault.add(
            source: file.path,
            name: _withExtension(name, file.path),
            mime: mime,
            category: category,
            thumbnail: thumbnail,
            durationMs: isVideo ? asset.duration * 1000 : null,
            takenAt: asset.createDateTime,
          );
          // Only remove the original if the copy in the vault is complete.
          if (item.size == await file.length()) imported.add(asset);
        } catch (_) {
          failed.add(name);
        }
      }
      report(result.assets.length, '');
    });
    await PhotoManager.clearFileCache();

    var deleted = 0;
    if (result.deleteOriginals && imported.isNotEmpty) {
      try {
        final ids = await session.external(
          () => PhotoManager.editor.deleteWithIds([for (final a in imported) a.id]),
        );
        deleted = ids.length;
      } catch (_) {
        deleted = 0;
      }
    }

    final stored = result.assets.length - failed.length;
    final parts = <String>['$stored ${stored == 1 ? category.singular : category.label} im Tresor'];
    if (result.deleteOriginals) {
      parts.add(
        deleted == imported.length
            ? 'aus der Galerie gelöscht'
            : '$deleted von ${imported.length} aus der Galerie gelöscht',
      );
    }
    if (failed.isNotEmpty) parts.add('${failed.length} fehlgeschlagen');
    _snack(parts.join(' · '));
  }

  /// Keeps the real file extension (e.g. HEIC/MOV) in the stored name.
  static String _withExtension(String name, String path) {
    final dot = path.lastIndexOf('.');
    if (dot < 0 || name.contains('.')) return name;
    return '$name${path.substring(dot)}';
  }

  Future<void> _importFiles(VaultCategory category) async {
    final type = switch (category) {
      VaultCategory.photos => FileType.image,
      VaultCategory.videos => FileType.video,
      VaultCategory.documents => FileType.any,
    };
    List<PlatformFile> files;
    try {
      files = await session.external(() => FilePicker.pickFiles(type: type));
    } catch (e) {
      _snack('Dateiauswahl fehlgeschlagen: $e');
      return;
    }
    if (files.isEmpty || !context.mounted) return;

    var ok = 0;
    final failed = <String>[];
    await _withProgress('Wird verschlüsselt …', files.length, (report) async {
      for (final (i, file) in files.indexed) {
        report(i, file.name);
        try {
          final mime = lookupMimeType(file.name) ?? 'application/octet-stream';
          Uint8List? thumbnail;
          if (mime.startsWith('image/') && ((await file.length()) ?? 0) < 40 << 20) {
            thumbnail = await makeImageThumbnail(await file.readAsBytes());
          }
          await _vault.add(
            source: file.path ?? file.uri.toString(),
            name: file.name,
            mime: mime,
            category: category,
            thumbnail: thumbnail,
          );
          ok++;
        } catch (_) {
          failed.add(file.name);
        }
      }
      report(files.length, '');
    });
    try {
      await FilePicker.clearTemporaryFiles();
    } catch (_) {
      // Not supported on every platform.
    }
    _snack(
      failed.isEmpty
          ? '$ok ${ok == 1 ? 'Datei' : 'Dateien'} im Tresor'
          : '$ok im Tresor · ${failed.length} fehlgeschlagen',
    );
  }

  // ---------------------------------------------------------------- export

  Future<bool> export(List<VaultItem> items) async {
    if (items.isEmpty) return false;
    final media = items.every((i) => i.isImage || i.isVideo);
    var removeAfter = false;
    final choice = await showModalBottomSheet<_ExportTarget>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
                child: Text(
                  items.length == 1
                      ? '„${items.first.name}“ exportieren'
                      : '${items.length} Dateien exportieren',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              if (media)
                ListTile(
                  leading: const Icon(Icons.photo_library_outlined),
                  title: const Text('In der Galerie speichern'),
                  subtitle: const Text('Wieder sichtbar in der normalen Galerie'),
                  onTap: () => Navigator.pop(context, _ExportTarget.gallery),
                ),
              if (NativeBridge.supportsFolderExport)
                ListTile(
                  leading: const Icon(Icons.drive_folder_upload_outlined),
                  title: const Text('In einem Ordner speichern'),
                  subtitle: const Text('z. B. Downloads oder SD-Karte'),
                  onTap: () => Navigator.pop(context, _ExportTarget.folder),
                ),
              ListTile(
                leading: const Icon(Icons.share_outlined),
                title: Text(
                  Platform.isIOS ? 'Teilen / In „Dateien“ sichern' : 'Teilen / An App senden',
                ),
                onTap: () => Navigator.pop(context, _ExportTarget.share),
              ),
              const Divider(),
              SwitchListTile(
                value: removeAfter,
                onChanged: (v) => setSheetState(() => removeAfter = v),
                title: const Text('Danach aus dem Tresor entfernen'),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
    if (choice == null || !context.mounted) return false;

    final bool done;
    switch (choice) {
      case _ExportTarget.gallery:
        done = await _exportToGallery(items);
      case _ExportTarget.folder:
        done = await _exportToFolder(items);
      case _ExportTarget.share:
        done = await _share(items);
    }
    if (done && removeAfter) {
      await _vault.remove(items);
      _snack('Aus dem Tresor entfernt');
    }
    return done;
  }

  Future<bool> _exportToGallery(List<VaultItem> items) async {
    final permission = await session.external(
      () => PhotoManager.requestPermissionExtend(
        requestOption: const PermissionRequestOption(iosAccessLevel: IosAccessLevel.addOnly),
      ),
    );
    if (Platform.isIOS && !permission.hasAccess) {
      _snack('Kein Zugriff auf die Galerie. Bitte in den Einstellungen erlauben.');
      return false;
    }
    var ok = 0;
    await _withProgress('Wird in der Galerie gespeichert …', items.length, (report) async {
      for (final (i, item) in items.indexed) {
        report(i, item.name);
        File? temp;
        try {
          temp = await _vault.decryptToTemp(item);
          if (item.isVideo) {
            await PhotoManager.editor.saveVideo(temp, title: item.name);
          } else {
            await PhotoManager.editor.saveImageWithPath(temp.path, title: item.name);
          }
          ok++;
        } catch (_) {
          // Counted below.
        } finally {
          try {
            await temp?.parent.delete(recursive: true);
          } on FileSystemException {
            // Already removed.
          }
        }
      }
    });
    _snack(
      ok == items.length
          ? '$ok ${ok == 1 ? 'Datei' : 'Dateien'} in der Galerie gespeichert'
          : '$ok von ${items.length} gespeichert',
    );
    return ok == items.length;
  }

  Future<bool> _exportToFolder(List<VaultItem> items) async {
    final String? folder;
    try {
      folder = await session.external(NativeBridge.pickExportFolder);
    } catch (e) {
      _snack('Ordner konnte nicht geöffnet werden: $e');
      return false;
    }
    if (folder == null || !context.mounted) return false;
    var ok = 0;
    await _withProgress('Wird exportiert …', items.length, (report) async {
      for (final (i, item) in items.indexed) {
        report(i, item.name);
        try {
          ok += await NativeBridge.exportToFolder(
            folder: folder!,
            key: _vault.key,
            files: [
              ExportFile(
                source: _vault.filePath(item),
                name: Vault.safeFileName(item.name),
                mime: item.mime,
              ),
            ],
          );
        } catch (_) {
          // Counted below.
        }
      }
    });
    _snack(
      ok == items.length
          ? '$ok ${ok == 1 ? 'Datei' : 'Dateien'} exportiert'
          : '$ok von ${items.length} exportiert',
    );
    return ok == items.length;
  }

  Future<bool> _share(List<VaultItem> items) async {
    final files = <XFile>[];
    try {
      await _withProgress('Wird vorbereitet …', items.length, (report) async {
        for (final (i, item) in items.indexed) {
          report(i, item.name);
          final temp = await _vault.decryptToTemp(item);
          files.add(XFile(temp.path, mimeType: item.mime, name: item.name));
        }
      });
    } catch (e) {
      _snack('Export fehlgeschlagen: $e');
      return false;
    }
    if (!context.mounted) return false;
    final box = context.findRenderObject() as RenderBox?;
    final result = await session.external(
      () => SharePlus.instance.share(
        ShareParams(
          files: files,
          sharePositionOrigin: box == null ? null : box.localToGlobal(Offset.zero) & box.size,
        ),
      ),
    );
    return result.status == ShareResultStatus.success;
  }

  // ---------------------------------------------------------------- other

  Future<bool> confirmDelete(List<VaultItem> items) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(items.length == 1 ? 'Datei löschen?' : '${items.length} Dateien löschen?'),
        content: const Text(
          'Die Dateien werden endgültig aus dem Tresor gelöscht und können nicht '
          'wiederhergestellt werden. Exportiere sie vorher, wenn du sie behalten möchtest.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Abbrechen'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
              foregroundColor: Theme.of(context).colorScheme.onError,
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Löschen'),
          ),
        ],
      ),
    );
    if (ok != true) return false;
    await _vault.remove(items);
    _snack(items.length == 1 ? 'Gelöscht' : '${items.length} Dateien gelöscht');
    return true;
  }

  /// Opens a document with another app (Android) or the system preview (iOS).
  Future<void> openExternally(VaultItem item) async {
    File temp;
    try {
      temp = await _withProgress('Wird geöffnet …', 1, (_) => _vault.decryptToTemp(item));
    } catch (e) {
      _snack('Datei konnte nicht entschlüsselt werden.');
      return;
    }
    final opened = await session.external(() => NativeBridge.openFile(temp.path, item.mime));
    if (!opened) {
      _snack(
        'Keine App zum Öffnen dieser Datei gefunden. Du kannst sie über „Exportieren“ teilen.',
      );
    }
  }
}

enum _ExportTarget { gallery, folder, share }
