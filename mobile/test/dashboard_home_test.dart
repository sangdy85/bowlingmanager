import 'package:bowlingmanager_mobile/app/app.dart';
import 'package:bowlingmanager_mobile/core/domain/game_session.dart';
import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/features/home/domain/dashboard.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';
import 'support/dashboard_fakes.dart';
import 'support/club_fakes.dart';

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
    await tester.scrollUntilVisible(
      find.text('리그'),
      500,
      scrollable: find.byType(Scrollable).first,
    );
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
    await tester.scrollUntilVisible(
      find.text('최근 경기'),
      500,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('최근 기록이 없습니다.'), findsWidgets);
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

  testWidgets(
    'expanded Home fits 360px, exposes sections and navigates to team records',
    (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(360, 720));
      tester.platformDispatcher.textScaleFactorTestValue = 1.2;
      addTearDown(() {
        tester.binding.setSurfaceSize(null);
        tester.platformDispatcher.clearTextScaleFactorTestValue();
      });
      final FakeDashboardRepository repository = FakeDashboardRepository()
        ..result = _expandedDashboard();

      await _pumpAuthenticatedApp(tester, repository);
      await tester.pumpAndSettle();

      for (final String section in <String>[
        '나의 기록실',
        '나의 입상',
        '최근 경기 AVG',
        '개인 상세 통계',
        '팀 기록',
        '최근 경기',
      ]) {
        await tester.scrollUntilVisible(
          find.text(section),
          300,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.pump();
        expect(find.text(section), findsOneWidget);
        expect(tester.takeException(), isNull);
      }
      await tester.scrollUntilVisible(
        find.text('나의 입상'),
        -300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.bySemanticsLabel(RegExp(r'금메달 3회')), findsOneWidget);

      await tester.scrollUntilVisible(
        find.text('아주 긴 이름을 가진 테스트 동호회입니다'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('아주 긴 이름을 가진 테스트 동호회입니다'), findsOneWidget);
      await tester.tap(find.text('아주 긴 이름을 가진 테스트 동호회입니다'));
      await tester.pumpAndSettle();
      expect(find.text('동호회 기록'), findsOneWidget);
    },
  );

  testWidgets('Home pull-to-refresh reloads the dashboard', (
    WidgetTester tester,
  ) async {
    final FakeDashboardRepository repository = FakeDashboardRepository();
    await _pumpAuthenticatedApp(tester, repository);
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView).first, const Offset(0, 500));
    await tester.pumpAndSettle();
    expect(repository.callCount, 2);
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
        clubRepositoryProvider.overrideWithValue(FakeClubRepository()),
      ],
      child: const BowlingManagerApp(),
    ),
  );
}

Dashboard _expandedDashboard() => Dashboard(
  year: 2026,
  average: 218.4,
  highScore: 279,
  gameCount: 80,
  recentAverage: 221.3,
  recentScores: testDashboard.recentScores,
  recentSessions: testDashboard.recentSessions,
  profileRadar: const DashboardRadar(
    axes: <DashboardRadarAxis>[
      DashboardRadarAxis(key: 'AVERAGE', label: '기량(에버)'),
      DashboardRadarAxis(key: 'POTENTIAL', label: '포텐셜'),
      DashboardRadarAxis(key: 'CONSISTENCY', label: '기복'),
      DashboardRadarAxis(key: 'FLOOR', label: '안정감'),
      DashboardRadarAxis(key: 'ATTENDANCE', label: '성실'),
    ],
    series: <DashboardRadarSeries>[
      DashboardRadarSeries(
        key: 'REGULAR',
        label: '정기전',
        color: '#3B82F6',
        values: <double>[8, 9, 7, 8.5, 10],
      ),
    ],
  ),
  medals: const DashboardMedals(goldCount: 3, silverCount: 2, bronzeCount: 1),
  personalStats: const DashboardPersonalStats(
    regular: DashboardCategoryStats(
      average: 218.5,
      highScore: 279,
      lowScore: 160,
      gameCount: 60,
    ),
    official: DashboardCategoryStats(
      average: 211.2,
      highScore: 268,
      lowScore: 155,
      gameCount: 20,
    ),
  ),
  teamSummaries: const <DashboardTeamSummary>[
    DashboardTeamSummary(
      id: 'team-1',
      name: '아주 긴 이름을 가진 테스트 동호회입니다',
      myRole: DashboardTeamRole.owner,
      attended: 15,
      activityCount: 16,
      attendanceRate: 93.8,
      gameCount: 60,
      average: 218.5,
    ),
    DashboardTeamSummary(
      id: 'team-2',
      name: '두 번째 동호회',
      myRole: DashboardTeamRole.member,
      attended: 0,
      activityCount: 0,
      attendanceRate: 0,
      gameCount: 0,
      average: 0,
    ),
  ],
);

Future<void> _pumpUntilFound(WidgetTester tester, Finder finder) async {
  for (int index = 0; index < 10 && finder.evaluate().isEmpty; index += 1) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}
