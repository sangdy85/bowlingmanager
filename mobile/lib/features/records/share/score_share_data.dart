import 'package:bowlingmanager_mobile/core/domain/game_session.dart';

class ScoreShareData {
  const ScoreShareData({
    required this.displayName,
    required this.dateLabel,
    required this.gameTypeLabel,
    required this.teamLabel,
    required this.scores,
    required this.total,
    required this.average,
    required this.high,
    required this.rankPosition,
    required this.rankParticipantCount,
  });

  final String displayName;
  final String dateLabel;
  final String gameTypeLabel;
  final String teamLabel;
  final List<int> scores;
  final int total;
  final double average;
  final int high;
  final int? rankPosition;
  final int? rankParticipantCount;

  factory ScoreShareData.fromSession({
    required GameSession session,
    required String displayName,
  }) {
    final List<int> scores = session.scores
        .map((GameSessionScore score) => score.score)
        .toList(growable: false);
    final String trimmedDisplayName = displayName.trim();
    final String? gameType = session.gameType?.trim();
    final String? teamName = session.team?.name.trim();

    return ScoreShareData(
      displayName: trimmedDisplayName.isEmpty ? '볼러님' : trimmedDisplayName,
      dateLabel: _formatDate(session.gameDate),
      gameTypeLabel: gameType?.isNotEmpty == true
          ? gameType!
          : session.source.label,
      teamLabel: teamName?.isNotEmpty == true ? teamName! : '개인 기록',
      scores: List<int>.unmodifiable(scores),
      total: session.total,
      average: session.average,
      high: scores.reduce((int current, int score) {
        return score > current ? score : current;
      }),
      rankPosition: session.rank?.position,
      rankParticipantCount: session.rank?.participantCount,
    );
  }
}

String _formatDate(DateTime date) {
  final String month = date.month.toString().padLeft(2, '0');
  final String day = date.day.toString().padLeft(2, '0');
  return '${date.year}.$month.$day';
}
