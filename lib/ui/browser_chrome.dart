import 'package:flutter/material.dart';

/// Rounded "omnibox" like in a mobile browser.
///
/// When not focused it shows [url]; when focused it is a search field.
class AddressField extends StatefulWidget {
  const AddressField({
    super.key,
    required this.url,
    required this.searchHint,
    this.leadingIcon = Icons.lock_outline,
    this.controller,
    this.onChanged,
    this.onSubmitted,
    this.keyboardType = TextInputType.text,
  });

  final String url;
  final String searchHint;
  final IconData leadingIcon;
  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final TextInputType keyboardType;

  @override
  State<AddressField> createState() => _AddressFieldState();
}

class _AddressFieldState extends State<AddressField> {
  final _focus = FocusNode();
  late TextEditingController _controller;
  bool _ownsController = false;

  @override
  void initState() {
    super.initState();
    _controller = widget.controller ?? TextEditingController();
    _ownsController = widget.controller == null;
    _focus.addListener(() => setState(() {}));
    _controller.addListener(_onText);
  }

  @override
  void didUpdateWidget(AddressField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      _controller.removeListener(_onText);
      if (_ownsController) _controller.dispose();
      _controller = widget.controller ?? TextEditingController();
      _ownsController = widget.controller == null;
      _controller.addListener(_onText);
    }
  }

  void _onText() => setState(() {});

  @override
  void dispose() {
    _focus.dispose();
    _controller.removeListener(_onText);
    if (_ownsController) _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final focused = _focus.hasFocus;
    final hasText = _controller.text.isNotEmpty;
    return Container(
      height: 44,
      decoration: BoxDecoration(
        color: scheme.surfaceContainer,
        borderRadius: BorderRadius.circular(22),
        border: focused ? Border.all(color: scheme.primary, width: 1.5) : null,
      ),
      child: Row(
        children: [
          const SizedBox(width: 12),
          Icon(
            focused ? Icons.search : widget.leadingIcon,
            size: 18,
            color: scheme.onSurfaceVariant,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: _controller,
              focusNode: _focus,
              onChanged: widget.onChanged,
              onSubmitted: widget.onSubmitted,
              keyboardType: widget.keyboardType,
              textInputAction: TextInputAction.go,
              autocorrect: false,
              enableSuggestions: false,
              maxLines: 1,
              style: TextStyle(fontSize: 15, color: scheme.onSurface),
              decoration: InputDecoration(
                isCollapsed: true,
                border: InputBorder.none,
                hintText: focused ? widget.searchHint : widget.url,
                hintMaxLines: 1,
                hintStyle: TextStyle(
                  fontSize: 15,
                  color: focused ? scheme.onSurfaceVariant : scheme.onSurface,
                ),
              ),
            ),
          ),
          if (hasText || focused)
            IconButton(
              tooltip: 'Leeren',
              visualDensity: VisualDensity.compact,
              iconSize: 18,
              icon: const Icon(Icons.close),
              onPressed: () {
                _controller.clear();
                widget.onChanged?.call('');
                if (!hasText) _focus.unfocus();
              },
            )
          else
            const SizedBox(width: 12),
        ],
      ),
    );
  }
}

/// The square tab counter next to the address bar.
class TabCountButton extends StatelessWidget {
  const TabCountButton({super.key, required this.count, this.onPressed});

  final int count;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.onSurface;
    return IconButton(
      tooltip: 'Tabs',
      onPressed: onPressed,
      icon: Container(
        width: 22,
        height: 22,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          border: Border.all(color: color, width: 2),
          borderRadius: BorderRadius.circular(5),
        ),
        child: Text(
          count > 99 ? ':D' : '$count',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color),
        ),
      ),
    );
  }
}

/// Top bar of the browser: optional leading button, address field, actions.
class BrowserTopBar extends StatelessWidget {
  const BrowserTopBar({super.key, required this.address, this.leading, this.actions = const []});

  final Widget address;
  final Widget? leading;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 6, 4, 6),
      child: Row(
        children: [
          if (leading != null) leading! else const SizedBox(width: 8),
          Expanded(child: address),
          ...actions,
          if (actions.isEmpty) const SizedBox(width: 8),
        ],
      ),
    );
  }
}

class BrowserTabData {
  const BrowserTabData({required this.icon, required this.label, this.badge});

  final IconData icon;
  final String label;
  final int? badge;
}

/// Row of browser tabs. The selected tab merges into the page below.
class BrowserTabStrip extends StatelessWidget {
  const BrowserTabStrip({
    super.key,
    required this.tabs,
    required this.selected,
    required this.onSelect,
  });

  final List<BrowserTabData> tabs;

  /// Index into [tabs], or -1 if no tab is selected (start page).
  final int selected;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      color: scheme.surfaceContainer,
      padding: const EdgeInsets.only(top: 6, left: 6, right: 6),
      height: 46,
      child: Row(
        children: [
          for (var i = 0; i < tabs.length; i++)
            Expanded(
              child: _BrowserTab(
                data: tabs[i],
                selected: i == selected,
                showDivider: i < tabs.length - 1 && i != selected && i + 1 != selected,
                onTap: () => onSelect(i),
              ),
            ),
        ],
      ),
    );
  }
}

class _BrowserTab extends StatelessWidget {
  const _BrowserTab({
    required this.data,
    required this.selected,
    required this.showDivider,
    required this.onTap,
  });

  final BrowserTabData data;
  final bool selected;
  final bool showDivider;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final fg = selected ? scheme.onSurface : scheme.onSurfaceVariant;
    return Material(
      color: selected ? scheme.surface : Colors.transparent,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(10)),
      child: InkWell(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(10)),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          decoration: BoxDecoration(
            border: showDivider ? Border(right: BorderSide(color: scheme.outlineVariant)) : null,
          ),
          child: Row(
            children: [
              Icon(data.icon, size: 16, color: selected ? scheme.primary : fg),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  data.label,
                  maxLines: 1,
                  overflow: TextOverflow.fade,
                  softWrap: false,
                  style: TextStyle(
                    fontSize: 13,
                    color: fg,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ),
              if (data.badge != null && data.badge! > 0)
                Text(
                  '${data.badge}',
                  style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The globe logo used on the start pages.
class BrowserLogo extends StatelessWidget {
  const BrowserLogo({super.key, this.size = 72});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2F80ED), Color(0xFF1A4FB8)],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1A4FB8).withValues(alpha: 0.3),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Icon(Icons.language, color: Colors.white, size: size * 0.62),
    );
  }
}
