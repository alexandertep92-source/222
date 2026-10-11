import 'dart:convert';
import 'dart:io';
import 'dart:isolate';
import 'dart:math';
import 'dart:typed_data';

import 'package:cryptography/dart.dart';
import 'package:cryptography/cryptography.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';
import 'package:local_auth_android/local_auth_android.dart';
import 'package:local_auth_darwin/local_auth_darwin.dart';

import 'vault_format.dart';

/// Derives a key from the PIN (PBKDF2-HMAC-SHA256) in a background isolate.
Future<Uint8List> derivePinKey(String pin, List<int> salt, int iterations) {
  return Isolate.run(() async {
    final pbkdf2 = DartPbkdf2(
      macAlgorithm: const DartHmac(DartSha256()),
      iterations: iterations,
      bits: 256,
    );
    final key = await pbkdf2.deriveKey(secretKey: SecretKey(utf8.encode(pin)), nonce: salt);
    return Uint8List.fromList(await key.extractBytes());
  });
}

class BiometricException implements Exception {
  const BiometricException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Manages the master key of the vault.
///
/// The master key is random and never changes. It is stored in `keys.json`,
/// encrypted with a key derived from the PIN. Changing the PIN therefore only
/// re-encrypts the master key, not the files. For fingerprint / Face ID
/// unlock, a copy of the master key is kept in the Android Keystore / iOS
/// Keychain (flutter_secure_storage) and only released after a successful
/// biometric check.
class KeyManager {
  KeyManager(
    Directory dir, {
    this.iterations = defaultIterations,
    DartVaultCipher? cipher,
    LocalAuthentication? auth,
    FlutterSecureStorage? storage,
  }) : _file = File('${dir.path}/keys.json'),
       _cipher = cipher ?? DartVaultCipher(),
       _auth = auth ?? LocalAuthentication(),
       _storage = storage ?? const FlutterSecureStorage();

  static const defaultIterations = 100000;
  static const _storageKey = 'tresor_master_key';

  final File _file;
  final int iterations;
  final DartVaultCipher _cipher;
  final LocalAuthentication _auth;
  final FlutterSecureStorage _storage;

  Future<bool> get isSetUp => _file.exists();

  static Uint8List _random(int length) {
    final random = Random.secure();
    return Uint8List.fromList(List.generate(length, (_) => random.nextInt(256)));
  }

  Future<void> _write(Uint8List masterKey, String pin) async {
    final salt = _random(16);
    final pinKey = await derivePinKey(pin, salt, iterations);
    final wrapped = await _cipher.encryptBytes(masterKey, pinKey);
    final tmp = File('${_file.path}.tmp');
    await tmp.writeAsString(
      jsonEncode({
        'version': 1,
        'kdf': 'pbkdf2-hmac-sha256',
        'iterations': iterations,
        'salt': base64Encode(salt),
        'key': base64Encode(wrapped),
      }),
      flush: true,
    );
    await tmp.rename(_file.path);
  }

  /// Creates a new master key protected by [pin].
  Future<Uint8List> create(String pin) async {
    final masterKey = _random(32);
    await _write(masterKey, pin);
    await disableBiometrics();
    return masterKey;
  }

  /// Returns the master key, or null if [pin] is wrong.
  Future<Uint8List?> unlock(String pin) async {
    final json = jsonDecode(await _file.readAsString()) as Map<String, Object?>;
    final pinKey = await derivePinKey(
      pin,
      base64Decode(json['salt']! as String),
      json['iterations']! as int,
    );
    try {
      return await _cipher.decryptBytes(base64Decode(json['key']! as String), pinKey);
    } on VaultAuthenticationException {
      return null;
    }
  }

  /// Returns false if [oldPin] is wrong.
  Future<bool> changePin(String oldPin, String newPin) async {
    final masterKey = await unlock(oldPin);
    if (masterKey == null) return false;
    await _write(masterKey, newPin);
    return true;
  }

  Future<bool> biometricsAvailable() async {
    try {
      if (!await _auth.isDeviceSupported()) return false;
      if (!await _auth.canCheckBiometrics) return false;
      return (await _auth.getAvailableBiometrics()).isNotEmpty;
    } on Exception {
      return false;
    }
  }

  /// Shows the system fingerprint / Face ID dialog.
  /// Returns false if the user cancelled.
  Future<bool> authenticate(String reason) async {
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        biometricOnly: true,
        persistAcrossBackgrounding: true,
        authMessages: const [
          AndroidAuthMessages(
            signInTitle: 'Entsperren',
            signInHint: 'Fingerabdruck scannen',
            cancelButton: 'PIN verwenden',
          ),
          IOSAuthMessages(cancelButton: 'Abbrechen', localizedFallbackTitle: 'PIN verwenden'),
        ],
      );
    } on LocalAuthException catch (e) {
      switch (e.code) {
        case LocalAuthExceptionCode.userCanceled:
        case LocalAuthExceptionCode.systemCanceled:
        case LocalAuthExceptionCode.timeout:
        case LocalAuthExceptionCode.authInProgress:
        case LocalAuthExceptionCode.userRequestedFallback:
          return false;
        case LocalAuthExceptionCode.noBiometricsEnrolled:
          throw const BiometricException('Auf diesem Gerät ist kein Fingerabdruck eingerichtet.');
        case LocalAuthExceptionCode.noBiometricHardware:
        case LocalAuthExceptionCode.biometricHardwareTemporarilyUnavailable:
          throw const BiometricException('Fingerabdrucksensor ist nicht verfügbar.');
        case LocalAuthExceptionCode.temporaryLockout:
        case LocalAuthExceptionCode.biometricLockout:
          throw const BiometricException('Zu viele Versuche. Bitte entsperre mit deiner PIN.');
        default:
          throw BiometricException(
            'Fingerabdruck fehlgeschlagen (${e.description ?? e.code.name}).',
          );
      }
    }
  }

  Future<bool> enableBiometrics(Uint8List masterKey) async {
    if (!await authenticate('Fingerabdruck zum Entsperren aktivieren')) return false;
    await _storage.write(key: _storageKey, value: base64Encode(masterKey));
    return true;
  }

  Future<void> disableBiometrics() async {
    try {
      await _storage.delete(key: _storageKey);
    } on Exception {
      // Nothing stored or keystore unavailable: nothing to remove.
    }
  }

  /// Returns the master key after a successful biometric check, or null if
  /// the user cancelled. Throws [BiometricException] if it is not possible.
  Future<Uint8List?> unlockWithBiometrics() async {
    if (!await authenticate('Entsperre deine privaten Tabs')) return null;
    String? stored;
    try {
      stored = await _storage.read(key: _storageKey);
    } on Exception {
      stored = null;
    }
    if (stored == null) {
      throw const BiometricException(
        'Fingerabdruck muss neu eingerichtet werden. Bitte mit PIN entsperren.',
      );
    }
    return base64Decode(stored);
  }
}
