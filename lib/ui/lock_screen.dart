import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/key_manager.dart';
import '../core/session.dart';
import 'browser_chrome.dart';
import 'pin_entry.dart';

/// Opens what was typed into the address bar in the real browser, so the
/// disguise holds up if someone else tries it.
Future<void> openInWebBrowser(String input) async {
  final text = input.trim();
  if (text.isEmpty) return;
  final looksLikeUrl = !text.contains(' ') && text.contains('.');
  final uri = looksLikeUrl
      ? Uri.parse(text.contains('://') ? text : 'https://$text')
      : Uri.https('www.google.com', '/search', {'q': text});
  try {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  } on Exception {
    // No browser installed: nothing to do.
  }
}

/// Start screen. Looks like a browser's new tab page whose private tabs are
/// locked; asks for the PIN or the fingerprint.
class LockScreen extends StatefulWidget {
  const LockScreen({super.key, required this.session});

  final Session session;

  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> with WidgetsBindingObserver {
  String? _message;
  bool _prompted = false;
  bool _authenticating = false;
  Timer? _ticker;

  Session get _session => widget.session;

  bool get _biometrics => _session.settings.biometricEnabled && _session.biometricsAvailable;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startLockoutTicker();
    if (WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _autoPrompt());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _ticker?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _autoPrompt();
    } else if (state == AppLifecycleState.paused) {
      _prompted = false;
    }
  }

  void _autoPrompt() {
    if (_prompted || !_biometrics || !mounted) return;
    _prompted = true;
    _useBiometrics();
  }

  void _startLockoutTicker() {
    _ticker?.cancel();
    if (_session.lockoutRemaining == Duration.zero) return;
    _ticker = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_session.lockoutRemaining == Duration.zero) {
        timer.cancel();
        setState(() => _message = null);
      } else {
        setState(() {});
      }
    });
  }

  Future<void> _useBiometrics() async {
    if (_authenticating) return;
    _authenticating = true;
    try {
      await _session.unlockWithBiometrics();
    } on BiometricException catch (e) {
      if (mounted) setState(() => _message = e.message);
    } finally {
      _authenticating = false;
    }
  }

  Future<bool> _submitPin(String pin) async {
    final result = await _session.unlockWithPin(pin);
    if (!mounted) return true;
    switch (result) {
      case PinAccepted():
        return true;
      case PinRejected(:final attemptsLeft):
        setState(() {
          _message = attemptsLeft == 1
              ? 'Falsche PIN. Noch 1 Versuch bis zur Sperre.'
              : 'Falsche PIN. Noch $attemptsLeft Versuche bis zur Sperre.';
        });
        return false;
      case PinLockedOut():
        setState(() => _message = null);
        _startLockoutTicker();
        return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final lockout = _session.lockoutRemaining;
    final lockedOut = lockout > Duration.zero;
    final message = lockedOut
        ? 'Zu viele Fehlversuche. Erneut versuchen in ${_format(lockout)}.'
        : _message;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            BrowserTopBar(
              leading: IconButton(
                tooltip: 'Startseite',
                icon: const Icon(Icons.home_outlined),
                onPressed: () => FocusScope.of(context).unfocus(),
              ),
              address: const AddressField(
                url: 'Suchen oder Webadresse eingeben',
                searchHint: 'Suchen oder Webadresse eingeben',
                leadingIcon: Icons.search,
                keyboardType: TextInputType.url,
                onSubmitted: openInWebBrowser,
              ),
              actions: [
                TabCountButton(count: 1, onPressed: () {}),
                const SizedBox(width: 4),
              ],
            ),
            Expanded(
              child: LayoutBuilder(
                builder: (context, constraints) => SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: constraints.maxHeight),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(height: 16),
                        const BrowserLogo(size: 56),
                        const SizedBox(height: 20),
                        Container(
                          constraints: const BoxConstraints(maxWidth: 420),
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                          decoration: BoxDecoration(
                            color: scheme.surfaceContainerLow,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: scheme.outlineVariant),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.lock_outline, color: scheme.primary),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Private Tabs sind gesperrt', style: textTheme.titleSmall),
                                    const SizedBox(height: 2),
                                    Text(
                                      _biometrics
                                          ? 'PIN eingeben oder Fingerabdruck verwenden'
                                          : 'PIN eingeben, um fortzufahren',
                                      style: textTheme.bodySmall?.copyWith(
                                        color: scheme.onSurfaceVariant,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 28),
                        PinEntry(
                          autoSubmitLength: _session.settings.pinLength,
                          enabled: !lockedOut,
                          onBiometric: _biometrics ? _useBiometrics : null,
                          onSubmit: _submitPin,
                        ),
                        SizedBox(
                          height: 56,
                          child: message == null
                              ? null
                              : Padding(
                                  padding: const EdgeInsets.only(top: 12),
                                  child: Text(
                                    message,
                                    textAlign: TextAlign.center,
                                    style: TextStyle(color: scheme.error),
                                  ),
                                ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _format(Duration d) {
    final total = (d.inMilliseconds / 1000).ceil();
    final minutes = total ~/ 60;
    final seconds = total % 60;
    if (minutes == 0) return '$seconds s';
    return '$minutes:${seconds.toString().padLeft(2, '0')} min';
  }
}
