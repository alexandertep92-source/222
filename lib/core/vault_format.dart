import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';

/// Layout of every encrypted file in the vault ("TRV1").
///
/// ```text
/// header  16 bytes  "TRV1" | chunk size (uint32 BE) | nonce prefix (7) | reserved (1)
/// chunk*            AES-256-GCM ciphertext of <= chunk size bytes | 16 byte tag
/// ```
///
/// Each chunk uses the nonce `prefix (7) | last flag (1) | index (uint32 BE)`,
/// so chunks cannot be reordered, dropped or cut off without the
/// authentication failing. The native implementations
/// (android/.../VaultCrypto.java, ios/Runner/VaultCrypto.swift) read and write
/// exactly the same layout.
abstract final class VaultFormat {
  static const List<int> magic = [0x54, 0x52, 0x56, 0x31];
  static const int headerLength = 16;
  static const int tagLength = 16;
  static const int prefixLength = 7;
  static const int defaultChunkSize = 1 << 20;
  static const int minChunkSize = 1 << 10;
  static const int maxChunkSize = 1 << 24;

  static Uint8List header(List<int> prefix, int chunkSize) {
    final header = Uint8List(headerLength);
    header.setRange(0, 4, magic);
    ByteData.sublistView(header).setUint32(4, chunkSize);
    header.setRange(8, 8 + prefixLength, prefix);
    return header;
  }

  static Uint8List nonce(List<int> prefix, int index, bool last) {
    final nonce = Uint8List(12);
    nonce.setRange(0, prefixLength, prefix);
    nonce[prefixLength] = last ? 1 : 0;
    ByteData.sublistView(nonce).setUint32(8, index);
    return nonce;
  }

  /// Returns `(chunkSize, prefix)` or throws [VaultFormatException].
  static (int, Uint8List) parseHeader(List<int> header) {
    if (header.length < headerLength) {
      throw const VaultFormatException('Datei ist zu kurz');
    }
    for (var i = 0; i < magic.length; i++) {
      if (header[i] != magic[i]) {
        throw const VaultFormatException('Unbekanntes Dateiformat');
      }
    }
    final chunkSize = ByteData.sublistView(Uint8List.fromList(header.sublist(4, 8))).getUint32(0);
    if (chunkSize < minChunkSize || chunkSize > maxChunkSize) {
      throw const VaultFormatException('Ungültige Blockgröße');
    }
    return (chunkSize, Uint8List.fromList(header.sublist(8, 8 + prefixLength)));
  }
}

class VaultFormatException implements Exception {
  const VaultFormatException(this.message);

  final String message;

  @override
  String toString() => 'VaultFormatException: $message';
}

/// Thrown when a file does not decrypt with the given key (wrong key or
/// modified data).
class VaultAuthenticationException implements Exception {
  const VaultAuthenticationException();

  @override
  String toString() => 'VaultAuthenticationException';
}

/// Pure Dart implementation of the vault format.
///
/// Used for small data (index, key file) and as a fallback where the native
/// implementation is not available (tests, desktop).
class DartVaultCipher {
  DartVaultCipher({Random? random, this.chunkSize = VaultFormat.defaultChunkSize})
    : _random = random ?? Random.secure();

  final Random _random;
  final int chunkSize;
  final AesGcm _aes = AesGcm.with256bits();

  Uint8List _randomBytes(int length) =>
      Uint8List.fromList(List<int>.generate(length, (_) => _random.nextInt(256)));

  Future<List<int>> _sealChunk(
    List<int> clear,
    SecretKey key,
    List<int> prefix,
    int index,
    bool last,
  ) async {
    final box = await _aes.encrypt(
      clear,
      secretKey: key,
      nonce: VaultFormat.nonce(prefix, index, last),
    );
    return [...box.cipherText, ...box.mac.bytes];
  }

  Future<List<int>> _openChunk(
    Uint8List sealed,
    SecretKey key,
    List<int> prefix,
    int index,
    bool last,
  ) async {
    if (sealed.length < VaultFormat.tagLength) {
      throw const VaultFormatException('Datei ist beschädigt');
    }
    final split = sealed.length - VaultFormat.tagLength;
    final box = SecretBox(
      Uint8List.sublistView(sealed, 0, split),
      nonce: VaultFormat.nonce(prefix, index, last),
      mac: Mac(Uint8List.sublistView(sealed, split)),
    );
    try {
      return await _aes.decrypt(box, secretKey: key);
    } on SecretBoxAuthenticationError {
      throw const VaultAuthenticationException();
    }
  }

  Future<Uint8List> encryptBytes(List<int> clear, List<int> key) async {
    final secretKey = SecretKey(key);
    final prefix = _randomBytes(VaultFormat.prefixLength);
    final out = BytesBuilder(copy: false)..add(VaultFormat.header(prefix, chunkSize));
    var offset = 0;
    var index = 0;
    while (true) {
      final end = min(offset + chunkSize, clear.length);
      final last = end >= clear.length;
      out.add(await _sealChunk(clear.sublist(offset, end), secretKey, prefix, index, last));
      if (last) break;
      offset = end;
      index++;
    }
    return out.takeBytes();
  }

  Future<Uint8List> decryptBytes(Uint8List data, List<int> key) async {
    final (chunkSize, prefix) = VaultFormat.parseHeader(data);
    final secretKey = SecretKey(key);
    final sealedChunk = chunkSize + VaultFormat.tagLength;
    final out = BytesBuilder(copy: false);
    var offset = VaultFormat.headerLength;
    var index = 0;
    while (true) {
      final remaining = data.length - offset;
      final last = remaining <= sealedChunk;
      final length = last ? remaining : sealedChunk;
      out.add(
        await _openChunk(
          Uint8List.sublistView(data, offset, offset + length),
          secretKey,
          prefix,
          index,
          last,
        ),
      );
      if (last) break;
      offset += length;
      index++;
    }
    return out.takeBytes();
  }

  Future<int> encryptFile(String source, String target, List<int> key) async {
    final secretKey = SecretKey(key);
    final prefix = _randomBytes(VaultFormat.prefixLength);
    final input = await File(source).open();
    final output = await File(target).open(mode: FileMode.write);
    try {
      final length = await input.length();
      await output.writeFrom(VaultFormat.header(prefix, chunkSize));
      var position = 0;
      var index = 0;
      while (true) {
        final clear = await input.read(chunkSize);
        position += clear.length;
        final last = clear.length < chunkSize || position >= length;
        await output.writeFrom(await _sealChunk(clear, secretKey, prefix, index, last));
        if (last) break;
        index++;
      }
      return position;
    } finally {
      await input.close();
      await output.close();
    }
  }

  Future<void> decryptFile(String source, String target, List<int> key) async {
    final input = await File(source).open();
    final output = await File(target).open(mode: FileMode.write);
    try {
      final length = await input.length();
      final (chunkSize, prefix) = VaultFormat.parseHeader(
        await input.read(VaultFormat.headerLength),
      );
      final secretKey = SecretKey(key);
      final sealedChunk = chunkSize + VaultFormat.tagLength;
      var offset = VaultFormat.headerLength;
      var index = 0;
      while (true) {
        final remaining = length - offset;
        final last = remaining <= sealedChunk;
        final sealed = await input.read(last ? remaining : sealedChunk);
        await output.writeFrom(await _openChunk(sealed, secretKey, prefix, index, last));
        if (last) break;
        offset += sealed.length;
        index++;
      }
    } finally {
      await input.close();
      await output.close();
    }
  }

  Future<Uint8List> decryptFileToBytes(String source, List<int> key) async {
    return decryptBytes(await File(source).readAsBytes(), key);
  }
}
