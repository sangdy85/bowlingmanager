import 'package:bowlingmanager_mobile/app/app.dart';
import 'package:bowlingmanager_mobile/core/domain/game_session.dart';
import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/features/home/domain/dashboard.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';
import 'support/dashboard_fakes.dart';

void main() {
  testWidgets('Home labels personal, league and tournament recent games', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(600, 1600));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repository = FakeDashboardRepository()
      ..result = Dashboard(
        year: 2026,
        average: 310,
        highScore: 310,
        gameCount: 3,
        recentAverage: 310,
        recentScores: [
          for (final source in DashboardScoreSource.values)
            DashboardScore(
              source: source,
              id: source.apiValue,
              score: 310,
              gameDate: DateTime.utc(2026, 6, 1),
              gameType: null,
              memo: null,
              team: null,
            ),
        ],
        recentSessions: <GameSession>[
          for (final GameSessionSource source in GameSessionSource.values)
            GameSession(
              id: source.apiValue,
              source: source,
              gameDate: DateTime.utc(2026, 6, 1),
              gameType: null,
              team: null,
              scores: <GameSessionScore>[
                GameSessionScore(
                  id: '${source.apiValue}-1',
                  score: 310,
                  memo: null,
                ),
              ],
              total: 310,
              average: 310,
              gameCount: 1,
            ),
        ],
      );
    await _pumpAuthenticatedApp(tester, repository);
    await tester.pumpAndSettle();
    expect(find.text('개인'), findsOneWidget);
    expect(find.text('리그'), findsOneWidget);
    expect(find.text('대회'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Home renders dashboard data from the repository', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(600, 1600));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final FakeDashboardRepository dashboardRepository =
        FakeDashboardRepository();

    await _pumpAuthenticatedApp(tester, dashboardRepository);
    await tester.pumpAndSettle();

    expect(dashboardRepository.callCount, 1);
    expect(find.text('187.4'), findsOneWidget);
    expect(find.text('245'), findsOneWidget);
    expect(find.text('36'), findsOneWidget);
    expect(find.text('201.7'), findsOneWidget);
    expect(find.text('202.0'), findsWidgets);
    expect(find.text('최근 경기 AVG'), findsOneWidget);
    expect(find.text('2게임'), findsOneWidget);
    expect(find.text('총점 404'), findsOneWidget);
    expect(find.text('AVG 202.0'), findsOneWidget);
  });

  testWidgets('Home shows loading while dashboard request is pending', (
    WidgetTester tester,
  ) async {
    final pending = pendingDashboard();
    final FakeDashboardRepository dashboardRepository =
        FakeDashboardRepository()..pendingResult = pending.future;

    await _pumpAuthenticatedApp(tester, dashboardRepository);
    await _pumpUntilFound(tester, find.byType(CircularProgressIndicator));

    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    pending.complete(testDashboard);
    await tester.pumpAndSettle();

    expect(find.text('187.4'), findsOneWidget);
  });

  testWidgets('Home treats zero games and an empty recent list as data', (
    WidgetTester tester,
  ) async {
    final FakeDashboardRepository dashboardRepository =
        FakeDashboardRepository()..result = emptyDashboard;

    await _pumpAuthenticatedApp(tester, dashboardRepository);
    await tester.pumpAndSettle();

    expect(find.text('CURRENT AVG'), findsOneWidget);
    expect(find.text('HIGH'), findsOneWidget);
    expect(find.text('GAMES'), findsOneWidget);
    expect(find.text('최근 기록이 없습니다.'), findsOneWidget);
  });

  testWidgets('Home shows an API error and retries the dashboard request', (
    WidgetTester tester,
  ) async {
    const String message = '네트워크 연결을 확인해주세요.';
    final FakeDashboardRepository dashboardRepository =
        FakeDashboardRepository()
          ..error = const ApiException(
            kind: ApiErrorKind.networkUnavailable,
            userMessage: message,
          );

    await _pumpAuthenticatedApp(tester, dashboardRepository);
    await tester.pumpAndSettle();

    expect(find.text(message), findsOneWidget);
    expect(find.text('다시 시도'), findsOneWidget);

    dashboardRepository.error = null;
    await tester.tap(find.text('다시 시도'));
    await tester.pumpAndSettle();

    expect(dashboardRepository.callCount, 2);
    expect(find.text('187.4'), findsOneWidget);
  });
}

Future<void> _pumpAuthenticatedApp(
  WidgetTester tester,
  FakeDashboardRepository dashboardRepository,
) {
  final FakeAuthRepository authRepository = FakeAuthRepository()
    ..bootstrapResult = testUser;
  return tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(authRepository),
        dashboardRepositoryProvider.overrideWithValue(dashboardRepository),
      ],
      child: const BowlingManagerApp(),
    ),
  );
}

Future<void> _pumpUntilFound(WidgetTester tester, Finder finder) async {
  for (int index = 0; index < 10 && finder.evaluate().isEmpty; index += 1) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}
