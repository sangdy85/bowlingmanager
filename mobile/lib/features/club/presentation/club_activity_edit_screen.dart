import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_management_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_score_form.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/features/records/application/records_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubActivityEditScreen extends ConsumerStatefulWidget {
  const ClubActivityEditScreen({
    required this.teamId,
    required this.activityId,
    super.key,
  });
  final String teamId;
  final String activityId;

  @override
  ConsumerState<ClubActivityEditScreen> createState() =>
      _ClubActivityEditScreenState();
}

class _ClubActivityEditScreenState
    extends ConsumerState<ClubActivityEditScreen> {
  bool _saving = false;
  String? _error;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final request = (
      userId: user.id,
      teamId: widget.teamId,
      activityId: widget.activityId,
    );
    final memberRequest = (userId: user.id, teamId: widget.teamId);
    final edit = ref.watch(clubActivityEditProvider(request));
    final members = ref.watch(clubMembersProvider(memberRequest));
    if (edit.isLoading || members.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (edit.hasError || members.hasError) {
      return Center(
        child: Text(clubErrorMessage(edit.error ?? members.error!)),
      );
    }
    final ClubActivityEdit initial = edit.requireValue.activity;
    return ListView(
      key: const Key('club-activity-edit'),
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
      children: <Widget>[
        Row(
          children: <Widget>[
            IconButton(
              onPressed: context.pop,
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            const SizedBox(width: 6),
            const Text('활동 기록 수정', style: AppTextStyles.title),
          ],
        ),
        const SizedBox(height: 18),
        ClubScoreForm(
          key: ValueKey(initial.revision),
          members: members.requireValue,
          initialDate: initial.date,
          initialGameType: initial.gameType,
          initialMemo: initial.memo,
          initialParticipants: initial.participants,
          isSaving: _saving,
          submitLabel: '변경사항 저장',
          onSubmit: (value) => _save(user.id, initial, value),
        ),
        if (_error != null) ...<Widget>[
          const SizedBox(height: 12),
          Text(
            _error!,
            key: const Key('activity-edit-error'),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.redAccent),
          ),
        ],
      ],
    );
  }

  Future<void> _save(
    String userId,
    ClubActivityEdit initial,
    ClubScoreFormValue value,
  ) async {
    if (_saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref
          .read(clubRepositoryProvider)
          .updateActivity(
            teamId: widget.teamId,
            activity: ClubActivityEdit(
              id: initial.id,
              revision: initial.revision,
              date: value.date,
              gameType: value.gameType,
              memo: value.memo,
              scoreCount: value.participants.fold(
                0,
                (sum, item) => sum + item.scores.length,
              ),
              participants: value.participants,
            ),
          );
      _invalidate(userId);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('활동 기록을 수정했습니다.')));
        context.go('/club/${Uri.encodeComponent(widget.teamId)}/records');
      }
    } catch (error) {
      if (error is ApiException && error.code == 'ACTIVITY_CONFLICT') {
        ref.invalidate(
          clubActivityEditProvider((
            userId: userId,
            teamId: widget.teamId,
            activityId: widget.activityId,
          )),
        );
      }
      if (mounted) setState(() => _error = clubErrorMessage(error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _invalidate(String userId) {
    ref.invalidate(clubStatisticsProvider);
    ref.invalidate(clubActivitiesControllerProvider);
    ref.invalidate(clubActivityProvider);
    ref.invalidate(clubActivityEditProvider);
    ref.invalidate(
      clubMembersProvider((userId: userId, teamId: widget.teamId)),
    );
    ref.invalidate(dashboardProvider(userId));
    ref.invalidate(recordsControllerProvider(userId));
  }
}
