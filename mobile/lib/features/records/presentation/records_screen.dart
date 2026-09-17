import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:flutter/material.dart';

class RecordsScreen extends StatelessWidget {
  const RecordsScreen({super.key});

  static const List<_GameRecord> _records = <_GameRecord>[
    _GameRecord('2026.09.15', <int>[201, 189, 215], 201.7),
    _GameRecord('2026.09.10', <int>[178, 192, 204], 191.3),
    _GameRecord('2026.09.03', <int>[186, 173, 198], 185.7),
  ];

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
      children: <Widget>[
        const Text('나의 기록', style: AppTextStyles.headline),
        const SizedBox(height: 6),
        const Text(
          '최근 경기 점수를 한눈에 확인하세요.',
          style: TextStyle(color: AppColors.textSecondary),
        ),
        const SizedBox(height: 24),
        for (final _GameRecord record in _records) ...<Widget>[
          _RecordCard(record: record),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class _RecordCard extends StatelessWidget {
  const _RecordCard({required this.record});

  final _GameRecord record;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () {
          // Phase 5: navigate to the record detail route.
        },
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  Text(
                    record.date,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.textSecondary,
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: record.scores.map((int score) {
                  return Expanded(
                    child: Text(
                      '$score',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              const Divider(height: 1),
              const SizedBox(height: 14),
              Align(
                alignment: Alignment.centerRight,
                child: Text(
                  'AVG ${record.average.toStringAsFixed(1)}',
                  style: const TextStyle(
                    color: AppColors.primaryBright,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GameRecord {
  const _GameRecord(this.date, this.scores, this.average);

  final String date;
  final List<int> scores;
  final double average;
}
