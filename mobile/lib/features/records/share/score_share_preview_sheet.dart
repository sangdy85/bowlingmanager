import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/records/share/score_share_card.dart';
import 'package:bowlingmanager_mobile/features/records/share/score_share_data.dart';
import 'package:bowlingmanager_mobile/features/records/share/score_share_service.dart';
import 'package:flutter/material.dart';

Future<void> showScoreSharePreview({
  required BuildContext context,
  required ScoreShareData data,
  ScoreShareService service = const FlutterScoreShareService(),
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: AppColors.surface,
    builder: (BuildContext context) => FractionallySizedBox(
      heightFactor: 0.92,
      child: ScoreSharePreviewSheet(data: data, service: service),
    ),
  );
}

class ScoreSharePreviewSheet extends StatefulWidget {
  const ScoreSharePreviewSheet({
    required this.data,
    required this.service,
    super.key,
  });

  final ScoreShareData data;
  final ScoreShareService service;

  @override
  State<ScoreSharePreviewSheet> createState() => _ScoreSharePreviewSheetState();
}

class _ScoreSharePreviewSheetState extends State<ScoreSharePreviewSheet> {
  final GlobalKey _boundaryKey = GlobalKey();
  bool _isSharing = false;

  Future<void> _share() async {
    if (_isSharing) return;
    setState(() => _isSharing = true);
    try {
      await widget.service.share(_boundaryKey);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('공유 이미지를 만들지 못했습니다. 다시 시도해 주세요.')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSharing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      child: Column(
        children: <Widget>[
          Row(
            children: <Widget>[
              const Expanded(
                child: Text('공유 카드 미리보기', style: AppTextStyles.title),
              ),
              IconButton(
                key: const Key('score-share-close'),
                tooltip: '닫기',
                onPressed: _isSharing
                    ? null
                    : () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close_rounded),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Expanded(
            child: SingleChildScrollView(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: RepaintBoundary(
                  key: _boundaryKey,
                  child: ScoreShareCard(data: widget.data),
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              key: const Key('score-share-submit'),
              onPressed: _isSharing ? null : _share,
              icon: _isSharing
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(
                        key: Key('score-share-progress'),
                        strokeWidth: 2,
                      ),
                    )
                  : const Icon(Icons.share_rounded),
              label: Text(_isSharing ? '이미지 준비 중' : '공유하기'),
            ),
          ),
        ],
      ),
    );
  }
}
