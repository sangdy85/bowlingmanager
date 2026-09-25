import 'dart:async';

import 'package:bowlingmanager_mobile/core/domain/game_session.dart';
import 'package:bowlingmanager_mobile/features/home/data/dashboard_api.dart';
import 'package:bowlingmanager_mobile/features/home/data/dashboard_repository.dart';
import 'package:bowlingmanager_mobile/features/home/domain/dashboard.dart';

final Dashboard testDashboard = Dashboard(
  year: 2026,
  average: 187.4,
  highScore: 245,
  gameCount: 36,
  totalGameCount: 36,
  regularAverage: 187.4,
  officialAverage: 201.7,
  recentAverage: 201.7,
  recentScores: <DashboardScore>[
    DashboardScore(
      source: DashboardScoreSource.personal,
      id: 'score-1',
      score: 215,
      gameDate: DateTime.utc(2026, 9, 15),
      gameType: '연습',
      memo: null,
      team: const DashboardTeam(id: 'team-1', name: '테스트 팀'),
    ),
    DashboardScore(
      source: DashboardScoreSource.personal,
      id: 'score-2',
      score: 189,
      gameDate: DateTime.utc(2026, 9, 14),
      gameType: null,
      memo: null,
      team: null,
    ),
  ],
  recentSessions: <GameSession>[
    GameSession(
      id: 'session-1',
      source: GameSessionSource.personal,
      gameDate: DateTime.utc(2026, 9, 15),
      gameType: '연습',
      team: const GameSessionTeam(id: 'team-1', name: '테스트 팀'),
      scores: const <GameSessionScore>[
        GameSessionScore(id: 'score-1', score: 215, memo: null),
        GameSessionScore(id: 'score-2', score: 189, memo: null),
      ],
      total: 404,
      average: 202,
      gameCount: 2,
    ),
  ],
  clubAchievements: const <DashboardClubAchievement>[
    DashboardClubAchievement(
      teamId: 'team-1',
      teamName: '테스트 팀',
      enabled: true,
      bowlerHiddenEnabled: false,
      seasonName: '2026 시즌',
      rank: 2,
      points: 20,
      gold: 1,
      silver: 0,
      bronze: 0,
      individualPoints: null,
      teamPoints: null,
      eventPoints: null,
    ),
  ],
);

const Dashboard emptyDashboard = Dashboard(
  year: 2026,
  average: 0,
  highScore: 0,
  gameCount: 0,
  recentAverage: 0,
  recentScores: <DashboardScore>[],
  recentSessions: <GameSession>[],
);

class FakeDashboardApi implements DashboardApi {
  Dashboard result = testDashboard;
  Object? error;
  int callCount = 0;

  @override
  Future<Dashboard> fetchDashboard() async {
    callCount += 1;
    if (error case final Object currentError) throw currentError;
    return result;
  }
}

class FakeDashboardRepository implements DashboardRepository {
  Dashboard result = testDashboard;
  Object? error;
  Future<Dashboard>? pendingResult;
  int callCount = 0;

  @override
  Future<Dashboard> fetchDashboard() async {
    callCount += 1;
    if (pendingResult case final Future<Dashboard> pending) return pending;
    if (error case final Object currentError) throw currentError;
    return result;
  }
}

Completer<Dashboard> pendingDashboard() => Completer<Dashboard>();
