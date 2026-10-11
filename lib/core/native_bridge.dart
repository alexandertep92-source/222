import 'dart:io';

import 'package:flutter/services.dart';

import 'vault_format.dart';

/// Encrypts and decrypts vault files.
///
/// Uses the native implementation on Android/iOS (hardware accelerated,
/// runs off the UI thread) and falls back to [DartVaultCipher] elsewhere.
class FileCrypto {
  FileCrypto({DartVaultCipher? fallback, bool useNative = true})
    : _fallback = fallback ?? DartVaultCipher(),
      _useNative = useNative && (Platform.isAndroid || Platform.isIOS);

  final DartVaultCipher _fallback;
  bool _useNative;

  DartVaultCipher get dart => _fallback;

  Future<T> _native<T>(
    String method,
    Map<String, Object?> args,
    Future<T> Function() fallback,
  ) async {
    if (!_useNative) return fallback();
    try {
      return await NativeBridge._channel.invokeMethod<T>(method, args) as T;
    } on MissingPluginException {
      _useNative = false;
      return fallback();
    } on PlatformException catch (e) {
      throw NativeBridge._mapError(e);
    }
  }

  /// [source] is a file path or (Android) a `content://` URI.
  /// Returns the number of plaintext bytes.
  Future<int> encryptFile(String source, String target, Uint8List key) {
    return _native<int>('encryptFile', {
      'source': source,
      'target': target,
      'key': key,
    }, () => _fallback.encryptFile(_toPath(source), target, key));
  }

  Future<void> decryptFile(String source, String target, Uint8List key) {
    return _native<void>('decryptFile', {
      'source': source,
      'target': target,
      'key': key,
    }, () => _fallback.decryptFile(source, target, key));
  }

  Future<Uint8List> decryptToBytes(String source, Uint8List key) {
    return _native<Uint8List>('decryptToBytes', {
      'source': source,
      'key': key,
    }, () => _fallback.decryptFileToBytes(source, key));
  }

  Future<void> encryptBytesToFile(Uint8List data, String target, Uint8List key) {
    return _native<void>('encryptBytes', {
      'data': data,
      'target': target,
      'key': key,
    }, () async => File(target).writeAsBytes(await _fallback.encryptBytes(data, key)));
  }

  static String _toPath(String source) =>
      source.startsWith('file://') ? Uri.parse(source).toFilePath() : source;
}

/// Small platform helpers implemented in MainActivity.kt / AppDelegate.swift.
abstract final class NativeBridge {
  static const MethodChannel _channel = MethodChannel('tresor/native');

  static Exception _mapError(PlatformException e) {
    switch (e.code) {
      case 'auth':
        return const VaultAuthenticationException();
      case 'format':
        return VaultFormatException(e.message ?? 'Datei ist beschädigt');
      default:
        return e;
    }
  }

  static Future<T?> _call<T>(String method, [Map<String, Object?>? args]) async {
    try {
      return await _channel.invokeMethod<T>(method, args);
    } on MissingPluginException {
      return null;
    } on PlatformException catch (e) {
      throw _mapError(e);
    }
  }

  /// Hides the app content in the recent apps screen and blocks screenshots.
  static Future<void> setSecure(bool secure) => _call<void>('setSecure', {'secure': secure});

  /// Opens a decrypted file in another app (Android) or in a preview (iOS).
  static Future<bool> openFile(String path, String mime) async =>
      await _call<bool>('openFile', {'path': path, 'mime': mime}) ?? false;

  /// Whether exporting into a user chosen folder is supported (Android).
  static bool get supportsFolderExport => Platform.isAndroid;

  /// Lets the user choose a folder (Android Storage Access Framework).
  /// Returns the tree URI or null if cancelled.
  static Future<String?> pickExportFolder() => _call<String>('pickExportFolder');

  /// Decrypts [files] straight into the folder chosen with
  /// [pickExportFolder]. Returns the number of exported files.
  static Future<int> exportToFolder({
    required String folder,
    required List<ExportFile> files,
    required Uint8List key,
  }) async {
    return await _call<int>('exportToFolder', {
          'folder': folder,
          'key': key,
          'files': [
            for (final f in files) {'source': f.source, 'name': f.name, 'mime': f.mime},
          ],
        }) ??
        0;
  }
}

class ExportFile {
  const ExportFile({required this.source, required this.name, required this.mime});

  final String source;
  final String name;
  final String mime;
}
