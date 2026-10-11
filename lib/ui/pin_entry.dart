import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// PIN dots plus a numeric keypad.
///
/// [onSubmit] returns false when the PIN was not accepted; the field then
/// shakes and clears.
class PinEntry extends StatefulWidget {
  const PinEntry({
    super.key,
    required this.onSubmit,
    this.autoSubmitLength,
    this.minLength = 4,
    this.maxLength = 12,
    this.onBiometric,
    this.enabled = true,
    this.submitLabel = 'OK',
  });

  final Future<bool> Function(String pin) onSubmit;

  /// Submit as soon as this many digits are entered (lock screen).
  /// Otherwise an OK key is shown.
  final int? autoSubmitLength;
  final int minLength;
  final int maxLength;
  final VoidCallback? onBiometric;
  final bool enabled;
  final String submitLabel;

  @override
  State<PinEntry> createState() => _PinEntryState();
}

class _PinEntryState extends State<PinEntry> with SingleTickerProviderStateMixin {
  String _pin = '';
  bool _submitting = false;
  late final AnimationController _shake = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
  );

  @override
  void didUpdateWidget(PinEntry oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.autoSubmitLength != widget.autoSubmitLength) _pin = '';
  }

  @override
  void dispose() {
    _shake.dispose();
    super.dispose();
  }

  bool get _active => widget.enabled && !_submitting;

  void _digit(int d) {
    if (!_active || _pin.length >= widget.maxLength) return;
    HapticFeedback.selectionClick();
    setState(() => _pin += '$d');
    final auto = widget.autoSubmitLength;
    if (auto != null && auto > 0 && _pin.length == auto) _submit();
  }

  void _backspace() {
    if (!_active || _pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  Future<void> _submit() async {
    if (_pin.length < widget.minLength) return;
    setState(() => _submitting = true);
    final ok = await widget.onSubmit(_pin);
    if (!mounted) return;
    setState(() {
      _submitting = false;
      if (!ok) _pin = '';
    });
    if (!ok) {
      HapticFeedback.heavyImpact();
      _shake.forward(from: 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final auto = widget.autoSubmitLength;
    final dots = auto != null && auto > 0 ? auto : max(widget.minLength, _pin.length);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedBuilder(
          animation: _shake,
          builder: (context, child) => Transform.translate(
            offset: Offset(sin(_shake.value * pi * 6) * 12 * (1 - _shake.value), 0),
            child: child,
          ),
          child: SizedBox(
            height: 28,
            child: _submitting
                ? const Center(
                    child: SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    ),
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (var i = 0; i < dots; i++)
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 120),
                          margin: const EdgeInsets.symmetric(horizontal: 6),
                          width: 14,
                          height: 14,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: i < _pin.length ? scheme.primary : Colors.transparent,
                            border: Border.all(
                              color: i < _pin.length ? scheme.primary : scheme.outline,
                              width: 1.5,
                            ),
                          ),
                        ),
                    ],
                  ),
          ),
        ),
        const SizedBox(height: 24),
        LayoutBuilder(
          builder: (context, constraints) {
            final size = min(76.0, (constraints.maxWidth - 48) / 3);
            Widget key(Widget child, VoidCallback? onTap, {String? label}) {
              return Padding(
                padding: const EdgeInsets.all(6),
                child: SizedBox.square(
                  dimension: size,
                  child: Semantics(
                    button: true,
                    label: label,
                    child: Material(
                      color: onTap == null ? Colors.transparent : scheme.surfaceContainer,
                      shape: const CircleBorder(),
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: onTap,
                        child: Center(child: child),
                      ),
                    ),
                  ),
                ),
              );
            }

            Widget digit(int d) => key(
              Text(
                '$d',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w500,
                  color: scheme.onSurface,
                ),
              ),
              () => _digit(d),
              label: '$d',
            );

            final Widget bottomLeft;
            if (widget.onBiometric != null) {
              bottomLeft = key(
                Icon(Icons.fingerprint, size: 32, color: scheme.primary),
                widget.enabled ? widget.onBiometric : null,
                label: 'Fingerabdruck',
              );
            } else if (auto == null || auto == 0) {
              final canSubmit = _pin.length >= widget.minLength && _active;
              bottomLeft = key(
                Text(
                  widget.submitLabel,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: canSubmit ? scheme.primary : scheme.outline,
                  ),
                ),
                canSubmit ? _submit : null,
                label: widget.submitLabel,
              );
            } else {
              bottomLeft = key(const SizedBox(), null);
            }

            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final row in const [
                  [1, 2, 3],
                  [4, 5, 6],
                  [7, 8, 9],
                ])
                  Row(mainAxisSize: MainAxisSize.min, children: [for (final d in row) digit(d)]),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    bottomLeft,
                    digit(0),
                    key(
                      Icon(Icons.backspace_outlined, color: scheme.onSurfaceVariant),
                      _pin.isEmpty ? null : _backspace,
                      label: 'Löschen',
                    ),
                  ],
                ),
                if (widget.onBiometric != null && (auto == null || auto == 0))
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: FilledButton(
                      onPressed: _pin.length >= widget.minLength && _active ? _submit : null,
                      child: Text(widget.submitLabel),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}
