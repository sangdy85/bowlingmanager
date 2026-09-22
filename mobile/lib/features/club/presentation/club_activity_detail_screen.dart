import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_records_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubActivityDetailScreen extends ConsumerWidget {
  const ClubActivityDetailScreen({
    required this.teamId,
    required this.activityId,
    super.key,
  });

  final String teamId;
  final String activityId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthUser? user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final ClubActivityRequest request = (
      userId: user.id,
      teamId: teamId,
      activityId: activityId,
    );
    final provider = clubActivityProvider(request);
    final AsyncValue<ClubActivityDetail> value = ref.watch(provider);
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
            const _Header(),
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
  const _Header();

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
