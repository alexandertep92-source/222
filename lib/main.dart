import 'package:flutter/material.dart';

import 'app.dart';
import 'core/session.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final session = Session();
  runApp(TresorApp(session: session));
  await session.init();
}
