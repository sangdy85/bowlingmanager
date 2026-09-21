import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/features/home/domain/dashboard.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthUser? user = ref.watch(authControllerProvider).user;
    if (user == null) {
      return const _HomeLoading(userName: '볼러님');
    }

    final AsyncValue<Dashboard> dashboard = ref.watch(
      dashboardProvider(user.id),
    );
    return dashboard.when(
      data: (Dashboard data) =>
          _DashboardContent(dashboard: data, userName: '볼러님'),
      error: (Object error, StackTrace stackTrace) => _HomeError(
        userName: '볼러님',
        message: _dashboardErrorMessage(error),
        onRetry: () => ref.invalidate(dashboardProvider(user.id)),
      ),
      loading: () => const _HomeLoading(userName: '볼러님'),
    );
  }
}

class _DashboardContent extends StatelessWidget {
  const _DashboardContent({required this.dashboard, required this.userName});

  final Dashboard dashboard;
  final String userName;

  @override
  Widget build(BuildContext context) {
    final Iterable<DashboardScore> recentScores = dashboard.recentScores.take(
      3,
    );

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
      children: <Widget>[
        _HomeHeader(userName: userName),
        const SizedBox(height: 26),
        _AverageCard(
          average: dashboard.average,
          recentAverage: dashboard.recentAverage,
        ),
        const SizedBox(height: 14),
        Row(
          children: <Widget>[
            Expanded(
              child: _SummaryCard(
                label: 'HIGH',
                value: '${dashboard.highScore}',
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _SummaryCard(
                label: 'GAMES',
                value: '${dashboard.gameCount}',
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _SummaryCard(
                label: 'RECENT AVG',
                value: _formatAverage(dashboard.recentAverage),
              ),
            ),
          ],
        ),
        const SizedBox(height: 28),
        const Text('최근 점수', style: AppTextStyles.title),
        const SizedBox(height: 12),
        _TrendCard(scores: dashboard.recentScores),
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
        if (dashboard.recentScores.isEmpty)
          const _EmptyRecentCard()
        else
          for (final DashboardScore score in recentScores) ...<Widget>[
            _RecentGameCard(score: score),
            const SizedBox(height: 10),
          ],
      ],
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
              Text('안녕하세요, $userName', style: AppTextStyles.headline),
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

class _AverageCard extends StatelessWidget {
  const _AverageCard({required this.average, required this.recentAverage});

  final double average;
  final double recentAverage;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[Color(0xFF173B63), Color(0xFF10263D)],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFF27517A)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const Text('CURRENT AVG', style: AppTextStyles.label),
                const SizedBox(height: 12),
                Text(
                  _formatAverage(average),
                  style: AppTextStyles.displayScore,
                ),
              ],
            ),
          ),
          DecoratedBox(
            decoration: const BoxDecoration(
              color: Color(0x263FD7A4),
              borderRadius: BorderRadius.all(Radius.circular(20)),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  const Icon(
                    Icons.history_rounded,
                    color: AppColors.success,
                    size: 17,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '최근 ${_formatAverage(recentAverage)}',
                    style: const TextStyle(
                      color: AppColors.success,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
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

class _TrendCard extends StatelessWidget {
  const _TrendCard({required this.scores});

  final List<DashboardScore> scores;

  @override
  Widget build(BuildContext context) {
    if (scores.isEmpty) {
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

    final List<DashboardScore> visibleScores = scores
        .take(7)
        .toList(growable: false)
        .reversed
        .toList(growable: false);
    final double chartMaximum = visibleScores.fold<double>(
      300,
      (maximum, record) =>
          record.score > maximum ? record.score.toDouble() : maximum,
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
        child: SizedBox(
          height: 120,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: visibleScores.asMap().entries.map((
              MapEntry<int, DashboardScore> entry,
            ) {
              final bool latest = entry.key == visibleScores.length - 1;
              final double heightFactor = (entry.value.score / chartMaximum)
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
                        '${entry.value.score}',
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
  const _RecentGameCard({required this.score});

  final DashboardScore score;

  @override
  Widget build(BuildContext context) {
    final List<String> details = <String>[
      score.source.label,
      if (score.gameType?.trim().isNotEmpty == true) score.gameType!.trim(),
      if (score.team?.name.trim().isNotEmpty == true) score.team!.name.trim(),
    ];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              _formatDate(score.gameDate),
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: <Widget>[
                Text(
                  '${score.score}',
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 30,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    details.isEmpty ? '개인 게임' : details.join(' · '),
                    textAlign: TextAlign.right,
                    style: const TextStyle(color: AppColors.textSecondary),
                  ),
                ),
              ],
            ),
            if (score.memo?.trim().isNotEmpty == true) ...<Widget>[
              const SizedBox(height: 12),
              Text(
                score.memo!.trim(),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: AppColors.textSecondary),
              ),
            ],
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
  final DateTime local = value.toLocal();
  String twoDigits(int number) => number.toString().padLeft(2, '0');
  return '${local.year}.${twoDigits(local.month)}.${twoDigits(local.day)}';
}
