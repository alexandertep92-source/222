import 'package:flutter/material.dart';

import '../core/session.dart';
import 'browser_chrome.dart';
import 'pin_entry.dart';

enum _Step { intro, pin, confirm, biometrics }

/// First start: explains the app and sets the security PIN.
class SetupScreen extends StatefulWidget {
  const SetupScreen({super.key, required this.session});

  final Session session;

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  _Step _step = _Step.intro;
  String _pin = '';
  String? _error;
  bool _working = false;

  Future<void> _finish({required bool biometrics}) async {
    setState(() => _working = true);
    final messenger = ScaffoldMessenger.of(context);
    final ok = await widget.session.completeSetup(_pin, biometrics: biometrics);
    if (!ok) {
      messenger.showSnackBar(
        const SnackBar(
          content: Text(
            'Fingerabdruck wurde nicht aktiviert. '
            'Du kannst ihn später in den Einstellungen einschalten.',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;

    final Widget body = switch (_step) {
      _Step.intro => Column(
        children: [
          const BrowserLogo(),
          const SizedBox(height: 24),
          Text('Willkommen', style: textTheme.headlineSmall),
          const SizedBox(height: 12),
          Text(
            'Diese App sieht aus wie ein Internet-Browser – dahinter liegt dein '
            'privater Tresor für Fotos, Videos und Dokumente.\n\n'
            'Alles, was du hier ablegst, wird verschlüsselt und ist in deiner '
            'normalen Galerie nicht mehr zu sehen.',
            textAlign: TextAlign.center,
            style: textTheme.bodyLarge?.copyWith(color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: 24),
          _Hint(
            icon: Icons.pin_outlined,
            text:
                'Lege zuerst eine Sicherheits-PIN fest (4 bis 12 Ziffern). '
                'Ohne diese PIN kommt niemand an deine Dateien – auch du nicht. '
                'Merke sie dir gut.',
          ),
          const SizedBox(height: 32),
          FilledButton.icon(
            onPressed: () => setState(() => _step = _Step.pin),
            icon: const Icon(Icons.arrow_forward),
            label: const Text('PIN festlegen'),
          ),
        ],
      ),
      _Step.pin => Column(
        children: [
          Text('Sicherheits-PIN festlegen', style: textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            '4 bis 12 Ziffern. Empfohlen: mindestens 6.',
            style: textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: 32),
          PinEntry(
            key: const ValueKey('pin'),
            submitLabel: 'Weiter',
            onSubmit: (pin) async {
              if (_isTrivial(pin)) {
                setState(() => _error = 'Diese PIN ist zu leicht zu erraten.');
                return false;
              }
              setState(() {
                _pin = pin;
                _error = null;
                _step = _Step.confirm;
              });
              return true;
            },
          ),
        ],
      ),
      _Step.confirm => Column(
        children: [
          Text('PIN bestätigen', style: textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            'Gib die PIN zur Sicherheit noch einmal ein.',
            style: textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: 32),
          PinEntry(
            key: const ValueKey('confirm'),
            autoSubmitLength: _pin.length,
            enabled: !_working,
            onSubmit: (pin) async {
              if (pin != _pin) {
                setState(() => _error = 'Die PINs stimmen nicht überein.');
                return false;
              }
              setState(() => _error = null);
              if (widget.session.biometricsAvailable) {
                setState(() => _step = _Step.biometrics);
              } else {
                await _finish(biometrics: false);
              }
              return true;
            },
          ),
          TextButton(
            onPressed: () => setState(() {
              _step = _Step.pin;
              _error = null;
            }),
            child: const Text('Andere PIN wählen'),
          ),
        ],
      ),
      _Step.biometrics => Column(
        children: [
          Icon(Icons.fingerprint, size: 96, color: scheme.primary),
          const SizedBox(height: 24),
          Text('Mit Fingerabdruck entsperren?', style: textTheme.titleLarge),
          const SizedBox(height: 12),
          Text(
            'Statt der PIN kannst du den Tresor auch mit deinem Fingerabdruck '
            '(bzw. Face ID) öffnen. Die PIN funktioniert weiterhin.',
            textAlign: TextAlign.center,
            style: textTheme.bodyLarge?.copyWith(color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: 32),
          if (_working)
            const CircularProgressIndicator()
          else ...[
            FilledButton.icon(
              onPressed: () => _finish(biometrics: true),
              icon: const Icon(Icons.fingerprint),
              label: const Text('Fingerabdruck aktivieren'),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => _finish(biometrics: false),
              child: const Text('Nur PIN verwenden'),
            ),
          ],
        ],
      ),
    };

    return PopScope(
      canPop: _step == _Step.intro,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop || _working) return;
        setState(() {
          _error = null;
          _step = switch (_step) {
            _Step.confirm || _Step.biometrics => _Step.pin,
            _ => _Step.intro,
          };
        });
      },
      child: Scaffold(
        body: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) => SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight - 32),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 440),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        body,
                        SizedBox(
                          height: 48,
                          child: _error == null
                              ? null
                              : Padding(
                                  padding: const EdgeInsets.only(top: 16),
                                  child: Text(_error!, style: TextStyle(color: scheme.error)),
                                ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  static bool _isTrivial(String pin) {
    if (pin.split('').toSet().length == 1) return true;
    const ascending = '01234567890123';
    const descending = '98765432109876';
    return ascending.contains(pin) || descending.contains(pin);
  }
}

class _Hint extends StatelessWidget {
  const _Hint({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: scheme.primaryContainer.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: scheme.primary),
          const SizedBox(width: 12),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }
}
