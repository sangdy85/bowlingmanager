import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/club/share/club_result_share_card.dart';
import 'package:bowlingmanager_mobile/features/club/share/club_result_share_data.dart';
import 'package:bowlingmanager_mobile/shared/share/share_image_service.dart';
import 'package:flutter/material.dart';

Future<void> showClubResultSharePreview({
  required BuildContext context,
  required ClubResultShareData data,
  ShareImageService service = const FlutterShareImageService(),
}) {
  if (data.participants.isEmpty) {
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('공유할 경기 결과가 없습니다.')));
    return Future<void>.value();
  }
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: AppColors.surface,
    builder: (BuildContext context) => FractionallySizedBox(
      heightFactor: 0.92,
      child: ClubResultSharePreviewSheet(data: data, service: service),
    ),
  );
}

class ClubResultSharePreviewSheet extends StatefulWidget {
  const ClubResultSharePreviewSheet({
    required this.data,
    required this.service,
    super.key,
  });

  final ClubResultShareData data;
  final ShareImageService service;

  @override
  State<ClubResultSharePreviewSheet> createState() =>
      _ClubResultSharePreviewSheetState();
}

class _ClubResultSharePreviewSheetState
    extends State<ClubResultSharePreviewSheet> {
  final GlobalKey _boundaryKey = GlobalKey();
  bool _maskNames = true;
  bool _isSharing = false;

  Future<void> _share() async {
    if (_isSharing) return;
    setState(() => _isSharing = true);
    try {
      final String? clubName = widget.data.clubName;
      final String shareText = clubName == null
          ? 'BowlingManager 동호회 경기 결과입니다.'
          : '$clubName 경기 결과입니다.';
      await widget.service.share(
        _boundaryKey,
        fileName: 'bowlingmanager-club-result.png',
        text: shareText,
      );
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
                key: const Key('club-result-share-close'),
                tooltip: '닫기',
                onPressed: _isSharing
                    ? null
                    : () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close_rounded),
              ),
            ],
          ),
          SwitchListTile(
            key: const Key('club-result-share-mask'),
            contentPadding: EdgeInsets.zero,
            title: const Text('이름 가리기'),
            subtitle: const Text('공유 이미지에서 참가자 이름을 가립니다.'),
            value: _maskNames,
            onChanged: _isSharing
                ? null
                : (bool value) => setState(() => _maskNames = value),
          ),
          const SizedBox(height: 6),
          Expanded(
            child: SingleChildScrollView(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: RepaintBoundary(
                  key: _boundaryKey,
                  child: ClubResultShareCard(
                    data: widget.data,
                    maskNames: _maskNames,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              key: const Key('club-result-share-submit'),
              onPressed: _isSharing ? null : _share,
              icon: _isSharing
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(
                        key: Key('club-result-share-progress'),
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
