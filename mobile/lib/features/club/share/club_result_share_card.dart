import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/features/club/share/club_result_share_data.dart';
import 'package:bowlingmanager_mobile/shared/widgets/bowling_medal.dart';
import 'package:flutter/material.dart';

class ClubResultShareCard extends StatelessWidget {
  const ClubResultShareCard({
    required this.data,
    required this.maskNames,
    super.key,
  });

  static const double logicalWidth = 360;

  final ClubResultShareData data;
  final bool maskNames;

  @override
  Widget build(BuildContext context) {
    final ClubResultShareParticipant? myRecord =
        data.currentUserOutsideTopThree;
    return SizedBox(
      key: const Key('club-result-share-card'),
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
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
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
                '동호회 경기 결과',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 27,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.7,
                ),
              ),
              const SizedBox(height: 14),
              Text(
                data.clubNameLabel,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 16),
              _InfoRow(label: 'DATE', value: data.dateLabel),
              const SizedBox(height: 7),
              _InfoRow(label: 'TYPE', value: data.gameTypeLabel),
              const SizedBox(height: 18),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: AppColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Wrap(
                  alignment: WrapAlignment.spaceAround,
                  spacing: 12,
                  runSpacing: 8,
                  children: <Widget>[
                    Text('참가 ${data.participantCount}명'),
                    Text('${data.gameCount}게임'),
                    Text(
                      '전체 AVG ${data.dailyAverage.toStringAsFixed(1)}',
                      style: const TextStyle(
                        color: AppColors.primaryBright,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              for (int index = 0; index < data.topParticipants.length; index++)
                Padding(
                  padding: EdgeInsets.only(
                    bottom: index == data.topParticipants.length - 1 ? 0 : 12,
                  ),
                  child: _ParticipantResult(
                    participant: data.topParticipants[index],
                    maskNames: maskNames,
                  ),
                ),
              if (myRecord != null) ...<Widget>[
                const SizedBox(height: 20),
                const Divider(height: 1, color: AppColors.divider),
                const SizedBox(height: 16),
                const Text(
                  '내 기록',
                  key: Key('club-result-share-my-record'),
                  style: TextStyle(
                    color: AppColors.primaryBright,
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 10),
                _ParticipantResult(participant: myRecord, maskNames: maskNames),
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

class _ParticipantResult extends StatelessWidget {
  const _ParticipantResult({
    required this.participant,
    required this.maskNames,
  });

  final ClubResultShareParticipant participant;
  final bool maskNames;

  @override
  Widget build(BuildContext context) {
    final Color rankColor =
        bowlingMedalColor(participant.rank) ?? AppColors.primaryBright;
    final String displayName = maskNames
        ? maskShareName(participant.displayName)
        : participant.displayName;
    return Container(
      key: Key('club-result-share-rank-${participant.rank}'),
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: rankColor.withValues(alpha: 0.18),
                  border: Border.all(color: rankColor),
                ),
                child: Text(
                  '${participant.rank}',
                  style: TextStyle(
                    color: rankColor,
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  displayName,
                  key: Key('club-result-share-name-${participant.rank}'),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          if (participant.scores.isNotEmpty) ...<Widget>[
            const SizedBox(height: 12),
            Wrap(
              spacing: 7,
              runSpacing: 7,
              children: <Widget>[
                for (int index = 0; index < participant.scores.length; index++)
                  Container(
                    key: Key(
                      'club-result-share-${participant.rank}-score-$index',
                    ),
                    constraints: const BoxConstraints(minWidth: 46),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${participant.scores[index]}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
              ],
            ),
          ],
          const SizedBox(height: 11),
          Text(
            'TOTAL ${participant.total}  ·  '
            'AVG ${participant.average.toStringAsFixed(1)}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.primaryBright,
              fontSize: 13,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}
