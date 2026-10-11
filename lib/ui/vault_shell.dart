import 'package:flutter/material.dart';

import '../core/session.dart';
import '../core/vault.dart';
import 'browser_chrome.dart';
import 'settings_screen.dart';
import 'transfers.dart';
import 'vault_thumbnail.dart';
import 'viewers.dart';

/// The unlocked vault, dressed up as a browser: the categories are tabs,
/// the address bar searches the current tab.
class VaultShell extends StatefulWidget {
  const VaultShell({super.key, required this.session});

  final Session session;

  @override
  State<VaultShell> createState() => _VaultShellState();
}

class _VaultShellState extends State<VaultShell> {
  /// Browser-like history of pages; null is the start page.
  final List<VaultCategory?> _history = [null];
  int _position = 0;
  final _search = TextEditingController();
  String _query = '';
  final Set<String> _selected = {};
  bool _selecting = false;

  Session get _session => widget.session;
  Vault get _vault => _session.vault;
  VaultCategory? get _page => _history[_position];

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _go(VaultCategory? page) {
    if (page == _page) return;
    setState(() {
      _history.removeRange(_position + 1, _history.length);
      _history.add(page);
      _position = _history.length - 1;
      _resetPageState();
    });
  }

  void _back() {
    if (_position == 0) return;
    setState(() {
      _position--;
      _resetPageState();
    });
  }

  void _forward() {
    if (_position >= _history.length - 1) return;
    setState(() {
      _position++;
      _resetPageState();
    });
  }

  void _resetPageState() {
    _selected.clear();
    _selecting = false;
    _query = '';
    _search.clear();
    FocusManager.instance.primaryFocus?.unfocus();
  }

  List<VaultItem> _visibleItems() {
    final page = _page;
    final items = page == null ? _vault.recent(1 << 30) : _vault.itemsOf(page);
    if (_query.isEmpty) return items;
    final q = _query.toLowerCase();
    return items.where((i) => i.name.toLowerCase().contains(q)).toList();
  }

  void _toggleSelection(VaultItem item) {
    setState(() {
      if (!_selected.remove(item.id)) _selected.add(item.id);
    });
  }

  void _onItemTap(VaultItem item, List<VaultItem> visible) {
    if (_selecting) {
      _toggleSelection(item);
    } else {
      openItem(context, _session, item, gallery: visible);
    }
  }

  void _onItemLongPress(VaultItem item) {
    setState(() {
      _selecting = true;
      _selected.add(item.id);
    });
  }

  List<VaultItem> _selectedItems() =>
      _vault.allItems.where((i) => _selected.contains(i.id)).toList();

  Future<void> _exportSelected() async {
    final items = _selectedItems();
    if (items.isEmpty) return;
    final done = await Transfers(context, _session).export(items);
    if (done && mounted) setState(_resetSelection);
  }

  Future<void> _deleteSelected() async {
    final items = _selectedItems();
    if (items.isEmpty) return;
    final done = await Transfers(context, _session).confirmDelete(items);
    if (done && mounted) setState(_resetSelection);
  }

  void _resetSelection() {
    _selected.clear();
    _selecting = false;
  }

  void _showTabs() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        final scheme = Theme.of(context).colorScheme;
        Widget card(VaultCategory? page) {
          final selected = page == _page;
          return Card(
            elevation: 0,
            color: selected ? scheme.primaryContainer : scheme.surfaceContainer,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: selected ? BorderSide(color: scheme.primary, width: 2) : BorderSide.none,
            ),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () {
                Navigator.pop(context);
                _go(page);
              },
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(page == null ? Icons.home_outlined : categoryIcon(page)),
                    const Spacer(),
                    Text(
                      page?.label ?? 'Startseite',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    Text(
                      page == null
                          ? '${_vault.allItems.length} Dateien'
                          : '${_vault.countOf(page)} Dateien',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        return SafeArea(
          child: GridView.count(
            shrinkWrap: true,
            crossAxisCount: 2,
            childAspectRatio: 1.6,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            children: [card(null), for (final c in VaultCategory.values) card(c)],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _vault,
      builder: (context, _) {
        final page = _page;
        final visible = _visibleItems();
        _selected.retainAll(_vault.allItems.map((i) => i.id));
        final canPop = !_selecting && _query.isEmpty && _position == 0;

        return PopScope(
          canPop: canPop,
          onPopInvokedWithResult: (didPop, _) {
            if (didPop) return;
            if (_selecting) {
              setState(_resetSelection);
            } else if (_query.isNotEmpty) {
              setState(() {
                _query = '';
                _search.clear();
              });
            } else {
              _back();
            }
          },
          child: Scaffold(
            body: SafeArea(
              bottom: false,
              child: Column(
                children: [
                  BrowserTopBar(
                    leading: IconButton(
                      tooltip: 'Startseite',
                      icon: const Icon(Icons.home_outlined),
                      onPressed: () => _go(null),
                    ),
                    address: AddressField(
                      key: ValueKey(page),
                      url: 'tresor://${page?.slug ?? 'start'}',
                      searchHint: page == null ? 'Im Tresor suchen' : 'In ${page.label} suchen',
                      controller: _search,
                      onChanged: (q) => setState(() => _query = q.trim()),
                    ),
                    actions: [
                      TabCountButton(count: VaultCategory.values.length, onPressed: _showTabs),
                      _menu(),
                    ],
                  ),
                  BrowserTabStrip(
                    tabs: [
                      for (final c in VaultCategory.values)
                        BrowserTabData(
                          icon: categoryIcon(c),
                          label: c.label,
                          badge: _vault.countOf(c),
                        ),
                    ],
                    selected: page == null ? -1 : page.index,
                    onSelect: (i) => _go(VaultCategory.values[i]),
                  ),
                  Expanded(
                    child: page == null && _query.isEmpty
                        ? _StartPage(
                            session: _session,
                            onOpen: _go,
                            onItemTap: (item) => _onItemTap(item, _vault.recent(1 << 30)),
                          )
                        : _ItemsView(
                            vault: _vault,
                            category: page,
                            items: visible,
                            query: _query,
                            selected: _selected,
                            selecting: _selecting,
                            onTap: (item) => _onItemTap(item, visible),
                            onLongPress: _onItemLongPress,
                          ),
                  ),
                ],
              ),
            ),
            bottomNavigationBar: page == null ? null : _bottomBar(page, visible),
          ),
        );
      },
    );
  }

  Widget _menu() {
    return PopupMenuButton<String>(
      tooltip: 'Menü',
      icon: const Icon(Icons.more_vert),
      onSelected: (value) {
        switch (value) {
          case 'home':
            _go(null);
          case 'settings':
            Navigator.of(context)
                .push(MaterialPageRoute<void>(builder: (_) => SettingsScreen(session: _session)));
          case 'lock':
            _session.lock();
        }
      },
      itemBuilder: (context) => [
        PopupMenuItem(
          enabled: false,
          child: Row(
            children: [
              IconButton(
                tooltip: 'Zurück',
                onPressed: _position > 0
                    ? () {
                        Navigator.pop(context);
                        _back();
                      }
                    : null,
                icon: const Icon(Icons.arrow_back),
              ),
              IconButton(
                tooltip: 'Vorwärts',
                onPressed: _position < _history.length - 1
                    ? () {
                        Navigator.pop(context);
                        _forward();
                      }
                    : null,
                icon: const Icon(Icons.arrow_forward),
              ),
              IconButton(
                tooltip: 'Neu laden',
                onPressed: () {
                  Navigator.pop(context);
                  setState(() {});
                },
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
        ),
        const PopupMenuDivider(),
        const PopupMenuItem(
          value: 'home',
          child: ListTile(leading: Icon(Icons.home_outlined), title: Text('Startseite')),
        ),
        const PopupMenuItem(
          value: 'settings',
          child: ListTile(leading: Icon(Icons.settings_outlined), title: Text('Einstellungen')),
        ),
        const PopupMenuItem(
          value: 'lock',
          child: ListTile(leading: Icon(Icons.lock_outline), title: Text('Jetzt sperren')),
        ),
      ],
    );
  }

  Widget _bottomBar(VaultCategory page, List<VaultItem> visible) {
    final scheme = Theme.of(context).colorScheme;
    if (_selecting) {
      final allSelected = visible.isNotEmpty && visible.every((i) => _selected.contains(i.id));
      final hasSelection = _selected.isNotEmpty;
      return BottomAppBar(
        child: Row(
          children: [
            IconButton(
              tooltip: 'Auswahl beenden',
              icon: const Icon(Icons.close),
              onPressed: () => setState(_resetSelection),
            ),
            Expanded(
              child: Text(
                hasSelection ? '${_selected.length} ausgewählt' : 'Dateien antippen',
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ),
            IconButton(
              tooltip: allSelected ? 'Keine auswählen' : 'Alle auswählen',
              icon: Icon(allSelected ? Icons.deselect : Icons.select_all),
              onPressed: () => setState(() {
                if (allSelected) {
                  _selected.clear();
                } else {
                  _selected.addAll(visible.map((i) => i.id));
                }
              }),
            ),
            IconButton(
              tooltip: 'Löschen',
              icon: Icon(Icons.delete_outline, color: hasSelection ? scheme.error : null),
              onPressed: hasSelection ? _deleteSelected : null,
            ),
            const SizedBox(width: 4),
            FilledButton.icon(
              onPressed: hasSelection ? _exportSelected : null,
              icon: const Icon(Icons.ios_share, size: 18),
              label: const Text('Export'),
            ),
          ],
        ),
      );
    }
    final compact = const EdgeInsets.symmetric(horizontal: 12);
    return BottomAppBar(
      child: Row(
        children: [
          IconButton(
            tooltip: 'Zurück',
            icon: const Icon(Icons.arrow_back),
            onPressed: _position > 0 ? _back : null,
          ),
          const SizedBox(width: 4),
          Expanded(
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(padding: compact),
              onPressed: _vault.countOf(page) == 0
                  ? null
                  : () => setState(() {
                      _selecting = true;
                      if (visible.length == 1) _selected.add(visible.first.id);
                    }),
              icon: const Icon(Icons.ios_share, size: 18),
              label: const Text('Exportieren', maxLines: 1, overflow: TextOverflow.fade),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: FilledButton.icon(
              style: FilledButton.styleFrom(padding: compact),
              onPressed: () => Transfers(context, _session).importInto(page),
              icon: const Icon(Icons.add, size: 20),
              label: const Text('Importieren', maxLines: 1, overflow: TextOverflow.fade),
            ),
          ),
        ],
      ),
    );
  }
}

class _StartPage extends StatelessWidget {
  const _StartPage({required this.session, required this.onOpen, required this.onItemTap});

  final Session session;
  final ValueChanged<VaultCategory> onOpen;
  final ValueChanged<VaultItem> onItemTap;

  @override
  Widget build(BuildContext context) {
    final vault = session.vault;
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final recent = vault.recent(12);
    const colors = {
      VaultCategory.photos: Color(0xFF1E88E5),
      VaultCategory.videos: Color(0xFF8E24AA),
      VaultCategory.documents: Color(0xFF43A047),
    };

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 32, 16, 24),
      children: [
        const Center(child: BrowserLogo(size: 64)),
        const SizedBox(height: 16),
        Text('Privater Bereich', textAlign: TextAlign.center, style: textTheme.titleLarge),
        const SizedBox(height: 4),
        Text(
          '${vault.allItems.length} Dateien · ${formatBytes(vault.totalBytes)} verschlüsselt',
          textAlign: TextAlign.center,
          style: textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
        ),
        const SizedBox(height: 32),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            for (final c in VaultCategory.values)
              _SpeedDial(
                icon: categoryIcon(c),
                color: colors[c]!,
                label: c.label,
                count: vault.countOf(c),
                onTap: () => onOpen(c),
              ),
          ],
        ),
        const SizedBox(height: 32),
        if (recent.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: scheme.surfaceContainerLow,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                Icon(Icons.lightbulb_outline, color: scheme.primary),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'Öffne oben einen Tab (Fotos, Videos oder Dokumente) und tippe '
                    'unten auf „Importieren“, um Dateien in den Tresor zu verschieben.',
                  ),
                ),
              ],
            ),
          )
        else ...[
          Text('Zuletzt hinzugefügt', style: textTheme.titleSmall),
          const SizedBox(height: 12),
          SizedBox(
            height: 96,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: recent.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, i) => ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox.square(
                  dimension: 96,
                  child: InkWell(
                    onTap: () => onItemTap(recent[i]),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        VaultThumbnail(vault: vault, item: recent[i]),
                        if (recent[i].isVideo)
                          const Center(
                            child: Icon(Icons.play_circle_fill, color: Colors.white70, size: 32),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _SpeedDial extends StatelessWidget {
  const _SpeedDial({
    required this.icon,
    required this.color,
    required this.label,
    required this.count,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String label;
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          children: [
            Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(color: scheme.surfaceContainer, shape: BoxShape.circle),
              child: Icon(icon, color: color, size: 28),
            ),
            const SizedBox(height: 8),
            Text(label, style: Theme.of(context).textTheme.labelLarge),
            Text(
              '$count',
              style: Theme.of(context).textTheme.bodySmall
                  ?.copyWith(color: scheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}

class _ItemsView extends StatelessWidget {
  const _ItemsView({
    required this.vault,
    required this.category,
    required this.items,
    required this.query,
    required this.selected,
    required this.selecting,
    required this.onTap,
    required this.onLongPress,
  });

  final Vault vault;

  /// Null when searching from the start page (all categories).
  final VaultCategory? category;
  final List<VaultItem> items;
  final String query;
  final Set<String> selected;
  final bool selecting;
  final ValueChanged<VaultItem> onTap;
  final ValueChanged<VaultItem> onLongPress;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    if (items.isEmpty) {
      final c = category;
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                query.isNotEmpty || c == null ? Icons.search_off : categoryIcon(c),
                size: 64,
                color: scheme.outline,
              ),
              const SizedBox(height: 16),
              Text(
                query.isNotEmpty || c == null
                    ? 'Keine Treffer für „$query“'
                    : 'Noch keine ${c.label}',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              if (query.isEmpty && c != null) ...[
                const SizedBox(height: 8),
                Text(
                  'Tippe unten auf „Importieren“, um ${c.label} in den Tresor zu verschieben.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: scheme.onSurfaceVariant),
                ),
              ],
            ],
          ),
        ),
      );
    }

    if (category == VaultCategory.photos || category == VaultCategory.videos) {
      final videos = category == VaultCategory.videos;
      return GridView.builder(
        padding: const EdgeInsets.all(2),
        gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
          maxCrossAxisExtent: videos ? 200 : 130,
          mainAxisSpacing: 2,
          crossAxisSpacing: 2,
          childAspectRatio: videos ? 16 / 11 : 1,
        ),
        itemCount: items.length,
        itemBuilder: (context, i) => _GridTile(
          vault: vault,
          item: items[i],
          selected: selected.contains(items[i].id),
          selecting: selecting,
          onTap: () => onTap(items[i]),
          onLongPress: () => onLongPress(items[i]),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: items.length,
      separatorBuilder: (_, _) => const Divider(indent: 72),
      itemBuilder: (context, i) {
        final item = items[i];
        final isSelected = selected.contains(item.id);
        return ListTile(
          selected: isSelected,
          selectedTileColor: scheme.primaryContainer.withValues(alpha: 0.4),
          leading: SizedBox.square(
            dimension: 44,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: item.hasThumbnail
                  ? VaultThumbnail(vault: vault, item: item)
                  : _TypeIcon(item: item),
            ),
          ),
          title: Text(item.name, maxLines: 1, overflow: TextOverflow.ellipsis),
          subtitle: Text(
            [
              if (category == null) item.category.singular,
              formatBytes(item.size),
              formatDate(item.addedAt),
            ].join(' · '),
          ),
          trailing: selecting
              ? Icon(
                  isSelected ? Icons.check_circle : Icons.radio_button_unchecked,
                  color: isSelected ? scheme.primary : scheme.outline,
                )
              : null,
          onTap: () => onTap(item),
          onLongPress: () => onLongPress(item),
        );
      },
    );
  }
}

class _TypeIcon extends StatelessWidget {
  const _TypeIcon({required this.item});

  final VaultItem item;

  @override
  Widget build(BuildContext context) {
    final (icon, color) = fileTypeIcon(item);
    return ColoredBox(
      color: color.withValues(alpha: 0.12),
      child: Icon(icon, color: color),
    );
  }
}

class _GridTile extends StatelessWidget {
  const _GridTile({
    required this.vault,
    required this.item,
    required this.selected,
    required this.selecting,
    required this.onTap,
    required this.onLongPress,
  });

  final Vault vault;
  final VaultItem item;
  final bool selected;
  final bool selecting;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      onLongPress: onLongPress,
      child: Stack(
        fit: StackFit.expand,
        children: [
          VaultThumbnail(vault: vault, item: item),
          if (item.isVideo)
            Positioned(
              left: 6,
              bottom: 6,
              child: Row(
                children: [
                  const Icon(
                    Icons.play_circle_fill,
                    color: Colors.white,
                    size: 18,
                    shadows: [Shadow(blurRadius: 4)],
                  ),
                  if (item.durationMs != null) ...[
                    const SizedBox(width: 4),
                    Text(
                      formatDuration(Duration(milliseconds: item.durationMs!)),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        shadows: [Shadow(blurRadius: 4)],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          if (selecting) ...[
            AnimatedContainer(
              duration: const Duration(milliseconds: 120),
              color: selected ? scheme.primary.withValues(alpha: 0.28) : Colors.transparent,
            ),
            Positioned(
              top: 6,
              right: 6,
              child: Icon(
                selected ? Icons.check_circle : Icons.radio_button_unchecked,
                color: selected ? scheme.primary : Colors.white,
                shadows: const [Shadow(blurRadius: 4)],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
