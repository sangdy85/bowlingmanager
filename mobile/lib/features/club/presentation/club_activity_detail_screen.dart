import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_management_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_records_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_screen.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/features/records/application/records_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubActivityDetailScreen extends ConsumerStatefulWidget {
  const ClubActivityDetailScreen({
    required this.teamId,
    required this.activityId,
    super.key,
  });

  final String teamId;
  final String activityId;

  @override
  ConsumerState<ClubActivityDetailScreen> createState() =>
      _ClubActivityDetailScreenState();
}

class _ClubActivityDetailScreenState
    extends ConsumerState<ClubActivityDetailScreen> {
  bool _deleting = false;

  @override
  Widget build(BuildContext context) {
    final AuthUser? user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final ClubActivityRequest request = (
      userId: user.id,
      teamId: widget.teamId,
      activityId: widget.activityId,
    );
    final provider = clubActivityProvider(request);
    final AsyncValue<ClubActivityDetail> value = ref.watch(provider);
    final detail = ref.watch(
      clubDetailProvider((userId: user.id, teamId: widget.teamId)),
    );
    final bool canManage =
        detail.value?.myRole == ClubRole.owner ||
        detail.value?.myRole == ClubRole.manager;
    return value.when(
      loading: () => const _Frame(child: CircularProgressIndicator()),
      error: (Object error, StackTrace stackTrace) => _Frame(
        child: ClubErrorCard(
          message: clubErrorMessage(error),
          onRetry: () => ref.refresh(provider.future),
        ),
      ),
      data: (ClubActivityDetail activity) => RefreshIndicator(
        onRefresh: () => ref.refresh(provider.future),
        child: ListView(
          key: const Key('club-activity-detail'),
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
          children: <Widget>[
            _Header(
              canManage: canManage,
              onEdit: () => context.push(
                '/club/${Uri.encodeComponent(widget.teamId)}/records/${Uri.encodeComponent(widget.activityId)}/edit',
              ),
              onDelete: _deleting
                  ? null
                  : () => _deleteActivity(context, user.id, activity),
            ),
            const SizedBox(height: 18),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      activity.gameType?.trim().isNotEmpty == true
                          ? activity.gameType!
                          : '기록',
                      style: AppTextStyles.headline,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _date(activity.date),
                      style: const TextStyle(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 15),
                    Text(
                      '${activity.participantCount}명 참가 · '
                      '${activity.gameCount}게임 · '
                      'Daily AVG ${activity.dailyAverage.toStringAsFixed(1)}',
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            for (final ClubActivityParticipant participant
                in activity.participants) ...[
              _ParticipantCard(participant: participant),
              const SizedBox(height: 12),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _deleteActivity(
    BuildContext context,
    String userId,
    ClubActivityDetail activity,
  ) async {
    if (_deleting) return;
    setState(() => _deleting = true);
    try {
      final ClubActivityEditEnvelope editable = await ref
          .read(clubRepositoryProvider)
          .fetchEditableActivity(
            teamId: widget.teamId,
            activityId: widget.activityId,
          );
      if (!context.mounted) return;
      final bool confirmed =
          await showDialog<bool>(
            context: context,
            builder: (BuildContext dialogContext) => AlertDialog(
              title: const Text('활동 기록 삭제'),
              content: Text(
                '${_date(activity.date)} ${activity.gameType ?? '기록'} 기록을 삭제할까요?\n'
                '${editable.activity.scoreCount}개의 점수가 삭제됩니다.',
              ),
              actions: <Widget>[
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext, false),
                  child: const Text('취소'),
                ),
                FilledButton(
                  key: const Key('activity-delete-confirm'),
                  onPressed: () => Navigator.pop(dialogContext, true),
                  child: const Text('삭제'),
                ),
              ],
            ),
          ) ??
          false;
      if (!confirmed) return;
      await ref
          .read(clubRepositoryProvider)
          .deleteActivity(
            teamId: widget.teamId,
            activityId: widget.activityId,
            revision: editable.activity.revision,
          );
      ref.invalidate(clubStatisticsProvider);
      ref.invalidate(clubActivitiesControllerProvider);
      ref.invalidate(clubActivityFeedControllerProvider);
      ref.invalidate(clubActivityProvider);
      ref.invalidate(clubActivityEditProvider);
      ref.invalidate(dashboardProvider(userId));
      ref.invalidate(recordsControllerProvider(userId));
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('활동 기록을 삭제했습니다.')));
        context.pop();
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
      }
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }
}

class _Frame extends StatelessWidget {
  const _Frame({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
      children: <Widget>[
        const _Header(),
        const SizedBox(height: 72),
        Center(child: child),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({this.canManage = false, this.onEdit, this.onDelete});

  final bool canManage;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        IconButton(
          key: const Key('club-activity-back'),
          onPressed: context.pop,
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        const SizedBox(width: 6),
        const Text('경기 상세', style: AppTextStyles.title),
        const Spacer(),
        if (canManage) ...<Widget>[
          IconButton(
            key: const Key('activity-edit'),
            onPressed: onEdit,
            tooltip: '수정',
            icon: const Icon(Icons.edit_outlined),
          ),
          IconButton(
            key: const Key('activity-delete'),
            onPressed: onDelete,
            tooltip: '삭제',
            icon: const Icon(Icons.delete_outline_rounded),
          ),
        ],
      ],
    );
  }
}

class _ParticipantCard extends StatelessWidget {
  const _ParticipantCard({required this.participant});

  final ClubActivityParticipant participant;

  @override
  Widget build(BuildContext context) {
    return Card(
      key: Key('club-activity-participant-${participant.id}'),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Container(
                  width: 38,
                  height: 38,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.primary,
                  ),
                  child: Text(
                    '${participant.rank}위',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    participant.name,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: participant.scores
                  .asMap()
                  .entries
                  .map(
                    (MapEntry<int, int> entry) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 11,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceElevated,
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: Text('${entry.key + 1}G ${entry.value}'),
                    ),
                  )
                  .toList(growable: false),
            ),
            const SizedBox(height: 15),
            Text(
              '총점 ${participant.total} · '
              'AVG ${_participantAverage(participant.average)}',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ],
        ),
      ),
    );
  }
}

String _date(DateTime value) =>
    '${value.year}.${value.month.toString().padLeft(2, '0')}.'
    '${value.day.toString().padLeft(2, '0')}';

String _participantAverage(double value) =>
    value.toStringAsFixed(2).replaceFirst(RegExp(r'\.?0+$'), '');
