import 'dart:async';

import 'package:bowlingmanager_mobile/features/home/data/dashboard_api.dart';
import 'package:bowlingmanager_mobile/features/home/data/dashboard_repository.dart';
import 'package:bowlingmanager_mobile/features/home/domain/dashboard.dart';

final Dashboard testDashboard = Dashboard(
  year: 2026,
  average: 187.4,
  highScore: 245,
  gameCount: 36,
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
);

const Dashboard emptyDashboard = Dashboard(
  year: 2026,
  average: 0,
  highScore: 0,
  gameCount: 0,
  recentAverage: 0,
  recentScores: <DashboardScore>[],
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
