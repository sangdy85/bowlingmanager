import 'package:bowlingmanager_mobile/features/club/domain/club_records_models.dart';

class ClubResultShareData {
  const ClubResultShareData({
    required this.clubName,
    required this.dateLabel,
    required this.gameTypeLabel,
    required this.participantCount,
    required this.gameCount,
    required this.dailyAverage,
    required this.participants,
  });

  final String? clubName;
  final String dateLabel;
  final String gameTypeLabel;
  final int participantCount;
  final int gameCount;
  final double dailyAverage;
  final List<ClubResultShareParticipant> participants;

  String get clubNameLabel => clubName ?? '동호회 경기 결과';

  List<ClubResultShareParticipant> get topParticipants =>
      List<ClubResultShareParticipant>.unmodifiable(participants.take(3));

  ClubResultShareParticipant? get currentUserOutsideTopThree {
    for (final ClubResultShareParticipant participant in participants) {
      if (participant.isCurrentUser && !topParticipants.contains(participant)) {
        return participant;
      }
    }
    return null;
  }

  factory ClubResultShareData.fromActivity({
    required ClubActivityFeedItem activity,
    String? clubName,
    String? currentMemberId,
  }) {
    final String? normalizedClubName = _nonEmpty(clubName);
    final String? normalizedGameType = _nonEmpty(activity.gameType);
    final List<({int index, ClubResultShareParticipant participant})> indexed =
        <({int index, ClubResultShareParticipant participant})>[
          for (int index = 0; index < activity.participants.length; index++)
            (
              index: index,
              participant: ClubResultShareParticipant.fromActivityParticipant(
                activity.participants[index],
                isCurrentUser:
                    currentMemberId != null &&
                    activity.participants[index].id == currentMemberId,
              ),
            ),
        ]..sort((left, right) {
          final int rankComparison = left.participant.rank.compareTo(
            right.participant.rank,
          );
          return rankComparison != 0
              ? rankComparison
              : left.index.compareTo(right.index);
        });

    return ClubResultShareData(
      clubName: normalizedClubName,
      dateLabel: _formatDate(activity.date),
      gameTypeLabel: normalizedGameType ?? '경기 기록',
      participantCount: activity.participantCount,
      gameCount: activity.gameCount,
      dailyAverage: activity.dailyAverage,
      participants: List<ClubResultShareParticipant>.unmodifiable(
        indexed.map((item) => item.participant),
      ),
    );
  }
}

class ClubResultShareParticipant {
  const ClubResultShareParticipant({
    required this.rank,
    required this.displayName,
    required this.scores,
    required this.total,
    required this.average,
    required this.isCurrentUser,
  });

  final int rank;
  final String displayName;
  final List<int> scores;
  final int total;
  final double average;
  final bool isCurrentUser;

  factory ClubResultShareParticipant.fromActivityParticipant(
    ClubActivityParticipant participant, {
    required bool isCurrentUser,
  }) {
    return ClubResultShareParticipant(
      rank: participant.rank,
      displayName: _nonEmpty(participant.name) ?? '볼러',
      scores: List<int>.unmodifiable(participant.scores),
      total: participant.total,
      average: participant.average,
      isCurrentUser: isCurrentUser,
    );
  }
}

String maskShareName(String name) {
  final String normalized = name.trim();
  if (normalized.isEmpty) return '볼러';
  final List<int> codePoints = normalized.runes.toList(growable: false);
  if (codePoints.length == 1) return normalized;
  return '${String.fromCharCode(codePoints.first)}${'*' * (codePoints.length - 1)}';
}

String? _nonEmpty(String? value) {
  final String? normalized = value?.trim();
  return normalized?.isNotEmpty == true ? normalized : null;
}

String _formatDate(DateTime date) {
  final String month = date.month.toString().padLeft(2, '0');
  final String day = date.day.toString().padLeft(2, '0');
  return '${date.year}.$month.$day';
}
