import 'dart:async';

import 'package:bowlingmanager_mobile/core/domain/game_session.dart';
import 'package:bowlingmanager_mobile/features/records/data/scores_api.dart';
import 'package:bowlingmanager_mobile/features/records/data/scores_repository.dart';
import 'package:bowlingmanager_mobile/features/records/domain/score_record.dart';

final GameSession testScoreRecord = GameSession(
  id: 'score-1',
  source: GameSessionSource.personal,
  gameDate: DateTime.utc(2026, 9, 15),
  gameType: '정기전',
  team: const GameSessionTeam(id: 'team-1', name: '테스트 팀'),
  scores: const <GameSessionScore>[
    GameSessionScore(id: 'score-row-1', score: 215, memo: 'synthetic memo'),
  ],
  total: 215,
  average: 215,
  gameCount: 1,
);

final ScoresPage testScoresPage = scoresPage(
  page: 1,
  total: 1,
  items: <GameSession>[testScoreRecord],
  availableYears: const <int>[2026],
);

final ScoresPage emptyScoresPage = scoresPage(
  page: 1,
  total: 0,
  items: const <GameSession>[],
);

ScoresPage scoresPage({
  required int page,
  required int total,
  required List<GameSession> items,
  int limit = 20,
  List<int> availableYears = const <int>[],
}) {
  return ScoresPage(
    items: List<GameSession>.unmodifiable(items),
    availableYears: List<int>.unmodifiable(availableYears),
    pagination: ScorePagination(
      page: page,
      limit: limit,
      total: total,
      totalPages: (total / limit).ceil(),
    ),
  );
}

GameSession scoreRecord(String id, int score, {int year = 2026, int day = 15}) {
  return GameSession(
    id: id,
    source: GameSessionSource.personal,
    gameDate: DateTime.utc(year, 9, day),
    gameType: null,
    team: null,
    scores: <GameSessionScore>[
      GameSessionScore(id: '$id-row', score: score, memo: null),
    ],
    total: score,
    average: score.toDouble(),
    gameCount: 1,
  );
}

class FakeScoresApi implements ScoresApi {
  ScoresPage result = testScoresPage;
  Object? error;
  int callCount = 0;
  int? requestedPage;
  int? requestedLimit;
  RecordsFilter? requestedFilter;

  @override
  Future<ScoresPage> fetchScores({
    required int page,
    required int limit,
    RecordsFilter filter = const RecordsFilter(),
  }) async {
    callCount += 1;
    requestedPage = page;
    requestedLimit = limit;
    requestedFilter = filter;
    if (error case final Object currentError) throw currentError;
    return result;
  }
}

class FakeScoresRepository implements ScoresRepository {
  final Map<int, ScoresPage> pages = <int, ScoresPage>{1: testScoresPage};
  final Map<int, Object> errors = <int, Object>{};
  final Map<int, Future<ScoresPage>> pendingPages = <int, Future<ScoresPage>>{};
  final List<int> requestedPages = <int>[];
  final List<int> requestedLimits = <int>[];
  final List<RecordsFilter> requestedFilters = <RecordsFilter>[];

  @override
  Future<ScoresPage> fetchScores({
    required int page,
    required int limit,
    RecordsFilter filter = const RecordsFilter(),
  }) async {
    requestedPages.add(page);
    requestedLimits.add(limit);
    requestedFilters.add(filter);
    if (errors[page] case final Object error) throw error;
    if (pendingPages[page] case final Future<ScoresPage> pending) {
      return pending;
    }
    final ScoresPage? result = pages[page];
    if (result == null) throw StateError('Missing fake page $page.');
    return result;
  }
}

Completer<ScoresPage> pendingScoresPage() => Completer<ScoresPage>();
