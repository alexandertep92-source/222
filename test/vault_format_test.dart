import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:tresor_browser/core/vault_format.dart';

Uint8List _bytes(int length, [int seed = 1]) {
  final random = Random(seed);
  return Uint8List.fromList(List.generate(length, (_) => random.nextInt(256)));
}

void main() {
  final key = _bytes(32, 42);
  // Small chunks so multi-chunk paths are exercised quickly.
  final cipher = DartVaultCipher(chunkSize: 1024);

  group('bytes', () {
    for (final length in [0, 1, 1023, 1024, 1025, 2048, 5000]) {
      test('round trip $length bytes', () async {
        final clear = _bytes(length);
        final sealed = await cipher.encryptBytes(clear, key);
        final chunks = length == 0 ? 1 : (length / 1024).ceil();
        expect(sealed.length, VaultFormat.headerLength + length + chunks * VaultFormat.tagLength);
        expect(await cipher.decryptBytes(sealed, key), clear);
      });
    }

    test('wrong key is rejected', () async {
      final sealed = await cipher.encryptBytes(_bytes(3000), key);
      expect(
        () => cipher.decryptBytes(sealed, _bytes(32, 7)),
        throwsA(isA<VaultAuthenticationException>()),
      );
    });

    test('modified data is rejected', () async {
      final sealed = await cipher.encryptBytes(_bytes(3000), key);
      sealed[VaultFormat.headerLength + 1500] ^= 1;
      expect(() => cipher.decryptBytes(sealed, key), throwsA(isA<VaultAuthenticationException>()));
    });

    test('truncation at a chunk border is rejected', () async {
      final sealed = await cipher.encryptBytes(_bytes(3000), key);
      final cut = Uint8List.sublistView(
        sealed,
        0,
        VaultFormat.headerLength + 2 * (1024 + VaultFormat.tagLength),
      );
      expect(() => cipher.decryptBytes(cut, key), throwsA(isA<VaultAuthenticationException>()));
    });

    test('swapped chunks are rejected', () async {
      final sealed = await cipher.encryptBytes(_bytes(4096), key);
      const size = 1024 + VaultFormat.tagLength;
      const a = VaultFormat.headerLength;
      final first = sealed.sublist(a, a + size);
      final second = sealed.sublist(a + size, a + 2 * size);
      sealed.setRange(a, a + size, second);
      sealed.setRange(a + size, a + 2 * size, first);
      expect(() => cipher.decryptBytes(sealed, key), throwsA(isA<VaultAuthenticationException>()));
    });

    test('foreign data is rejected', () {
      expect(
        () => cipher.decryptBytes(Uint8List.fromList(List.filled(64, 1)), key),
        throwsA(isA<VaultFormatException>()),
      );
    });

    test('same input gives different output', () async {
      final clear = _bytes(100);
      expect(await cipher.encryptBytes(clear, key), isNot(await cipher.encryptBytes(clear, key)));
    });
  });

  group('files', () {
    late Directory dir;
    setUp(() async => dir = await Directory.systemTemp.createTemp('vault_format'));
    tearDown(() => dir.delete(recursive: true));

    for (final length in [0, 1024, 3000]) {
      test('file round trip $length bytes, readable as bytes', () async {
        final clear = _bytes(length, length);
        final source = File('${dir.path}/in')..writeAsBytesSync(clear);
        final encrypted = '${dir.path}/enc';
        final out = '${dir.path}/out';
        expect(await cipher.encryptFile(source.path, encrypted, key), length);
        await cipher.decryptFile(encrypted, out, key);
        expect(File(out).readAsBytesSync(), clear);
        // Files and byte buffers share one format.
        expect(await cipher.decryptBytes(File(encrypted).readAsBytesSync(), key), clear);
        final sealed = await cipher.encryptBytes(clear, key);
        File(encrypted).writeAsBytesSync(sealed);
        await cipher.decryptFile(encrypted, out, key);
        expect(File(out).readAsBytesSync(), clear);
      });
    }
  });
}
