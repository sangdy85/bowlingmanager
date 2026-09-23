import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_management_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_score_form.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/features/records/application/records_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubManualScoreScreen extends ConsumerStatefulWidget {
  const ClubManualScoreScreen({required this.teamId, super.key});
  final String teamId;

  @override
  ConsumerState<ClubManualScoreScreen> createState() =>
      _ClubManualScoreScreenState();
}

class _ClubManualScoreScreenState extends ConsumerState<ClubManualScoreScreen> {
  bool _saving = false;
  String? _error;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final request = (userId: user.id, teamId: widget.teamId);
    final detail = ref.watch(clubDetailProvider(request));
    final members = ref.watch(clubMembersProvider(request));
    if (detail.isLoading || members.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (detail.hasError || members.hasError) {
      return Center(
        child: Text(clubErrorMessage(detail.error ?? members.error!)),
      );
    }
    final ClubDetail club = detail.requireValue;
    if (club.myRole == ClubRole.member) {
      return const Center(child: Text('관리 권한이 없습니다.'));
    }

    return ListView(
      key: const Key('club-manual-score'),
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
      children: <Widget>[
        Row(
          children: <Widget>[
            IconButton(
              onPressed: context.pop,
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            const SizedBox(width: 6),
            const Text('점수 직접 입력', style: AppTextStyles.title),
          ],
        ),
        const SizedBox(height: 18),
        ClubScoreForm(
          members: members.requireValue,
          initialDate: formatClubDate(DateTime.now()),
          initialGameType: clubGameTypes.first,
          initialMemo: null,
          initialParticipants: const <ClubParticipantDraft>[],
          isSaving: _saving,
          submitLabel: '점수 저장',
          onSubmit: (ClubScoreFormValue value) => _save(user.id, value),
        ),
        if (_error != null) ...<Widget>[
          const SizedBox(height: 12),
          Text(
            _error!,
            key: const Key('manual-save-error'),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.redAccent),
          ),
        ],
      ],
    );
  }

  Future<void> _save(String userId, ClubScoreFormValue value) async {
    if (_saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final result = await ref
          .read(clubRepositoryProvider)
          .createScores(
            teamId: widget.teamId,
            date: value.date,
            gameType: value.gameType,
            memo: value.memo,
            participants: value.participants,
          );
      _invalidate(userId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${result.changedCount ?? 0}건을 저장했습니다.')),
        );
        context.pop();
      }
    } catch (error) {
      if (mounted) setState(() => _error = clubErrorMessage(error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _invalidate(String userId) {
    ref.invalidate(clubStatisticsProvider);
    ref.invalidate(clubActivitiesControllerProvider);
    ref.invalidate(clubActivityFeedControllerProvider);
    ref.invalidate(clubActivityProvider);
    ref.invalidate(clubActivityEditProvider);
    ref.invalidate(
      clubMembersProvider((userId: userId, teamId: widget.teamId)),
    );
    ref.invalidate(clubDetailProvider((userId: userId, teamId: widget.teamId)));
    ref.invalidate(clubListProvider(userId));
    ref.invalidate(dashboardProvider(userId));
    ref.invalidate(recordsControllerProvider(userId));
  }
}
