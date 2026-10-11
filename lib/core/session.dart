import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import 'key_manager.dart';
import 'native_bridge.dart';
import 'settings.dart';
import 'vault.dart';

enum SessionState { loading, setup, locked, unlocked, error }

sealed class PinResult {
  const PinResult();
}

class PinAccepted extends PinResult {
  const PinAccepted();
}

class PinRejected extends PinResult {
  const PinRejected(this.attemptsLeft);

  /// Attempts left before a temporary lockout.
  final int attemptsLeft;
}

class PinLockedOut extends PinResult {
  const PinLockedOut(this.until);

  final DateTime until;
}

/// App-wide state: setup / locked / unlocked, the master key while unlocked,
/// and the auto-lock rules.
class Session extends ChangeNotifier {
  Session({FileCrypto? crypto}) : crypto = crypto ?? FileCrypto();

  static const attemptsBeforeLockout = 5;

  final FileCrypto crypto;
  late final Directory _root;
  late final Directory _tempRoot;
  late final KeyManager keys;
  late final AppSettings settings;

  SessionState state = SessionState.loading;
  Object? error;
  Vault? _vault;
  bool biometricsAvailable = false;

  Vault get vault => _vault!;
  bool get isUnlocked => state == SessionState.unlocked;

  int _busy = 0;
  int _external = 0;
  bool _lockPending = false;
  DateTime? _backgroundSince;
  bool _backgroundForExternal = false;

  Future<void> init() async {
    try {
      final support = await getApplicationSupportDirectory();
      _root = Directory(p.join(support.path, 'tresor'));
      await _root.create(recursive: true);
      _tempRoot = Directory(p.join((await getTemporaryDirectory()).path, 'tresor_tmp'));
      await clearTemp();
      keys = KeyManager(_root);
      settings = await AppSettings.load(File(p.join(_root.path, 'settings.json')));
      biometricsAvailable = await keys.biometricsAvailable();
      await NativeBridge.setSecure(settings.blockScreenshots);
      state = await keys.isSetUp ? SessionState.locked : SessionState.setup;
    } catch (e) {
      error = e;
      state = SessionState.error;
    }
    notifyListeners();
  }

  /// Removes decrypted copies made for viewing, sharing or exporting.
  Future<void> clearTemp() async {
    try {
      if (await _tempRoot.exists()) await _tempRoot.delete(recursive: true);
    } on FileSystemException {
      // A file is still in use; it is removed on the next start.
    }
  }

  Future<void> _open(Uint8List key) async {
    _vault = await Vault.open(root: _root, key: key, crypto: crypto, tempRoot: _tempRoot);
    state = SessionState.unlocked;
    _backgroundSince = null;
    notifyListeners();
  }

  /// Creates the vault. Returns false if fingerprint unlock was requested
  /// but could not be enabled (the vault is created anyway).
  Future<bool> completeSetup(String pin, {bool biometrics = false}) async {
    final key = await keys.create(pin);
    var biometricsOk = !biometrics;
    if (biometrics) {
      try {
        biometricsOk = await keys.enableBiometrics(key);
      } on BiometricException {
        biometricsOk = false;
      }
    }
    settings
      ..pinLength = pin.length
      ..biometricEnabled = biometrics && biometricsOk
      ..failedAttempts = 0;
    await settings.save();
    await _open(key);
    return biometricsOk;
  }

  Duration get lockoutRemaining {
    final left = settings.lockedUntil.difference(DateTime.now());
    return left.isNegative ? Duration.zero : left;
  }

  Future<PinResult> unlockWithPin(String pin) async {
    if (lockoutRemaining > Duration.zero) return PinLockedOut(settings.lockedUntil);
    final key = await keys.unlock(pin);
    if (key == null) {
      settings.failedAttempts++;
      final failed = settings.failedAttempts;
      PinResult result;
      if (failed % attemptsBeforeLockout == 0) {
        // 30 s, 1 min, 2 min, ... up to 30 min.
        final round = failed ~/ attemptsBeforeLockout - 1;
        final seconds = (30 * (1 << round.clamp(0, 6))).clamp(30, 1800);
        settings.lockedUntil = DateTime.now().add(Duration(seconds: seconds));
        result = PinLockedOut(settings.lockedUntil);
      } else {
        result = PinRejected(attemptsBeforeLockout - failed % attemptsBeforeLockout);
      }
      await settings.save();
      return result;
    }
    settings
      ..failedAttempts = 0
      ..pinLength = pin.length;
    await settings.save();
    await _open(key);
    return const PinAccepted();
  }

  /// Returns false if the user cancelled. Throws [BiometricException].
  Future<bool> unlockWithBiometrics() async {
    final key = await keys.unlockWithBiometrics();
    if (key == null) return false;
    try {
      await _open(key);
    } on Exception {
      // The stored key no longer matches the vault (e.g. restored backup).
      await keys.disableBiometrics();
      settings.biometricEnabled = false;
      await settings.save();
      throw const BiometricException(
        'Fingerabdruck muss neu eingerichtet werden. Bitte mit PIN entsperren.',
      );
    }
    return true;
  }

  Future<bool> setBiometrics(bool enabled) async {
    if (enabled) {
      final ok = await external(() => keys.enableBiometrics(vault.key));
      if (!ok) return false;
    } else {
      await keys.disableBiometrics();
    }
    settings.biometricEnabled = enabled;
    await settings.save();
    notifyListeners();
    return true;
  }

  Future<bool> changePin(String oldPin, String newPin) async {
    final ok = await keys.changePin(oldPin, newPin);
    if (ok) {
      settings.pinLength = newPin.length;
      await settings.save();
    }
    return ok;
  }

  Future<void> updateSettings(void Function(AppSettings s) change) async {
    change(settings);
    await settings.save();
    await NativeBridge.setSecure(settings.blockScreenshots);
    notifyListeners();
  }

  void lock() {
    if (state != SessionState.unlocked) return;
    if (_busy > 0) {
      _lockPending = true;
      return;
    }
    _lockPending = false;
    _vault?.close();
    _vault = null;
    state = SessionState.locked;
    PaintingBinding.instance.imageCache.clear();
    unawaited(clearTemp());
    notifyListeners();
  }

  /// Runs a long operation (import, export). Locking waits until it is done
  /// so the key does not disappear halfway.
  Future<T> busy<T>(Future<T> Function() action) async {
    _busy++;
    try {
      return await action();
    } finally {
      _busy--;
      if (_busy == 0 && _lockPending) lock();
    }
  }

  /// Runs [action] that shows a system screen (file picker, share sheet,
  /// permission dialog). Leaving the app for it does not lock the vault.
  Future<T> external<T>(Future<T> Function() action) async {
    _external++;
    try {
      return await action();
    } finally {
      // The "resumed" event can arrive after the result.
      Future<void>.delayed(const Duration(milliseconds: 800), () => _external--);
    }
  }

  bool get inExternal => _external > 0;

  void handleLifecycle(AppLifecycleState lifecycle) {
    switch (lifecycle) {
      case AppLifecycleState.hidden:
      case AppLifecycleState.paused:
        if (!isUnlocked || _backgroundSince != null) return;
        _backgroundSince = DateTime.now();
        _backgroundForExternal = _external > 0;
        if (!_backgroundForExternal && settings.autoLockSeconds == 0) lock();
      case AppLifecycleState.resumed:
        final since = _backgroundSince;
        _backgroundSince = null;
        if (since == null) return;
        // While a system screen (picker, share sheet) is open, give the user
        // up to 5 minutes before locking.
        final limit = _backgroundForExternal
            ? (settings.autoLockSeconds < 300 ? 300 : settings.autoLockSeconds)
            : settings.autoLockSeconds;
        if (DateTime.now().difference(since).inSeconds >= limit) lock();
      case AppLifecycleState.inactive:
      case AppLifecycleState.detached:
        break;
    }
  }
}
