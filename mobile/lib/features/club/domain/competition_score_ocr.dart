import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_competition_score_models.dart';

class CompetitionOcrMatchResult {
  const CompetitionOcrMatchResult({
    required this.matches,
    required this.unmatchedNames,
    required this.partialNames,
  });

  final Map<String, List<int>> matches;
  final List<String> unmatchedNames;
  final List<String> partialNames;
}

CompetitionOcrMatchResult matchCompetitionOcrPlayers(
  ClubCompetitionScoreEntry entry,
  List<OcrPlayer> players, {
  int? gameCount,
}) {
  final targetGameCount = gameCount ?? entry.gameCount;
  final matches = <String, List<int>>{};
  final unmatched = <String>[];
  final partial = <String>[];
  for (final player in players) {
    final candidates = player.matchedMemberId != null
        ? entry.participants
              .where(
                (participant) => participant.memberId == player.matchedMemberId,
              )
              .toList()
        : entry.participants
              .where(
                (participant) => participant.name.trim() == player.name.trim(),
              )
              .toList();
    if (candidates.length != 1 || player.scores.isEmpty) {
      unmatched.add(player.name);
      continue;
    }
    final participantId = candidates.single.participantId;
    if (matches.containsKey(participantId)) {
      unmatched.add(player.name);
      continue;
    }
    final projected = player.scores
        .take(targetGameCount)
        .toList(growable: false);
    matches[participantId] = List<int>.unmodifiable(projected);
    if (projected.length < targetGameCount) {
      partial.add(
        '${player.name} ($targetGameCount게임 중 ${projected.length}게임 인식됨)',
      );
    }
  }
  return CompetitionOcrMatchResult(
    matches: Map<String, List<int>>.unmodifiable(matches),
    unmatchedNames: List<String>.unmodifiable(unmatched),
    partialNames: List<String>.unmodifiable(partial),
  );
}
