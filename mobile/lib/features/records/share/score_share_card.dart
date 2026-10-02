import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/features/records/share/score_share_data.dart';
import 'package:flutter/material.dart';

class ScoreShareCard extends StatelessWidget {
  const ScoreShareCard({required this.data, super.key});

  static const double logicalWidth = 360;

  final ScoreShareData data;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      key: const Key('score-share-card'),
      width: logicalWidth,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.divider),
        ),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              const Text(
                'BOWLING MANAGER',
                style: TextStyle(
                  color: AppColors.primaryBright,
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                '나의 볼링 기록',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 27,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.7,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                data.displayName,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 21,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 14),
              _InfoRow(label: 'DATE', value: data.dateLabel),
              const SizedBox(height: 7),
              _InfoRow(label: 'TYPE', value: data.gameTypeLabel),
              const SizedBox(height: 7),
              _InfoRow(label: 'TEAM', value: data.teamLabel),
              const SizedBox(height: 24),
              const Divider(height: 1, color: AppColors.divider),
              const SizedBox(height: 20),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: <Widget>[
                  for (int index = 0; index < data.scores.length; index++)
                    _ScoreTile(index: index, score: data.scores[index]),
                ],
              ),
              const SizedBox(height: 22),
              Row(
                children: <Widget>[
                  Expanded(
                    child: _SummaryMetric(
                      label: 'TOTAL',
                      value: '${data.total}',
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _SummaryMetric(
                      label: 'AVG',
                      value: data.average.toStringAsFixed(1),
                      emphasized: true,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _SummaryMetric(label: 'HIGH', value: '${data.high}'),
                  ),
                ],
              ),
              if (data.rankPosition != null &&
                  data.rankParticipantCount != null) ...<Widget>[
                const SizedBox(height: 16),
                Container(
                  key: const Key('score-share-rank'),
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 11,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${data.rankPosition} / ${data.rankParticipantCount}위',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.primaryBright,
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 24),
              const Divider(height: 1, color: AppColors.divider),
              const SizedBox(height: 16),
              const Center(
                child: Column(
                  children: <Widget>[
                    Text(
                      'bowlingmanager.co.kr',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'BowlingManager에서 기록했습니다',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        SizedBox(
          width: 48,
          child: Text(
            label,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }
}

class _ScoreTile extends StatelessWidget {
  const _ScoreTile({required this.index, required this.score});

  final int index;
  final int score;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: Key('score-share-score-$index'),
      width: 98,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 13),
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.divider),
      ),
      child: Column(
        children: <Widget>[
          Text(
            '${index + 1}G',
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '$score',
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 24,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryMetric extends StatelessWidget {
  const _SummaryMetric({
    required this.label,
    required this.value,
    this.emphasized = false,
  });

  final String label;
  final String value;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 10,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.7,
          ),
        ),
        const SizedBox(height: 5),
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            value,
            style: TextStyle(
              color: emphasized
                  ? AppColors.primaryBright
                  : AppColors.textPrimary,
              fontSize: 22,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      ],
    );
  }
}
