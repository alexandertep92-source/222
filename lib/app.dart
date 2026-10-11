import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/session.dart';
import 'ui/browser_chrome.dart';
import 'ui/lock_screen.dart';
import 'ui/setup_screen.dart';
import 'ui/theme.dart';
import 'ui/vault_shell.dart';

class TresorApp extends StatefulWidget {
  const TresorApp({super.key, required this.session});

  final Session session;

  @override
  State<TresorApp> createState() => _TresorAppState();
}

class _TresorAppState extends State<TresorApp> with WidgetsBindingObserver {
  final _navigator = GlobalKey<NavigatorState>();
  SessionState? _lastState;
  bool _covered = false;

  Session get _session => widget.session;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _session.addListener(_onSession);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _session.removeListener(_onSession);
    super.dispose();
  }

  void _onSession() {
    final state = _session.state;
    if (state != _lastState && state == SessionState.locked) {
      // Close viewers, dialogs and sheets so nothing stays on top of the
      // lock screen.
      _navigator.currentState?.popUntil((route) => route.isFirst);
    }
    _lastState = state;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _session.handleLifecycle(state);
    // Hide the content in the app switcher (iOS takes its snapshot while
    // inactive). Not while a system dialog of ours is in front.
    final cover = state != AppLifecycleState.resumed && _session.isUnlocked && !_session.inExternal;
    if (cover != _covered) setState(() => _covered = cover);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Browser',
      debugShowCheckedModeBanner: false,
      navigatorKey: _navigator,
      theme: BrowserTheme.light(),
      darkTheme: BrowserTheme.dark(),
      locale: const Locale('de'),
      supportedLocales: const [Locale('de'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      builder: (context, child) => Stack(
        children: [
          ?child,
          if (_covered) const Positioned.fill(child: _PrivacyCover()),
        ],
      ),
      home: ListenableBuilder(
        listenable: _session,
        builder: (context, _) => switch (_session.state) {
          SessionState.loading => const _Splash(),
          SessionState.setup => SetupScreen(session: _session),
          SessionState.locked => LockScreen(session: _session),
          SessionState.unlocked => VaultShell(session: _session),
          SessionState.error => _ErrorScreen(error: _session.error),
        },
      ),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: BrowserLogo()));
  }
}

class _PrivacyCover extends StatelessWidget {
  const _PrivacyCover();

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: Theme.of(context).colorScheme.surface,
      child: const Center(child: BrowserLogo()),
    );
  }
}

class _ErrorScreen extends StatelessWidget {
  const _ErrorScreen({required this.error});

  final Object? error;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_outlined, size: 64),
              const SizedBox(height: 16),
              const Text('Die Seite konnte nicht geladen werden.'),
              const SizedBox(height: 8),
              Text(
                '$error',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
