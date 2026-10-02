import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:share_plus/share_plus.dart';

abstract interface class ShareImageService {
  Future<void> share(
    GlobalKey boundaryKey, {
    required String fileName,
    required String text,
  });
}

class FlutterShareImageService implements ShareImageService {
  const FlutterShareImageService({this.pixelRatio = 3});

  final double pixelRatio;

  @override
  Future<void> share(
    GlobalKey boundaryKey, {
    required String fileName,
    required String text,
  }) async {
    await WidgetsBinding.instance.endOfFrame;
    final BuildContext? boundaryContext = boundaryKey.currentContext;
    final RenderObject? renderObject = boundaryContext?.findRenderObject();
    if (renderObject is! RenderRepaintBoundary ||
        renderObject.debugNeedsPaint) {
      throw StateError('공유 이미지를 준비하지 못했습니다.');
    }

    final ui.Image image = await renderObject.toImage(pixelRatio: pixelRatio);
    try {
      final ByteData? byteData = await image.toByteData(
        format: ui.ImageByteFormat.png,
      );
      if (byteData == null) {
        throw StateError('공유 이미지를 생성하지 못했습니다.');
      }
      final Uint8List bytes = byteData.buffer.asUint8List(
        byteData.offsetInBytes,
        byteData.lengthInBytes,
      );
      await SharePlus.instance.share(
        ShareParams(
          files: <XFile>[
            XFile.fromData(bytes, mimeType: 'image/png', name: fileName),
          ],
          fileNameOverrides: <String>[fileName],
          text: text,
        ),
      );
    } finally {
      image.dispose();
    }
  }
}
