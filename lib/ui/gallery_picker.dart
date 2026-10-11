import 'package:flutter/material.dart';
import 'package:photo_manager/photo_manager.dart';
import 'package:photo_manager_image_provider/photo_manager_image_provider.dart';

import '../core/session.dart';
import 'vault_thumbnail.dart';

class GalleryPickResult {
  const GalleryPickResult(this.assets, {required this.deleteOriginals});

  final List<AssetEntity> assets;
  final bool deleteOriginals;
}

/// Multi-select picker for photos or videos from the device gallery.
class GalleryPickerScreen extends StatefulWidget {
  const GalleryPickerScreen({
    super.key,
    required this.session,
    required this.videos,
    required this.deleteOriginals,
  });

  final Session session;
  final bool videos;
  final bool deleteOriginals;

  @override
  State<GalleryPickerScreen> createState() => _GalleryPickerScreenState();
}

class _GalleryPickerScreenState extends State<GalleryPickerScreen> {
  static const _pageSize = 80;

  PermissionState? _permission;
  List<AssetPathEntity> _albums = [];
  AssetPathEntity? _album;
  final List<AssetEntity> _assets = [];
  final Map<String, AssetEntity> _selected = {};
  int _page = 0;
  bool _loading = false;
  bool _hasMore = true;
  late bool _deleteOriginals = widget.deleteOriginals;

  RequestType get _type => widget.videos ? RequestType.video : RequestType.image;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final permission = await widget.session.external(
      () => PhotoManager.requestPermissionExtend(
        requestOption: PermissionRequestOption(
          androidPermission: AndroidPermission(type: _type, mediaLocation: true),
        ),
      ),
    );
    if (!mounted) return;
    setState(() => _permission = permission);
    if (!permission.hasAccess) return;
    final albums = await PhotoManager.getAssetPathList(
      type: _type,
      filterOption: FilterOptionGroup(
        orders: const [OrderOption(type: OrderOptionType.createDate, asc: false)],
      ),
    );
    if (!mounted) return;
    setState(() {
      _albums = albums;
      _album = albums.isEmpty ? null : albums.first;
    });
    await _reload();
  }

  Future<void> _reload() async {
    setState(() {
      _assets.clear();
      _page = 0;
      _hasMore = true;
    });
    await _loadMore();
  }

  Future<void> _loadMore() async {
    final album = _album;
    if (_loading || !_hasMore || album == null) return;
    _loading = true;
    try {
      final page = await album.getAssetListPaged(page: _page, size: _pageSize);
      if (!mounted || album != _album) return;
      setState(() {
        _assets.addAll(page);
        _page++;
        _hasMore = page.length == _pageSize;
      });
    } finally {
      _loading = false;
    }
  }

  void _toggle(AssetEntity asset) {
    setState(() {
      if (_selected.remove(asset.id) == null) _selected[asset.id] = asset;
    });
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final permission = _permission;
    final noun = widget.videos ? 'Videos' : 'Fotos';

    Widget body;
    if (permission == null) {
      body = const Center(child: CircularProgressIndicator());
    } else if (!permission.hasAccess) {
      body = Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.photo_library_outlined, size: 64, color: scheme.outline),
              const SizedBox(height: 16),
              Text(
                'Um $noun aus der Galerie zu übernehmen, braucht die App '
                'Zugriff auf deine Mediathek.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => widget.session.external(PhotoManager.openSetting),
                child: const Text('Zugriff in den Einstellungen erlauben'),
              ),
              TextButton(onPressed: _init, child: const Text('Erneut prüfen')),
            ],
          ),
        ),
      );
    } else {
      body = Column(
        children: [
          if (permission.isLimited)
            Material(
              color: scheme.secondaryContainer,
              child: ListTile(
                dense: true,
                leading: const Icon(Icons.info_outline),
                title: Text('Die App sieht nur die $noun, die du freigegeben hast.'),
                trailing: TextButton(
                  onPressed: () async {
                    await widget.session.external(() => PhotoManager.presentLimited(type: _type));
                    await _reload();
                  },
                  child: const Text('Mehr'),
                ),
              ),
            ),
          Expanded(
            child: _assets.isEmpty && !_hasMore
                ? Center(child: Text('Keine $noun gefunden'))
                : NotificationListener<ScrollNotification>(
                    onNotification: (n) {
                      if (n.metrics.pixels > n.metrics.maxScrollExtent - 600) _loadMore();
                      return false;
                    },
                    child: GridView.builder(
                      padding: const EdgeInsets.all(2),
                      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                        maxCrossAxisExtent: 120,
                        mainAxisSpacing: 2,
                        crossAxisSpacing: 2,
                      ),
                      itemCount: _assets.length,
                      itemBuilder: (context, i) => _tile(_assets[i], scheme),
                    ),
                  ),
          ),
        ],
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: _albums.length > 1
            ? DropdownButtonHideUnderline(
                child: DropdownButton<AssetPathEntity>(
                  value: _album,
                  isExpanded: true,
                  items: [
                    for (final album in _albums)
                      DropdownMenuItem(
                        value: album,
                        child: Text(
                          album.isAll ? 'Alle $noun' : album.name,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (album) {
                    setState(() => _album = album);
                    _reload();
                  },
                ),
              )
            : Text('$noun auswählen'),
        actions: [
          if (_assets.isNotEmpty)
            TextButton(
              onPressed: () => setState(() {
                final allSelected = _assets.every((a) => _selected.containsKey(a.id));
                for (final a in _assets) {
                  if (allSelected) {
                    _selected.remove(a.id);
                  } else {
                    _selected[a.id] = a;
                  }
                }
              }),
              child: const Text('Alle'),
            ),
        ],
      ),
      body: body,
      bottomNavigationBar: permission?.hasAccess == true
          ? SafeArea(
              child: Material(
                color: scheme.surfaceContainerLow,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(8, 4, 16, 8),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CheckboxListTile(
                        value: _deleteOriginals,
                        onChanged: (v) => setState(() => _deleteOriginals = v ?? false),
                        controlAffinity: ListTileControlAffinity.leading,
                        contentPadding: EdgeInsets.zero,
                        dense: true,
                        title: const Text('Originale danach aus der Galerie löschen'),
                        subtitle: const Text(
                          'Empfohlen – sonst bleiben die Dateien in der Galerie sichtbar.',
                        ),
                      ),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _selected.isEmpty
                              ? null
                              : () => Navigator.pop(
                                  context,
                                  GalleryPickResult(
                                    _selected.values.toList(),
                                    deleteOriginals: _deleteOriginals,
                                  ),
                                ),
                          icon: const Icon(Icons.lock_outline),
                          label: Text(
                            _selected.isEmpty
                                ? 'In den Tresor verschieben'
                                : '${_selected.length} in den Tresor verschieben',
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            )
          : null,
    );
  }

  Widget _tile(AssetEntity asset, ColorScheme scheme) {
    final selected = _selected.containsKey(asset.id);
    return GestureDetector(
      onTap: () => _toggle(asset),
      child: Stack(
        fit: StackFit.expand,
        children: [
          AssetEntityImage(
            asset,
            isOriginal: false,
            thumbnailSize: const ThumbnailSize.square(240),
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => ColoredBox(color: scheme.surfaceContainer),
          ),
          if (asset.type == AssetType.video)
            Positioned(right: 4, bottom: 4, child: _Badge(formatDuration(asset.videoDuration))),
          AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            color: selected ? scheme.primary.withValues(alpha: 0.28) : Colors.transparent,
          ),
          Positioned(
            top: 4,
            right: 4,
            child: Icon(
              selected ? Icons.check_circle : Icons.radio_button_unchecked,
              color: selected ? scheme.primary : Colors.white,
              shadows: const [Shadow(blurRadius: 4)],
            ),
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
      decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(4)),
      child: Text(text, style: const TextStyle(color: Colors.white, fontSize: 11)),
    );
  }
}
