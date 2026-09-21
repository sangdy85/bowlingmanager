import 'dart:async';

import 'package:bowlingmanager_mobile/features/records/data/scores_api.dart';
import 'package:bowlingmanager_mobile/features/records/data/scores_repository.dart';
import 'package:bowlingmanager_mobile/features/records/domain/score_record.dart';

final ScoreRecord testScoreRecord = ScoreRecord(
  id: 'score-1',
  score: 215,
  gameDate: DateTime.utc(2026, 9, 15),
  gameType: '정기전',
  memo: 'synthetic memo',
  team: const ScoreTeam(id: 'team-1', name: '테스트 팀'),
);

final ScoresPage testScoresPage = scoresPage(
  page: 1,
  total: 1,
  items: <ScoreRecord>[testScoreRecord],
);

final ScoresPage emptyScoresPage = scoresPage(
  page: 1,
  total: 0,
  items: const <ScoreRecord>[],
);

ScoresPage scoresPage({
  required int page,
  required int total,
  required List<ScoreRecord> items,
  int limit = 20,
}) {
  return ScoresPage(
    items: List<ScoreRecord>.unmodifiable(items),
    pagination: ScorePagination(
      page: page,
      limit: limit,
      total: total,
      totalPages: (total / limit).ceil(),
    ),
  );
}

ScoreRecord scoreRecord(String id, int score, {int day = 15}) {
  return ScoreRecord(
    id: id,
    score: score,
    gameDate: DateTime.utc(2026, 9, day),
    gameType: null,
    memo: null,
    team: null,
  );
}

class FakeScoresApi implements ScoresApi {
  ScoresPage result = testScoresPage;
  Object? error;
  int callCount = 0;
  int? requestedPage;
  int? requestedLimit;

  @override
  Future<ScoresPage> fetchScores({
    required int page,
    required int limit,
  }) async {
    callCount += 1;
    requestedPage = page;
    requestedLimit = limit;
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

  @override
  Future<ScoresPage> fetchScores({
    required int page,
    required int limit,
  }) async {
    requestedPages.add(page);
    requestedLimits.add(limit);
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
