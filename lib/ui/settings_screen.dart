import 'package:flutter/material.dart';

import '../core/key_manager.dart';
import '../core/session.dart';
import '../core/vault.dart';
import 'pin_entry.dart';
import 'vault_thumbnail.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key, required this.session});

  final Session session;

  static const _autoLockOptions = {
    0: 'Sofort',
    30: 'Nach 30 Sekunden',
    60: 'Nach 1 Minute',
    300: 'Nach 5 Minuten',
  };

  Future<void> _toggleBiometrics(BuildContext context, bool enabled) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final ok = await session.setBiometrics(enabled);
      if (!ok) {
        messenger.showSnackBar(
          const SnackBar(content: Text('Fingerabdruck wurde nicht aktiviert.')),
        );
      }
    } on BiometricException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _chooseAutoLock(BuildContext context) async {
    final value = await showDialog<int>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Automatisch sperren'),
        children: [
          RadioGroup<int>(
            groupValue: session.settings.autoLockSeconds,
            onChanged: (v) => Navigator.pop(context, v),
            child: Column(
              children: [
                for (final MapEntry(:key, :value) in _autoLockOptions.entries)
                  RadioListTile<int>(value: key, title: Text(value)),
              ],
            ),
          ),
        ],
      ),
    );
    if (value != null) await session.updateSettings((s) => s.autoLockSeconds = value);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) {
        if (!session.isUnlocked) return const SizedBox();
        final settings = session.settings;
        final vault = session.vault;
        final scheme = Theme.of(context).colorScheme;
        Widget header(String text) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 4),
          child: Text(
            text,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(color: scheme.primary),
          ),
        );

        return Scaffold(
          appBar: AppBar(title: const Text('Einstellungen')),
          body: ListView(
            children: [
              header('Sicherheit'),
              ListTile(
                leading: const Icon(Icons.pin_outlined),
                title: const Text('PIN ändern'),
                onTap: () => Navigator.of(
                  context,
                ).push(MaterialPageRoute<void>(builder: (_) => ChangePinScreen(session: session))),
              ),
              SwitchListTile(
                secondary: const Icon(Icons.fingerprint),
                title: const Text('Mit Fingerabdruck entsperren'),
                subtitle: Text(
                  session.biometricsAvailable
                      ? 'Fingerabdruck bzw. Face ID statt PIN'
                      : 'Auf diesem Gerät ist kein Fingerabdruck eingerichtet',
                ),
                value: settings.biometricEnabled,
                onChanged: session.biometricsAvailable
                    ? (v) => _toggleBiometrics(context, v)
                    : null,
              ),
              ListTile(
                leading: const Icon(Icons.timer_outlined),
                title: const Text('Automatisch sperren'),
                subtitle: Text(
                  '${_autoLockOptions[settings.autoLockSeconds] ?? '${settings.autoLockSeconds} s'}, '
                  'wenn die App verlassen wird',
                ),
                onTap: () => _chooseAutoLock(context),
              ),
              SwitchListTile(
                secondary: const Icon(Icons.screenshot_monitor_outlined),
                title: const Text('Screenshots blockieren'),
                subtitle: const Text('Verbirgt den Inhalt auch in der App-Übersicht (Android)'),
                value: settings.blockScreenshots,
                onChanged: (v) => session.updateSettings((s) => s.blockScreenshots = v),
              ),
              header('Import'),
              SwitchListTile(
                secondary: const Icon(Icons.photo_library_outlined),
                title: const Text('Originale aus der Galerie löschen'),
                subtitle: const Text('Standard beim Import aus der Galerie'),
                value: settings.deleteOriginals,
                onChanged: (v) => session.updateSettings((s) => s.deleteOriginals = v),
              ),
              header('Speicher'),
              for (final category in VaultCategory.values)
                ListTile(
                  leading: Icon(categoryIcon(category)),
                  title: Text(category.label),
                  trailing: Text(
                    '${vault.countOf(category)} · ${formatBytes(_bytesOf(vault, category))}',
                  ),
                ),
              ListTile(
                leading: const Icon(Icons.cleaning_services_outlined),
                title: const Text('Temporäre Dateien löschen'),
                subtitle: const Text(
                  'Entschlüsselte Kopien zum Ansehen/Teilen (passiert auch beim Sperren)',
                ),
                onTap: () async {
                  await session.clearTemp();
                  if (context.mounted) {
                    ScaffoldMessenger.of(context)
                        .showSnackBar(const SnackBar(content: Text('Temporäre Dateien gelöscht')));
                  }
                },
              ),
              header('Info'),
              const ListTile(
                leading: Icon(Icons.shield_outlined),
                title: Text('Verschlüsselung'),
                subtitle: Text(
                  'Alle Dateien liegen AES-256-verschlüsselt im privaten Speicher der App. '
                  'Galerie und andere Apps können sie nicht sehen.',
                ),
              ),
              ListTile(
                leading: Icon(Icons.warning_amber_rounded, color: scheme.error),
                title: const Text('Wichtig'),
                subtitle: const Text(
                  'Wenn du die App deinstallierst oder ihre Daten löschst, ist auch der '
                  'Inhalt des Tresors weg. Exportiere vorher alles, was du behalten möchtest.',
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        );
      },
    );
  }

  static int _bytesOf(Vault vault, VaultCategory category) =>
      vault.itemsOf(category).fold(0, (sum, i) => sum + i.size);
}

enum _PinStep { current, next, confirm }

class ChangePinScreen extends StatefulWidget {
  const ChangePinScreen({super.key, required this.session});

  final Session session;

  @override
  State<ChangePinScreen> createState() => _ChangePinScreenState();
}

class _ChangePinScreenState extends State<ChangePinScreen> {
  _PinStep _step = _PinStep.current;
  String _current = '';
  String _next = '';
  String? _error;

  @override
  Widget build(BuildContext context) {
    final title = switch (_step) {
      _PinStep.current => 'Aktuelle PIN eingeben',
      _PinStep.next => 'Neue PIN (4–12 Ziffern)',
      _PinStep.confirm => 'Neue PIN bestätigen',
    };
    return Scaffold(
      appBar: AppBar(title: const Text('PIN ändern')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              Text(title, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 32),
              PinEntry(
                key: ValueKey(_step),
                autoSubmitLength: switch (_step) {
                  _PinStep.current => widget.session.settings.pinLength,
                  _PinStep.next => null,
                  _PinStep.confirm => _next.length,
                },
                submitLabel: 'Weiter',
                onSubmit: _submit,
              ),
              const SizedBox(height: 16),
              if (_error != null)
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
          ),
        ),
      ),
    );
  }

  Future<bool> _submit(String pin) async {
    switch (_step) {
      case _PinStep.current:
        final key = await widget.session.keys.unlock(pin);
        if (key == null) {
          setState(() => _error = 'PIN ist falsch.');
          return false;
        }
        setState(() {
          _current = pin;
          _error = null;
          _step = _PinStep.next;
        });
      case _PinStep.next:
        setState(() {
          _next = pin;
          _error = null;
          _step = _PinStep.confirm;
        });
      case _PinStep.confirm:
        if (pin != _next) {
          setState(() => _error = 'Die PINs stimmen nicht überein.');
          return false;
        }
        final ok = await widget.session.changePin(_current, _next);
        if (!mounted) return true;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ok ? 'PIN wurde geändert' : 'PIN konnte nicht geändert werden')),
        );
        Navigator.of(context).pop();
    }
    return true;
  }
}
