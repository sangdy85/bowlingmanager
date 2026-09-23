import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubMemberDetailScreen extends ConsumerWidget {
  const ClubMemberDetailScreen({
    required this.teamId,
    required this.memberId,
    super.key,
  });
  final String teamId;
  final String memberId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final request = (
      userId: user.id,
      teamId: teamId,
      memberId: memberId,
      year: DateTime.now().year,
    );
    final provider = clubMemberProfileProvider(request);
    return ref
        .watch(provider)
        .when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => ListView(
            padding: const EdgeInsets.all(20),
            children: <Widget>[
              _Header(onBack: context.pop),
              const SizedBox(height: 40),
              ClubErrorCard(
                message: clubErrorMessage(error),
                onRetry: () => ref.refresh(provider.future),
              ),
            ],
          ),
          data: (ClubMemberProfile member) => RefreshIndicator(
            onRefresh: () => ref.refresh(provider.future),
            child: ListView(
              key: const Key('club-member-detail'),
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
              children: <Widget>[
                _Header(onBack: context.pop),
                const SizedBox(height: 18),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(member.name, style: AppTextStyles.headline),
                        if (member.alias != null)
                          Text(
                            '별명 ${member.alias}',
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                            ),
                          ),
                        const SizedBox(height: 12),
                        Text(
                          '${member.role.label} · 핸디캡 ${member.handicap ?? '-'}',
                        ),
                        Text(
                          '활동 시작일 ${member.activityStartDate == null ? '기록 없음' : _date(member.activityStartDate!)}',
                        ),
                        Text('실제 가입일 ${_date(member.joinedAt)}'),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Wrap(
                      spacing: 24,
                      runSpacing: 14,
                      children: <Widget>[
                        _Metric(
                          '출석률',
                          '${member.attendanceRate.toStringAsFixed(1)}%',
                        ),
                        _Metric(
                          '참석',
                          '${member.attended}/${member.activityCount}',
                        ),
                        _Metric('게임', '${member.gameCount}'),
                        _Metric('총핀', '${member.total}'),
                        _Metric('AVG', member.average.toStringAsFixed(1)),
                        _Metric(
                          '입상',
                          '🥇${member.gold}  🥈${member.silver}  🥉${member.bronze}',
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        const Text(
                          '월별 AVG',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 12),
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: List<Widget>.generate(
                              12,
                              (index) => Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: Chip(
                                  label: Text(
                                    '${index + 1}월 ${member.monthlyAverages[index] ?? '-'}',
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  '최근 정기전 점수',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                if (member.recentScores.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(20),
                    child: Text('정기전 기록이 없습니다.'),
                  )
                else
                  for (final score in member.recentScores)
                    ListTile(
                      title: Text('${score.score}점'),
                      subtitle: Text(_date(score.date)),
                    ),
              ],
            ),
          ),
        );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onBack});
  final VoidCallback onBack;
  @override
  Widget build(BuildContext context) => Row(
    children: <Widget>[
      IconButton(onPressed: onBack, icon: const Icon(Icons.arrow_back_rounded)),
      const Text('회원 상세', style: AppTextStyles.title),
    ],
  );
}

class _Metric extends StatelessWidget {
  const _Metric(this.label, this.value);
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: <Widget>[
      Text(label, style: const TextStyle(color: AppColors.textSecondary)),
      Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
    ],
  );
}

String _date(DateTime date) =>
    '${date.year}.${date.month.toString().padLeft(2, '0')}.${date.day.toString().padLeft(2, '0')}';
