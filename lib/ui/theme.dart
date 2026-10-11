import 'package:flutter/material.dart';

/// Neutral, browser-like look (light and dark).
abstract final class BrowserTheme {
  static const _blue = Color(0xFF1A73E8);
  static const _blueDark = Color(0xFF8AB4F8);

  static ThemeData light() => _build(
    ColorScheme.fromSeed(
      seedColor: _blue,
      primary: _blue,
      surface: Colors.white,
      surfaceContainerLowest: Colors.white,
      surfaceContainerLow: const Color(0xFFF8F9FA),
      surfaceContainer: const Color(0xFFF1F3F4),
      surfaceContainerHigh: const Color(0xFFE8EAED),
      surfaceContainerHighest: const Color(0xFFDADCE0),
    ),
  );

  static ThemeData dark() => _build(
    ColorScheme.fromSeed(
      seedColor: _blue,
      brightness: Brightness.dark,
      primary: _blueDark,
      onPrimary: const Color(0xFF062E6F),
      surface: const Color(0xFF202124),
      surfaceContainerLowest: const Color(0xFF17181A),
      surfaceContainerLow: const Color(0xFF26272A),
      surfaceContainer: const Color(0xFF303134),
      surfaceContainerHigh: const Color(0xFF3C4043),
      surfaceContainerHighest: const Color(0xFF494C50),
    ),
  );

  static ThemeData _build(ColorScheme scheme) {
    return ThemeData(
      colorScheme: scheme,
      scaffoldBackgroundColor: scheme.surface,
      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      bottomAppBarTheme: BottomAppBarThemeData(
        color: scheme.surfaceContainerLow,
        surfaceTintColor: Colors.transparent,
        height: 64,
        padding: const EdgeInsets.symmetric(horizontal: 8),
      ),
      snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
      dividerTheme: DividerThemeData(color: scheme.outlineVariant, space: 1),
    );
  }
}
