import 'dart:convert';
import 'dart:io';

/// Non-secret preferences, stored as plain JSON next to the vault.
class AppSettings {
  AppSettings._(this._file);

  static Future<AppSettings> load(File file) async {
    final settings = AppSettings._(file);
    if (await file.exists()) {
      try {
        final json = jsonDecode(await file.readAsString()) as Map<String, Object?>;
        settings
          ..biometricEnabled = json['biometricEnabled'] as bool? ?? false
          ..autoLockSeconds = json['autoLockSeconds'] as int? ?? 0
          ..blockScreenshots = json['blockScreenshots'] as bool? ?? true
          ..deleteOriginals = json['deleteOriginals'] as bool? ?? true
          ..pinLength = json['pinLength'] as int? ?? 0
          ..failedAttempts = json['failedAttempts'] as int? ?? 0
          ..lockedUntil = DateTime.fromMillisecondsSinceEpoch(json['lockedUntil'] as int? ?? 0);
      } on FormatException {
        // Broken settings file: fall back to the defaults.
      }
    }
    return settings;
  }

  final File _file;

  bool biometricEnabled = false;

  /// 0 = lock as soon as the app leaves the screen.
  int autoLockSeconds = 0;
  bool blockScreenshots = true;

  /// Default for "remove originals from the gallery after import".
  bool deleteOriginals = true;

  /// Length of the PIN, so the lock screen can submit automatically.
  int pinLength = 0;

  int failedAttempts = 0;
  DateTime lockedUntil = DateTime.fromMillisecondsSinceEpoch(0);

  Future<void> save() async {
    final tmp = File('${_file.path}.tmp');
    await tmp.writeAsString(
      jsonEncode({
        'biometricEnabled': biometricEnabled,
        'autoLockSeconds': autoLockSeconds,
        'blockScreenshots': blockScreenshots,
        'deleteOriginals': deleteOriginals,
        'pinLength': pinLength,
        'failedAttempts': failedAttempts,
        'lockedUntil': lockedUntil.millisecondsSinceEpoch,
      }),
      flush: true,
    );
    await tmp.rename(_file.path);
  }
}
