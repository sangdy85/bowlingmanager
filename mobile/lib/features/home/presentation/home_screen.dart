import 'dart:math' as math;

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/core/domain/game_session.dart';
import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/features/home/domain/dashboard.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:bowlingmanager_mobile/shared/widgets/bowling_medal.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthUser? user = ref.watch(authControllerProvider).user;
    if (user == null) {
      return const _HomeLoading(userName: '볼러');
    }
    final String userName = user.name?.trim().isNotEmpty == true
        ? user.name!.trim()
        : '볼러';

    final AsyncValue<Dashboard> dashboard = ref.watch(
      dashboardProvider(user.id),
    );
    return dashboard.when(
      data: (Dashboard data) => _DashboardContent(
        dashboard: data,
        userName: userName,
        onRefresh: () => ref.refresh(dashboardProvider(user.id).future),
      ),
      error: (Object error, StackTrace stackTrace) => _HomeError(
        userName: userName,
        message: _dashboardErrorMessage(error),
        onRetry: () => ref.invalidate(dashboardProvider(user.id)),
      ),
      loading: () => _HomeLoading(userName: userName),
    );
  }
}

class _DashboardContent extends StatelessWidget {
  const _DashboardContent({
    required this.dashboard,
    required this.userName,
    required this.onRefresh,
  });

  final Dashboard dashboard;
  final String userName;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final Iterable<GameSession> recentSessions = dashboard.recentSessions.take(
      3,
    );

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
        children: <Widget>[
          _HomeHeader(userName: userName),
          const SizedBox(height: 26),
          Row(
            children: <Widget>[
              Expanded(
                child: _SummaryCard(
                  label: '정기전 AVG',
                  value: _formatAverage(dashboard.regularAverage),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _SummaryCard(
                  label: '공식전 AVG',
                  value: _formatAverage(dashboard.officialAverage),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _SummaryCard(
                  label: '게임 수',
                  value: '${dashboard.totalGameCount}',
                ),
              ),
            ],
          ),
          const SizedBox(height: 28),
          const _SectionTitle(title: '나의 동호회 성과'),
          const SizedBox(height: 12),
          if (dashboard.clubAchievements.isEmpty)
            const _EmptyAchievementCard()
          else
            for (final DashboardClubAchievement achievement
                in dashboard.clubAchievements) ...<Widget>[
              _ClubAchievementCard(achievement: achievement),
              const SizedBox(height: 10),
            ],
          const SizedBox(height: 28),
          const _SectionTitle(title: '나의 기록실'),
          const SizedBox(height: 12),
          _RadarCard(radar: dashboard.profileRadar),
          const SizedBox(height: 28),
          const _SectionTitle(title: '최근 경기 AVG'),
          const SizedBox(height: 12),
          _TrendCard(sessions: dashboard.recentSessions),
          const SizedBox(height: 28),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              const Text('최근 경기', style: AppTextStyles.title),
              TextButton(
                onPressed: () => context.go('/records'),
                child: const Text('기록 보기'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (dashboard.recentSessions.isEmpty)
            const _EmptyRecentCard()
          else
            for (final GameSession session in recentSessions) ...<Widget>[
              _RecentGameCard(session: session),
              const SizedBox(height: 10),
            ],
          const SizedBox(height: 18),
          const _SectionTitle(title: '나의 입상'),
          const SizedBox(height: 12),
          _MedalsCard(medals: dashboard.medals),
          const SizedBox(height: 28),
          const _SectionTitle(title: '개인 상세 통계'),
          const SizedBox(height: 12),
          _PersonalStatsCard(stats: dashboard.personalStats),
          const SizedBox(height: 28),
          const _SectionTitle(title: '팀 기록'),
          const SizedBox(height: 12),
          if (dashboard.teamSummaries.isEmpty)
            const _EmptyTeamCard()
          else
            for (final DashboardTeamSummary team
                in dashboard.teamSummaries) ...<Widget>[
              _TeamSummaryCard(team: team),
              const SizedBox(height: 10),
            ],
        ],
      ),
    );
  }
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({required this.userName});

  final String userName;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: <Widget>[
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text('안녕하세요,\n$userName님 👋', style: AppTextStyles.headline),
              const SizedBox(height: 5),
              const Text(
                '오늘도 좋은 게임을 준비해볼까요?',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
        Container(
          width: 44,
          height: 44,
          decoration: const BoxDecoration(
            color: AppColors.surfaceElevated,
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.notifications_none_rounded,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _HomeLoading extends StatelessWidget {
  const _HomeLoading({required this.userName});

  final String userName;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
      children: <Widget>[
        _HomeHeader(userName: userName),
        const SizedBox(height: 96),
        const Center(child: CircularProgressIndicator()),
      ],
    );
  }
}

class _HomeError extends StatelessWidget {
  const _HomeError({
    required this.userName,
    required this.message,
    required this.onRetry,
  });

  final String userName;
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
      children: <Widget>[
        _HomeHeader(userName: userName),
        const SizedBox(height: 36),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: <Widget>[
                const Icon(
                  Icons.cloud_off_rounded,
                  color: AppColors.textSecondary,
                  size: 36,
                ),
                const SizedBox(height: 14),
                Text(message, textAlign: TextAlign.center),
                const SizedBox(height: 18),
                FilledButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('다시 시도'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 8),
        child: Column(
          children: <Widget>[
            Text(
              label,
              style: AppTextStyles.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 7),
            Text(
              value,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 22,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ClubAchievementCard extends StatelessWidget {
  const _ClubAchievementCard({required this.achievement});

  final DashboardClubAchievement achievement;

  @override
  Widget build(BuildContext context) {
    return Card(
      key: Key('club-achievement-${achievement.teamId}'),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () =>
            context.go('/club/${Uri.encodeComponent(achievement.teamId)}'),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      achievement.teamName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.textSecondary,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (!achievement.enabled || achievement.seasonName == null)
                const Text(
                  '진행 중인 시즌 성과가 없습니다.',
                  style: TextStyle(color: AppColors.textSecondary),
                )
              else ...<Widget>[
                Text(
                  '${achievement.seasonName} · '
                  '${achievement.rank == null ? '순위 없음' : '${achievement.rank}위'} · '
                  '${achievement.points}P',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                if (achievement.gold + achievement.silver + achievement.bronze >
                    0) ...<Widget>[
                  const SizedBox(height: 6),
                  Text(
                    '입상 ${achievement.gold}/${achievement.silver}/${achievement.bronze}',
                    style: const TextStyle(color: AppColors.textSecondary),
                  ),
                ],
                if (achievement.bowlerHiddenEnabled) ...<Widget>[
                  const SizedBox(height: 6),
                  Text(
                    '개인 ${achievement.individualPoints ?? 0}P · '
                    '팀 ${achievement.teamPoints ?? 0}P · '
                    '이벤트 ${achievement.eventPoints ?? 0}P',
                    style: const TextStyle(color: AppColors.textSecondary),
                  ),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyAchievementCard extends StatelessWidget {
  const _EmptyAchievementCard();

  @override
  Widget build(BuildContext context) => const Card(
    child: Padding(
      padding: EdgeInsets.all(20),
      child: Text(
        '표시할 동호회 성과가 없습니다.',
        style: TextStyle(color: AppColors.textSecondary),
      ),
    ),
  );
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) => Text(title, style: AppTextStyles.title);
}

class _RadarCard extends StatelessWidget {
  const _RadarCard({required this.radar});
  final DashboardRadar radar;

  @override
  Widget build(BuildContext context) {
    if (radar.axes.length != 5 || radar.series.isEmpty) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 22, vertical: 30),
          child: Column(
            children: <Widget>[
              Icon(
                Icons.radar_rounded,
                color: AppColors.textSecondary,
                size: 38,
              ),
              SizedBox(height: 12),
              Text(
                '오각형 분석에는 정기전 또는 공식 경기 3회 이상의 기록이 필요합니다.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      );
    }
    final String semantics = radar.series
        .map((DashboardRadarSeries series) {
          final values = <String>[
            for (int index = 0; index < radar.axes.length; index += 1)
              '${radar.axes[index].label} ${series.values[index].toStringAsFixed(1)}',
          ];
          return '${series.label}: ${values.join(', ')}';
        })
        .join('. ');
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 18, 12, 18),
        child: Column(
          children: <Widget>[
            Semantics(
              label: semantics,
              image: true,
              child: ExcludeSemantics(
                child: AspectRatio(
                  aspectRatio: 1.05,
                  child: CustomPaint(painter: _RadarPainter(radar)),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 16,
              runSpacing: 8,
              children: radar.series
                  .map((DashboardRadarSeries series) {
                    final Color color = _hexColor(series.color);
                    return Row(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Container(
                          width: 18,
                          height: 5,
                          decoration: BoxDecoration(
                            color: color,
                            borderRadius: BorderRadius.circular(99),
                          ),
                        ),
                        const SizedBox(width: 7),
                        Text(
                          series.label,
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    );
                  })
                  .toList(growable: false),
            ),
          ],
        ),
      ),
    );
  }
}

class _RadarPainter extends CustomPainter {
  const _RadarPainter(this.radar);
  final DashboardRadar radar;

  @override
  void paint(Canvas canvas, Size size) {
    final Offset center = Offset(size.width / 2, size.height / 2 + 4);
    final double radius = math.min(size.width, size.height) * 0.32;
    final Paint grid = Paint()
      ..color = AppColors.divider
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (int level = 1; level <= 5; level += 1) {
      canvas.drawPath(_polygon(center, radius * level / 5, null), grid);
    }
    for (int index = 0; index < 5; index += 1) {
      canvas.drawLine(center, _point(center, radius, index), grid);
      final Offset labelPoint = _point(center, radius + 27, index);
      final TextPainter label = TextPainter(
        text: TextSpan(
          text: radar.axes[index].label,
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
        textDirection: TextDirection.ltr,
        textAlign: TextAlign.center,
        maxLines: 2,
      )..layout(maxWidth: 72);
      label.paint(
        canvas,
        Offset(
          labelPoint.dx - label.width / 2,
          labelPoint.dy - label.height / 2,
        ),
      );
    }
    for (final DashboardRadarSeries series in radar.series) {
      final Color color = _hexColor(series.color);
      final Path path = _polygon(center, radius, series.values);
      canvas.drawPath(
        path,
        Paint()
          ..color = color.withValues(alpha: 0.2)
          ..style = PaintingStyle.fill,
      );
      canvas.drawPath(
        path,
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.2,
      );
      for (int index = 0; index < 5; index += 1) {
        canvas.drawCircle(
          _point(center, radius * series.values[index] / 10, index),
          3,
          Paint()..color = color,
        );
      }
    }
  }

  Path _polygon(Offset center, double radius, List<double>? values) {
    final Path path = Path();
    for (int index = 0; index < 5; index += 1) {
      final double scaled = values == null
          ? radius
          : radius * values[index] / 10;
      final Offset point = _point(center, scaled, index);
      if (index == 0) {
        path.moveTo(point.dx, point.dy);
      } else {
        path.lineTo(point.dx, point.dy);
      }
    }
    return path..close();
  }

  Offset _point(Offset center, double radius, int index) {
    final double angle = -math.pi / 2 + index * math.pi * 2 / 5;
    return Offset(
      center.dx + math.cos(angle) * radius,
      center.dy + math.sin(angle) * radius,
    );
  }

  @override
  bool shouldRepaint(covariant _RadarPainter oldDelegate) =>
      oldDelegate.radar != radar;
}

class _MedalsCard extends StatelessWidget {
  const _MedalsCard({required this.medals});
  final DashboardMedals medals;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 20),
        child: Row(
          children: <Widget>[
            _MedalCount(position: 1, label: '금', count: medals.goldCount),
            _MedalCount(position: 2, label: '은', count: medals.silverCount),
            _MedalCount(position: 3, label: '동', count: medals.bronzeCount),
          ],
        ),
      ),
    );
  }
}

class _MedalCount extends StatelessWidget {
  const _MedalCount({
    required this.position,
    required this.label,
    required this.count,
  });
  final int position;
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Semantics(
        label: '$label메달 $count회',
        child: Column(
          children: <Widget>[
            BowlingMedalIcon(position: position, size: 34),
            const SizedBox(height: 6),
            Text(
              '$count',
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 22,
                fontWeight: FontWeight.w900,
              ),
            ),
            Text(
              '$label메달',
              style: const TextStyle(color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

class _PersonalStatsCard extends StatelessWidget {
  const _PersonalStatsCard({required this.stats});
  final DashboardPersonalStats stats;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          children: <Widget>[
            _CategoryStatsRow(label: '정기전', stats: stats.regular),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 15),
              child: Divider(height: 1),
            ),
            _CategoryStatsRow(label: '공식 경기', stats: stats.official),
          ],
        ),
      ),
    );
  }
}

class _CategoryStatsRow extends StatelessWidget {
  const _CategoryStatsRow({required this.label, required this.stats});
  final String label;
  final DashboardCategoryStats stats;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: const TextStyle(
            color: AppColors.primaryBright,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: <Widget>[
            _CompactMetric(
              label: 'AVG',
              value: stats.average.toStringAsFixed(1),
            ),
            _CompactMetric(label: 'HIGH', value: '${stats.highScore}'),
            _CompactMetric(label: 'GAMES', value: '${stats.gameCount}'),
          ],
        ),
      ],
    );
  }
}

class _CompactMetric extends StatelessWidget {
  const _CompactMetric({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: <Widget>[
          Text(label, style: AppTextStyles.label),
          const SizedBox(height: 5),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _TeamSummaryCard extends StatelessWidget {
  const _TeamSummaryCard({required this.team});
  final DashboardTeamSummary team;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => context.go('/club/${team.id}/records?section=statistics'),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      team.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    team.myRole.label,
                    style: const TextStyle(
                      color: AppColors.primaryBright,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.textSecondary,
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 14,
                runSpacing: 8,
                children: <Widget>[
                  Text('정기전 ${team.attended}회 참가'),
                  Text('${team.gameCount}게임'),
                  Text(
                    'AVG ${team.average.toStringAsFixed(1)}',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  Text('출석 ${team.attendanceRate.toStringAsFixed(1)}%'),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyTeamCard extends StatelessWidget {
  const _EmptyTeamCard();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 20, vertical: 28),
        child: Center(
          child: Text(
            '가입한 동호회가 없습니다.',
            style: TextStyle(color: AppColors.textSecondary),
          ),
        ),
      ),
    );
  }
}

class _TrendCard extends StatelessWidget {
  const _TrendCard({required this.sessions});

  final List<GameSession> sessions;

  @override
  Widget build(BuildContext context) {
    if (sessions.isEmpty) {
      return const Card(
        child: SizedBox(
          height: 120,
          child: Center(
            child: Text(
              '최근 기록이 없습니다.',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
        ),
      );
    }

    final List<GameSession> visibleSessions = sessions
        .take(7)
        .toList(growable: false)
        .reversed
        .toList(growable: false);
    final double chartMaximum = visibleSessions.fold<double>(
      300,
      (maximum, session) =>
          session.average > maximum ? session.average : maximum,
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
        child: SizedBox(
          height: 120,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: visibleSessions.asMap().entries.map((
              MapEntry<int, GameSession> entry,
            ) {
              final bool latest = entry.key == visibleSessions.length - 1;
              final double heightFactor = (entry.value.average / chartMaximum)
                  .clamp(0.04, 1.0)
                  .toDouble();
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 5),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: <Widget>[
                      Expanded(
                        child: Align(
                          alignment: Alignment.bottomCenter,
                          child: FractionallySizedBox(
                            heightFactor: heightFactor,
                            child: Container(
                              decoration: BoxDecoration(
                                color: latest
                                    ? AppColors.primaryBright
                                    : AppColors.surfaceElevated,
                                borderRadius: BorderRadius.circular(6),
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        entry.value.average.toStringAsFixed(1),
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}

class _RecentGameCard extends StatelessWidget {
  const _RecentGameCard({required this.session});

  final GameSession session;

  @override
  Widget build(BuildContext context) {
    final String gameType = session.gameType?.trim().isNotEmpty == true
        ? session.gameType!.trim()
        : session.source.label;
    final String teamName = session.team?.name.trim().isNotEmpty == true
        ? session.team!.name.trim()
        : '개인 기록';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(99),
              ),
              child: Text(
                gameType,
                style: const TextStyle(
                  color: AppColors.primaryBright,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              teamName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 17,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              _formatDate(session.gameDate),
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: session.scores
                  .map(
                    (GameSessionScore item) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 11,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceElevated,
                        borderRadius: BorderRadius.circular(9),
                        border: Border.all(color: AppColors.divider),
                      ),
                      child: Text(
                        '${item.score}',
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  )
                  .toList(growable: false),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 18,
              runSpacing: 8,
              children: <Widget>[
                Text('${session.gameCount}게임'),
                Text(
                  '총점 ${session.total}',
                  style: const TextStyle(
                    color: AppColors.primaryBright,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'AVG ${session.average.toStringAsFixed(1)}',
                  style: const TextStyle(
                    color: AppColors.primaryBright,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyRecentCard extends StatelessWidget {
  const _EmptyRecentCard();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 30, horizontal: 20),
        child: Center(
          child: Text(
            '최근 기록이 없습니다.',
            style: TextStyle(color: AppColors.textSecondary),
          ),
        ),
      ),
    );
  }
}

String _dashboardErrorMessage(Object error) {
  return error is ApiException
      ? error.userMessage
      : '대시보드 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
}

String _formatAverage(double value) {
  return value.toStringAsFixed(1);
}

String _formatDate(DateTime value) {
  String twoDigits(int number) => number.toString().padLeft(2, '0');
  return '${value.year}.${twoDigits(value.month)}.${twoDigits(value.day)}';
}

Color _hexColor(String value) =>
    Color(int.parse(value.substring(1), radix: 16) | 0xFF000000);
