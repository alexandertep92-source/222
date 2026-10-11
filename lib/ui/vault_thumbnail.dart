import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../core/vault.dart';

/// Creates a small PNG preview of an encoded image, or null if it can't be
/// decoded.
Future<Uint8List?> makeImageThumbnail(Uint8List encoded, {int width = 320}) async {
  try {
    final codec = await ui.instantiateImageCodec(encoded, targetWidth: width);
    final frame = await codec.getNextFrame();
    final data = await frame.image.toByteData(format: ui.ImageByteFormat.png);
    frame.image.dispose();
    codec.dispose();
    return data?.buffer.asUint8List();
  } on Exception {
    return null;
  }
}

IconData categoryIcon(VaultCategory category) => switch (category) {
  VaultCategory.photos => Icons.photo_outlined,
  VaultCategory.videos => Icons.movie_outlined,
  VaultCategory.documents => Icons.description_outlined,
};

(IconData, Color) fileTypeIcon(VaultItem item) {
  if (item.isImage) return (Icons.image_outlined, const Color(0xFF1E88E5));
  if (item.isVideo) return (Icons.movie_outlined, const Color(0xFF8E24AA));
  if (item.mime.startsWith('audio/')) return (Icons.audiotrack_outlined, const Color(0xFFF4511E));
  return switch (item.extension) {
    'pdf' => (Icons.picture_as_pdf_outlined, const Color(0xFFE53935)),
    'doc' ||
    'docx' ||
    'odt' ||
    'rtf' ||
    'pages' => (Icons.article_outlined, const Color(0xFF1E88E5)),
    'xls' ||
    'xlsx' ||
    'ods' ||
    'csv' ||
    'numbers' => (Icons.table_chart_outlined, const Color(0xFF43A047)),
    'ppt' || 'pptx' || 'odp' || 'key' => (Icons.slideshow_outlined, const Color(0xFFFB8C00)),
    'zip' || 'rar' || '7z' || 'tar' || 'gz' => (Icons.folder_zip_outlined, const Color(0xFF6D4C41)),
    'txt' || 'md' || 'json' || 'xml' || 'log' => (Icons.notes_outlined, const Color(0xFF546E7A)),
    _ => (Icons.insert_drive_file_outlined, const Color(0xFF757575)),
  };
}

String formatBytes(int bytes) {
  if (bytes < 1024) return '$bytes B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  var value = bytes / 1024;
  var unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  final text = value >= 100 ? value.toStringAsFixed(0) : value.toStringAsFixed(1);
  return '${text.replaceAll('.', ',')} ${units[unit]}';
}

String formatDate(DateTime date) {
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(date.day)}.${two(date.month)}.${date.year}';
}

String formatDuration(Duration d) {
  String two(int v) => v.toString().padLeft(2, '0');
  final hours = d.inHours;
  final minutes = d.inMinutes % 60;
  final seconds = d.inSeconds % 60;
  return hours > 0 ? '$hours:${two(minutes)}:${two(seconds)}' : '$minutes:${two(seconds)}';
}

/// Decrypted preview of a vault item (or a file type icon).
class VaultThumbnail extends StatefulWidget {
  const VaultThumbnail({super.key, required this.vault, required this.item});

  final Vault vault;
  final VaultItem item;

  @override
  State<VaultThumbnail> createState() => _VaultThumbnailState();
}

class _VaultThumbnailState extends State<VaultThumbnail> {
  Uint8List? _bytes;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(VaultThumbnail oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.item.id != widget.item.id) {
      _bytes = null;
      _load();
    }
  }

  void _load() {
    final cached = widget.vault.cachedThumbnail(widget.item);
    if (cached != null) {
      _bytes = cached;
      return;
    }
    if (!widget.item.hasThumbnail) return;
    final id = widget.item.id;
    widget.vault.thumbnail(widget.item).then((bytes) {
      if (mounted && widget.item.id == id) setState(() => _bytes = bytes);
    }, onError: (Object _) {});
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final bytes = _bytes;
    if (bytes != null) {
      return Image.memory(
        bytes,
        fit: BoxFit.cover,
        gaplessPlayback: true,
        errorBuilder: (_, _, _) => _placeholder(scheme),
      );
    }
    return _placeholder(scheme);
  }

  Widget _placeholder(ColorScheme scheme) {
    final (icon, color) = fileTypeIcon(widget.item);
    return ColoredBox(
      color: scheme.surfaceContainer,
      child: Center(
        child: Icon(
          widget.item.hasThumbnail ? categoryIcon(widget.item.category) : icon,
          color: widget.item.hasThumbnail ? scheme.outline : color,
          size: 32,
        ),
      ),
    );
  }
}
