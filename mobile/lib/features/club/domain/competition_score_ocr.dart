import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_competition_score_models.dart';

class CompetitionOcrMatchResult {
  const CompetitionOcrMatchResult({
    required this.matches,
    required this.unmatchedNames,
  });

  final Map<String, List<int>> matches;
  final List<String> unmatchedNames;
}

CompetitionOcrMatchResult matchCompetitionOcrPlayers(
  ClubCompetitionScoreEntry entry,
  List<OcrPlayer> players,
) {
  final matches = <String, List<int>>{};
  final unmatched = <String>[];
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
    if (candidates.length != 1 || player.scores.length != entry.gameCount) {
      unmatched.add(player.name);
      continue;
    }
    final participantId = candidates.single.participantId;
    if (matches.containsKey(participantId)) {
      unmatched.add(player.name);
      continue;
    }
    matches[participantId] = List<int>.unmodifiable(player.scores);
  }
  return CompetitionOcrMatchResult(
    matches: Map<String, List<int>>.unmodifiable(matches),
    unmatchedNames: List<String>.unmodifiable(unmatched),
  );
}
