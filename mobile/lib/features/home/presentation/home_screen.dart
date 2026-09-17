import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
      children: <Widget>[
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: <Widget>[
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text('안녕하세요, 볼러님', style: AppTextStyles.headline),
                SizedBox(height: 5),
                Text(
                  '오늘도 좋은 게임을 준비해볼까요?',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
              ],
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
        ),
        const SizedBox(height: 26),
        const _AverageCard(),
        const SizedBox(height: 14),
        const Row(
          children: <Widget>[
            Expanded(
              child: _SummaryCard(label: 'HIGH', value: '245'),
            ),
            SizedBox(width: 10),
            Expanded(
              child: _SummaryCard(label: 'GAMES', value: '36'),
            ),
            SizedBox(width: 10),
            Expanded(
              child: _SummaryCard(label: 'SERIES', value: '612'),
            ),
          ],
        ),
        const SizedBox(height: 28),
        const Text('최근 평균', style: AppTextStyles.title),
        const SizedBox(height: 12),
        const _TrendCard(),
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
        const _RecentGameCard(),
      ],
    );
  }
}

class _AverageCard extends StatelessWidget {
  const _AverageCard();

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
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text('CURRENT AVG', style: AppTextStyles.label),
                SizedBox(height: 12),
                Text('187.4', style: AppTextStyles.displayScore),
              ],
            ),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              color: Color(0x263FD7A4),
              borderRadius: BorderRadius.all(Radius.circular(20)),
            ),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Icon(
                    Icons.trending_up_rounded,
                    color: AppColors.success,
                    size: 17,
                  ),
                  SizedBox(width: 4),
                  Text(
                    '+3.2 이번 달',
                    style: TextStyle(
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
        padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 10),
        child: Column(
          children: <Widget>[
            Text(label, style: AppTextStyles.label),
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
  const _TrendCard();

  static const List<double> _values = <double>[
    0.43,
    0.62,
    0.51,
    0.72,
    0.68,
    0.83,
    0.76,
  ];

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
        child: SizedBox(
          height: 120,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: _values.asMap().entries.map((
              MapEntry<int, double> entry,
            ) {
              final bool latest = entry.key == _values.length - 1;
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
                            heightFactor: entry.value,
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
                        '${entry.key + 1}',
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
  const _RecentGameCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Text(
              '2026.09.15',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 16),
            Row(
              children: <Widget>[
                for (final String score in <String>[
                  '201',
                  '189',
                  '215',
                ]) ...<Widget>[
                  Expanded(
                    child: Text(
                      score,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 25,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  if (score != '215')
                    const SizedBox(
                      height: 28,
                      child: VerticalDivider(color: AppColors.divider),
                    ),
                ],
              ],
            ),
            const SizedBox(height: 16),
            const Align(
              alignment: Alignment.centerRight,
              child: Text(
                'AVG 201.7',
                style: TextStyle(
                  color: AppColors.primaryBright,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
