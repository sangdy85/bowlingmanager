import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/club/share/club_invite_share_card.dart';
import 'package:bowlingmanager_mobile/features/club/share/club_invite_share_data.dart';
import 'package:bowlingmanager_mobile/shared/share/share_image_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

typedef InviteClipboardWriter = Future<void> Function(String value);

Future<void> copyClubInviteUrlToClipboard(String value) =>
    Clipboard.setData(ClipboardData(text: value));

Future<void> showClubInviteSharePreview({
  required BuildContext context,
  required ClubInviteShareData data,
  ShareImageService service = const FlutterShareImageService(),
  InviteClipboardWriter clipboardWriter = copyClubInviteUrlToClipboard,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    isDismissible: false,
    enableDrag: false,
    useSafeArea: true,
    backgroundColor: AppColors.surface,
    builder: (BuildContext context) => FractionallySizedBox(
      heightFactor: 0.92,
      child: ClubInviteSharePreviewSheet(
        data: data,
        service: service,
        clipboardWriter: clipboardWriter,
      ),
    ),
  );
}

class ClubInviteSharePreviewSheet extends StatefulWidget {
  const ClubInviteSharePreviewSheet({
    required this.data,
    required this.service,
    this.clipboardWriter = copyClubInviteUrlToClipboard,
    super.key,
  });

  final ClubInviteShareData data;
  final ShareImageService service;
  final InviteClipboardWriter clipboardWriter;

  @override
  State<ClubInviteSharePreviewSheet> createState() =>
      _ClubInviteSharePreviewSheetState();
}

class _ClubInviteSharePreviewSheetState
    extends State<ClubInviteSharePreviewSheet> {
  final GlobalKey _boundaryKey = GlobalKey();
  bool _isSharing = false;
  bool _isCopying = false;

  bool get _isBusy => _isSharing || _isCopying;

  void _showInvalidUrlError() {
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('유효한 초대 링크가 아닙니다.')));
  }

  Future<void> _share() async {
    if (_isBusy) return;
    if (!isValidClubInviteUrl(widget.data.inviteUrl)) {
      _showInvalidUrlError();
      return;
    }
    setState(() => _isSharing = true);
    try {
      await widget.service.share(
        _boundaryKey,
        fileName: 'bowlingmanager-club-invite.png',
        text: widget.data.shareText,
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('초대 카드를 공유하지 못했습니다.')));
      }
    } finally {
      if (mounted) setState(() => _isSharing = false);
    }
  }

  Future<void> _copy() async {
    if (_isBusy) return;
    if (!isValidClubInviteUrl(widget.data.inviteUrl)) {
      _showInvalidUrlError();
      return;
    }
    setState(() => _isCopying = true);
    try {
      await widget.clipboardWriter(widget.data.inviteUrl);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('초대 링크를 복사했습니다.')));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('초대 링크를 복사하지 못했습니다.')));
      }
    } finally {
      if (mounted) setState(() => _isCopying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_isSharing,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
        child: Column(
          children: <Widget>[
            const Align(
              alignment: Alignment.centerLeft,
              child: Text('동호회 초대 미리보기', style: AppTextStyles.title),
            ),
            const SizedBox(height: 14),
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  children: <Widget>[
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: RepaintBoundary(
                        key: _boundaryKey,
                        child: ClubInviteShareCard(data: widget.data),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      widget.data.clubName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '회원 ${widget.data.memberCount}명',
                      style: const TextStyle(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      '링크를 받은 사람은 동호회 가입 화면으로 이동합니다.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                key: const Key('club-invite-share-submit'),
                onPressed: _isBusy ? null : _share,
                icon: _isSharing
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(
                          key: Key('club-invite-share-progress'),
                          strokeWidth: 2,
                        ),
                      )
                    : const Icon(Icons.share_rounded),
                label: Text(_isSharing ? '이미지 준비 중' : '공유하기'),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                key: const Key('club-invite-copy'),
                onPressed: _isBusy ? null : _copy,
                icon: const Icon(Icons.content_copy_rounded),
                label: Text(_isCopying ? '복사 중' : '링크 복사'),
              ),
            ),
            const SizedBox(height: 4),
            TextButton(
              key: const Key('club-invite-share-close'),
              onPressed: _isBusy ? null : () => Navigator.of(context).pop(),
              child: const Text('닫기'),
            ),
          ],
        ),
      ),
    );
  }
}
