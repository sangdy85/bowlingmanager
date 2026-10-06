import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_team_competition_models.dart';
import 'package:flutter/material.dart';

class ClubTeamResultsCard extends StatelessWidget {
  const ClubTeamResultsCard({
    required this.state,
    required this.competitionMode,
    super.key,
  });

  final ClubTeamCompetitionState state;
  final ClubCompetitionMode? competitionMode;

  @override
  Widget build(BuildContext context) {
    final List<({int index, ClubTeamResult result})> teams =
        state.results.teams.indexed
            .map((entry) => (index: entry.$1, result: entry.$2))
            .toList()
          ..sort((left, right) {
            final int? leftRank = left.result.finalRank;
            final int? rightRank = right.result.finalRank;
            if (leftRank != null && rightRank != null) {
              return leftRank.compareTo(rightRank);
            }
            if (leftRank != null) return -1;
            if (rightRank != null) return 1;
            return left.index.compareTo(right.index);
          });
    return Card(
      key: const Key('team-results-card'),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              'TEAM 최종 결과표',
              style: Theme.of(context).textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            for (int index = 0; index < teams.length; index++) ...<Widget>[
              if (index > 0) const SizedBox(height: 14),
              _TeamResultSection(
                summary: teams[index].result,
                results: state.results,
                competitionMode: competitionMode,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _TeamResultSection extends StatelessWidget {
  const _TeamResultSection({
    required this.summary,
    required this.results,
    required this.competitionMode,
  });

  final ClubTeamResult summary;
  final ClubTeamCompetitionResults results;
  final ClubCompetitionMode? competitionMode;

  @override
  Widget build(BuildContext context) {
    final List<ClubTeamIndividualResult> players = results.individual
        .where((row) => row.competitionTeamId == summary.competitionTeamId)
        .toList();
    final List<ClubTeamGame> games = List<ClubTeamGame>.from(results.games)
      ..sort((left, right) => left.gameNumber.compareTo(right.gameNumber));
    final int gameCount = <int>[
      if (games.isNotEmpty) games.last.gameNumber,
      ...players.map((player) => player.scores.length),
    ].fold<int>(0, (largest, value) => value > largest ? value : largest);
    final Map<int, ClubTeamGameResult> teamGames = <int, ClubTeamGameResult>{
      for (final game in games)
        for (final result in game.teams)
          if (result.competitionTeamId == summary.competitionTeamId)
            game.gameNumber: result,
    };
    final bool hasExcludedScores = teamGames.values.any(
      (game) => game.excludedScores.isNotEmpty,
    );
    final bool showRankingNote =
        results.effectivePlayerCount != null &&
        (summary.teamHandicap > 0 || hasExcludedScores);

    return Container(
      key: Key('team-result-team-${summary.competitionTeamId}'),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              if (summary.finalRank != null) ...<Widget>[
                Chip(
                  visualDensity: VisualDensity.compact,
                  label: Text('${summary.finalRank}위'),
                ),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      summary.name,
                      style: Theme.of(context).textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    Text(
                      '게임 포인트 ${summary.totalPoints}P',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
              if (competitionMode == ClubCompetitionMode.mini)
                const Text(
                  '시즌 포인트 미지급',
                  textAlign: TextAlign.end,
                  style: TextStyle(fontWeight: FontWeight.w700),
                )
              else if (summary.seasonPoint != null)
                Text(
                  '시즌 +${summary.seasonPoint}P',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
            ],
          ),
          const SizedBox(height: 10),
          SingleChildScrollView(
            key: Key('team-result-table-${summary.competitionTeamId}'),
            scrollDirection: Axis.horizontal,
            child: DataTable(
              horizontalMargin: 10,
              columnSpacing: 18,
              columns: <DataColumn>[
                const DataColumn(label: Text('이름')),
                for (int game = 1; game <= gameCount; game++)
                  DataColumn(label: Text('${game}G'), numeric: true),
                const DataColumn(label: Text('총점'), numeric: true),
                const DataColumn(label: Text('개인순위'), numeric: true),
              ],
              rows: <DataRow>[
                for (final player in players)
                  DataRow(
                    cells: <DataCell>[
                      DataCell(Text(player.name)),
                      for (int game = 0; game < gameCount; game++)
                        DataCell(
                          Text(
                            game < player.scores.length
                                ? '${player.scores[game]}'
                                : '-',
                          ),
                        ),
                      DataCell(Text('${player.total}')),
                      DataCell(Text('${player.rank}위')),
                    ],
                  ),
                DataRow(
                  cells: <DataCell>[
                    DataCell(
                      Text(
                        '팀 종점',
                        key: Key(
                          'team-result-total-pins-${summary.competitionTeamId}',
                        ),
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                    for (int game = 1; game <= gameCount; game++)
                      DataCell(Text('${teamGames[game]?.rawTeamTotal ?? '-'}')),
                    DataCell(Text('${summary.rawPins}')),
                    const DataCell(Text('-')),
                  ],
                ),
                DataRow(
                  cells: <DataCell>[
                    DataCell(
                      Text(
                        '팀 포인트',
                        key: Key(
                          'team-result-points-${summary.competitionTeamId}',
                        ),
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                    for (int game = 1; game <= gameCount; game++)
                      DataCell(Text('${teamGames[game]?.points ?? '-'}')),
                    DataCell(Text('${summary.totalPoints}')),
                    const DataCell(Text('-')),
                  ],
                ),
              ],
            ),
          ),
          if (showRankingNote) ...<Widget>[
            const SizedBox(height: 8),
            Text(
              '순위 산정: 유효 ${results.effectivePlayerCount}명 · 핸디 적용 점수 기준',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}
