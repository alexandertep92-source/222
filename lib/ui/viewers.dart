import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';

import '../core/session.dart';
import '../core/vault.dart';
import 'transfers.dart';
import 'vault_thumbnail.dart';

/// Opens the right viewer for [item].
Future<void> openItem(
  BuildContext context,
  Session session,
  VaultItem item, {
  List<VaultItem>? gallery,
}) async {
  if (item.isImage) {
    final images = (gallery ?? [item]).where((i) => i.isImage).toList();
    final index = images.indexWhere((i) => i.id == item.id);
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) =>
            PhotoViewer(session: session, items: images, initialIndex: index < 0 ? 0 : index),
      ),
    );
  } else if (item.isVideo) {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => VideoPlayerScreen(session: session, item: item),
      ),
    );
  } else if (item.isText && item.size <= 2 << 20) {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TextViewer(session: session, item: item),
      ),
    );
  } else {
    await Transfers(context, session).openExternally(item);
  }
}

Future<void> showItemInfo(BuildContext context, Session session, VaultItem item) {
  final controller = TextEditingController(text: item.name);
  return showDialog<void>(
    context: context,
    builder: (context) {
      Widget row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(width: 110, child: Text(label, style: Theme.of(context).textTheme.bodySmall)),
            Expanded(child: Text(value)),
          ],
        ),
      );
      return AlertDialog(
        title: const Text('Details'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: controller,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            const SizedBox(height: 12),
            row('Größe', formatBytes(item.size)),
            row('Typ', item.mime),
            row('Hinzugefügt', formatDate(item.addedAt)),
            if (item.takenAt != null) row('Aufgenommen', formatDate(item.takenAt!)),
            if (item.durationMs != null)
              row('Länge', formatDuration(Duration(milliseconds: item.durationMs!))),
            row('Speicher', 'AES-256 verschlüsselt'),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Schließen')),
          FilledButton(
            onPressed: () async {
              final name = controller.text.trim();
              if (name.isNotEmpty && name != item.name) {
                await session.vault.rename(item, name);
              }
              if (context.mounted) Navigator.pop(context);
            },
            child: const Text('Speichern'),
          ),
        ],
      );
    },
  ).whenComplete(controller.dispose);
}

/// Common actions in the viewers' top bar.
List<Widget> _viewerActions(BuildContext context, Session session, VaultItem item) => [
  IconButton(
    tooltip: 'Exportieren',
    icon: const Icon(Icons.ios_share),
    onPressed: () => Transfers(context, session).export([item]),
  ),
  IconButton(
    tooltip: 'Löschen',
    icon: const Icon(Icons.delete_outline),
    onPressed: () => Transfers(context, session).confirmDelete([item]),
  ),
  IconButton(
    tooltip: 'Details',
    icon: const Icon(Icons.info_outline),
    onPressed: () => showItemInfo(context, session, item),
  ),
];

/// Keeps a viewer's item list in sync with the vault (deleted or renamed
/// items) and closes the viewer when nothing is left.
mixin _VaultItemsMixin<T extends StatefulWidget> on State<T> {
  late List<VaultItem> items;
  Session get session;

  void startWatching(List<VaultItem> initial) {
    items = [...initial];
    session.vault.addListener(_onVault);
  }

  void stopWatching() {
    if (session.isUnlocked) session.vault.removeListener(_onVault);
  }

  void _onVault() {
    final current = {for (final i in session.vault.allItems) i.id: i};
    final next = [
      for (final i in items)
        if (current[i.id] != null) current[i.id]!,
    ];
    if (next.isEmpty) {
      Navigator.of(context).maybePop();
      return;
    }
    setState(() => onItemsChanged(next));
  }

  void onItemsChanged(List<VaultItem> next) => items = next;
}

class PhotoViewer extends StatefulWidget {
  const PhotoViewer({
    super.key,
    required this.session,
    required this.items,
    required this.initialIndex,
  });

  final Session session;
  final List<VaultItem> items;
  final int initialIndex;

  @override
  State<PhotoViewer> createState() => _PhotoViewerState();
}

class _PhotoViewerState extends State<PhotoViewer> with _VaultItemsMixin {
  late final PageController _pages = PageController(initialPage: widget.initialIndex);
  late int _index = widget.initialIndex;
  bool _chrome = true;
  bool _zoomed = false;
  final Map<String, Future<Uint8List>> _cache = {};

  @override
  Session get session => widget.session;

  @override
  void initState() {
    super.initState();
    startWatching(widget.items);
  }

  @override
  void dispose() {
    stopWatching();
    _pages.dispose();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  @override
  void onItemsChanged(List<VaultItem> next) {
    super.onItemsChanged(next);
    _index = _index.clamp(0, next.length - 1);
  }

  Future<Uint8List> _load(VaultItem item) {
    if (_cache.length > 6) {
      final keep = {
        for (var i = _index - 2; i <= _index + 2; i++)
          if (i >= 0 && i < items.length) items[i].id,
      };
      _cache.removeWhere((id, _) => !keep.contains(id));
    }
    return _cache.putIfAbsent(item.id, () => session.vault.readBytes(item));
  }

  void _toggleChrome() {
    setState(() => _chrome = !_chrome);
    SystemChrome.setEnabledSystemUIMode(
      _chrome ? SystemUiMode.edgeToEdge : SystemUiMode.immersiveSticky,
    );
  }

  @override
  Widget build(BuildContext context) {
    final item = items[_index.clamp(0, items.length - 1)];
    return Theme(
      data: ThemeData.dark(useMaterial3: true),
      child: Scaffold(
        backgroundColor: Colors.black,
        extendBodyBehindAppBar: true,
        appBar: _chrome
            ? AppBar(
                backgroundColor: Colors.black54,
                foregroundColor: Colors.white,
                title: Text(items.length > 1 ? '${_index + 1} / ${items.length}' : item.name),
                actions: _viewerActions(context, session, item),
              )
            : null,
        body: PageView.builder(
          controller: _pages,
          physics: _zoomed ? const NeverScrollableScrollPhysics() : null,
          itemCount: items.length,
          onPageChanged: (i) => setState(() {
            _index = i;
            _zoomed = false;
          }),
          itemBuilder: (context, i) => _ZoomableImage(
            key: ValueKey(items[i].id),
            bytes: _load(items[i]),
            onTap: _toggleChrome,
            onZoomChanged: (zoomed) {
              if (zoomed != _zoomed) setState(() => _zoomed = zoomed);
            },
          ),
        ),
      ),
    );
  }
}

class _ZoomableImage extends StatefulWidget {
  const _ZoomableImage({
    super.key,
    required this.bytes,
    required this.onTap,
    required this.onZoomChanged,
  });

  final Future<Uint8List> bytes;
  final VoidCallback onTap;
  final ValueChanged<bool> onZoomChanged;

  @override
  State<_ZoomableImage> createState() => _ZoomableImageState();
}

class _ZoomableImageState extends State<_ZoomableImage> {
  final _transform = TransformationController();
  TapDownDetails? _doubleTap;

  @override
  void initState() {
    super.initState();
    _transform.addListener(() {
      widget.onZoomChanged(_transform.value.getMaxScaleOnAxis() > 1.01);
    });
  }

  @override
  void dispose() {
    _transform.dispose();
    super.dispose();
  }

  void _onDoubleTap() {
    if (_transform.value.getMaxScaleOnAxis() > 1.01) {
      _transform.value = Matrix4.identity();
    } else {
      final position = _doubleTap?.localPosition ?? Offset.zero;
      _transform.value = Matrix4.identity()
        ..translateByDouble(-position.dx * 1.5, -position.dy * 1.5, 0, 1)
        ..scaleByDouble(2.5, 2.5, 1, 1);
    }
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final decodeWidth = (media.size.shortestSide * media.devicePixelRatio * 2).round();
    return FutureBuilder<Uint8List>(
      future: widget.bytes,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return const Center(
            child: Text(
              'Bild kann nicht angezeigt werden',
              style: TextStyle(color: Colors.white70),
            ),
          );
        }
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        return GestureDetector(
          onTap: widget.onTap,
          onDoubleTapDown: (d) => _doubleTap = d,
          onDoubleTap: _onDoubleTap,
          child: InteractiveViewer(
            transformationController: _transform,
            maxScale: 6,
            child: SizedBox.expand(
              child: Image.memory(
                snapshot.data!,
                fit: BoxFit.contain,
                cacheWidth: decodeWidth,
                gaplessPlayback: true,
                errorBuilder: (_, _, _) => const Center(
                  child: Text(
                    'Dieses Bildformat wird nicht unterstützt.\n'
                    'Über „Exportieren“ kannst du es in einer anderen App öffnen.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white70),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class VideoPlayerScreen extends StatefulWidget {
  const VideoPlayerScreen({super.key, required this.session, required this.item});

  final Session session;
  final VaultItem item;

  @override
  State<VideoPlayerScreen> createState() => _VideoPlayerScreenState();
}

class _VideoPlayerScreenState extends State<VideoPlayerScreen> with _VaultItemsMixin {
  File? _temp;
  VideoPlayerController? _controller;
  String? _error;
  bool _controls = true;
  Timer? _hideTimer;

  @override
  Session get session => widget.session;

  @override
  void initState() {
    super.initState();
    startWatching([widget.item]);
    _prepare();
  }

  Future<void> _prepare() async {
    try {
      final temp = await session.busy(() => session.vault.decryptToTemp(widget.item));
      if (!mounted) {
        await temp.parent.delete(recursive: true);
        return;
      }
      _temp = temp;
      final controller = VideoPlayerController.file(temp);
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      controller.addListener(() {
        if (mounted) setState(() {});
      });
      setState(() => _controller = controller);
      await controller.play();
      _scheduleHide();
    } catch (e) {
      if (mounted) {
        setState(() => _error = 'Video kann nicht abgespielt werden.');
      }
    }
  }

  void _scheduleHide() {
    _hideTimer?.cancel();
    _hideTimer = Timer(const Duration(seconds: 3), () {
      if (mounted && (_controller?.value.isPlaying ?? false)) {
        setState(() => _controls = false);
      }
    });
  }

  @override
  void dispose() {
    stopWatching();
    _hideTimer?.cancel();
    _controller?.dispose();
    final temp = _temp;
    if (temp != null) {
      temp.parent.delete(recursive: true).ignore();
    }
    super.dispose();
  }

  void _togglePlay() {
    final c = _controller;
    if (c == null) return;
    c.value.isPlaying ? c.pause() : c.play();
    _scheduleHide();
  }

  @override
  Widget build(BuildContext context) {
    final item = items.first;
    final c = _controller;
    return Theme(
      data: ThemeData.dark(useMaterial3: true),
      child: Scaffold(
        backgroundColor: Colors.black,
        extendBodyBehindAppBar: true,
        appBar: _controls || c == null
            ? AppBar(
                backgroundColor: Colors.black54,
                foregroundColor: Colors.white,
                title: Text(item.name, overflow: TextOverflow.ellipsis),
                actions: _viewerActions(context, session, item),
              )
            : null,
        body: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            setState(() => _controls = !_controls);
            if (_controls) _scheduleHide();
          },
          child: Stack(
            fit: StackFit.expand,
            children: [
              Center(
                child: _error != null
                    ? Text(_error!, style: const TextStyle(color: Colors.white70))
                    : c == null
                    ? const Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircularProgressIndicator(),
                          SizedBox(height: 16),
                          Text(
                            'Video wird entschlüsselt …',
                            style: TextStyle(color: Colors.white70),
                          ),
                        ],
                      )
                    : AspectRatio(aspectRatio: c.value.aspectRatio, child: VideoPlayer(c)),
              ),
              if (c != null && _controls) ...[
                Center(
                  child: IconButton.filled(
                    iconSize: 48,
                    style: IconButton.styleFrom(backgroundColor: Colors.black45),
                    onPressed: _togglePlay,
                    icon: Icon(
                      c.value.isPlaying ? Icons.pause : Icons.play_arrow,
                      color: Colors.white,
                    ),
                  ),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: Container(
                    color: Colors.black45,
                    padding: EdgeInsets.fromLTRB(
                      16,
                      8,
                      16,
                      8 + MediaQuery.of(context).padding.bottom,
                    ),
                    child: Row(
                      children: [
                        Text(
                          formatDuration(c.value.position),
                          style: const TextStyle(color: Colors.white),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: VideoProgressIndicator(
                            c,
                            allowScrubbing: true,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          formatDuration(c.value.duration),
                          style: const TextStyle(color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class TextViewer extends StatefulWidget {
  const TextViewer({super.key, required this.session, required this.item});

  final Session session;
  final VaultItem item;

  @override
  State<TextViewer> createState() => _TextViewerState();
}

class _TextViewerState extends State<TextViewer> with _VaultItemsMixin {
  late final Future<String> _text = session.vault
      .readBytes(widget.item)
      .then((bytes) => utf8.decode(bytes, allowMalformed: true));

  @override
  Session get session => widget.session;

  @override
  void initState() {
    super.initState();
    startWatching([widget.item]);
  }

  @override
  void dispose() {
    stopWatching();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final item = items.first;
    final mono = !item.mime.startsWith('text/plain');
    return Scaffold(
      appBar: AppBar(
        title: Text(item.name, overflow: TextOverflow.ellipsis),
        actions: _viewerActions(context, session, item),
      ),
      body: FutureBuilder<String>(
        future: _text,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return const Center(child: Text('Datei kann nicht gelesen werden.'));
          }
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: SelectableText(
              snapshot.data!,
              style: mono ? const TextStyle(fontFamily: 'monospace', fontSize: 13) : null,
            ),
          );
        },
      ),
    );
  }
}
