import 'package:bowlingmanager_mobile/app/app.dart';
import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/core/domain/game_session.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/features/records/application/records_providers.dart';
import 'package:bowlingmanager_mobile/features/records/domain/score_record.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';
import 'support/club_fakes.dart';
import 'support/dashboard_fakes.dart';
import 'support/records_fakes.dart';

void main() {
  testWidgets('Records shows loading and then real score fields', (
    WidgetTester tester,
  ) async {
    final pending = pendingScoresPage();
    final FakeScoresRepository repository = FakeScoresRepository()
      ..pendingPages[1] = pending.future;
    await _openRecords(tester, repository, settleRecords: false);

    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    pending.complete(testScoresPage);
    await tester.pumpAndSettle();

    expect(find.textContaining('2026.09.15'), findsOneWidget);
    expect(find.text('215'), findsOneWidget);
    expect(find.textContaining('정기전'), findsWidgets);
    expect(find.text('테스트 팀'), findsOneWidget);
    expect(find.text('synthetic memo'), findsOneWidget);
    expect(find.byType(RefreshIndicator), findsOneWidget);
  });

  testWidgets('Records shows the empty state', (WidgetTester tester) async {
    final FakeScoresRepository repository = FakeScoresRepository()
      ..pages[1] = emptyScoresPage;

    await _openRecords(tester, repository);

    expect(find.text('아직 기록이 없습니다.'), findsOneWidget);
  });

  testWidgets(
    'Records groups years and exposes server-backed category filters',
    (WidgetTester tester) async {
      final FakeScoresRepository repository = FakeScoresRepository()
        ..pages[1] = scoresPage(
          page: 1,
          total: 2,
          availableYears: const <int>[2026, 2025],
          items: <GameSession>[
            scoreRecord('newer', 220),
            scoreRecord('older', 190, year: 2025),
          ],
        );

      await _openRecords(tester, repository);

      expect(find.byKey(const Key('records-year-2026')), findsOneWidget);
      expect(find.byKey(const Key('records-year-2025')), findsOneWidget);
      await tester.tap(find.byKey(const Key('records-category-OFFICIAL')));
      await tester.pumpAndSettle();

      expect(
        repository.requestedFilters.last.category,
        RecordCategory.official,
      );
      expect(find.byKey(const Key('records-official-ALL')), findsOneWidget);
      expect(
        find.byKey(const Key('records-official-STANDING_LEAGUE')),
        findsOneWidget,
      );
      expect(
        find.byKey(const Key('records-official-CHAMPIONSHIP')),
        findsOneWidget,
      );
      expect(find.byKey(const Key('records-official-EVENT')), findsOneWidget);
    },
  );

  testWidgets('Records groups variable games with total, average and memos', (
    WidgetTester tester,
  ) async {
    final GameSession session = GameSession(
      id: 'group-1',
      source: GameSessionSource.personal,
      gameDate: DateTime.utc(2026, 9, 22),
      gameType: '정기전',
      team: const GameSessionTeam(id: 'team-1', name: '배볼러'),
      scores: const <GameSessionScore>[
        GameSessionScore(id: 's1', score: 202, memo: '첫 메모'),
        GameSessionScore(id: 's2', score: 213, memo: '둘째 메모'),
        GameSessionScore(id: 's3', score: 208, memo: null),
        GameSessionScore(id: 's4', score: 192, memo: null),
      ],
      total: 815,
      average: 203.8,
      gameCount: 4,
    );
    final FakeScoresRepository repository = FakeScoresRepository()
      ..pages[1] = scoresPage(page: 1, total: 1, items: <GameSession>[session]);

    await _openRecords(tester, repository);

    expect(find.textContaining('정기전'), findsWidgets);
    expect(find.text('배볼러'), findsOneWidget);
    expect(find.textContaining('2026.09.22'), findsOneWidget);
    for (final String score in <String>['202', '213', '208', '192']) {
      expect(find.text(score), findsOneWidget);
    }
    expect(find.text('4게임'), findsOneWidget);
    expect(find.text('총핀 815'), findsOneWidget);
    expect(find.text('AVG 203.8'), findsOneWidget);
    expect(find.text('202 · 첫 메모'), findsOneWidget);
    expect(find.text('213 · 둘째 메모'), findsOneWidget);
    expect(find.byKey(const Key('record-rank-1')), findsNothing);
  });

  testWidgets('Records renders medals for top three and a plain badge after', (
    WidgetTester tester,
  ) async {
    final FakeScoresRepository repository = FakeScoresRepository()
      ..pages[1] = scoresPage(
        page: 1,
        total: 4,
        items: <GameSession>[
          for (final int position in <int>[1, 2, 3, 5])
            _rankedSession(position: position),
        ],
      );
    await _openRecords(tester, repository);

    for (final int position in <int>[1, 2, 3, 5]) {
      await tester.scrollUntilVisible(
        find.byKey(Key('record-rank-$position')),
        180,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.byKey(Key('record-rank-$position')), findsOneWidget);
      expect(find.text('$position위'), findsOneWidget);
      expect(find.text('13명 중'), findsWidgets);
      expect(
        find.byKey(Key('record-medal-$position')),
        position <= 3 ? findsOneWidget : findsNothing,
      );
    }
  });

  testWidgets('casual Records card has no rank badge', (
    WidgetTester tester,
  ) async {
    final GameSession session = _rankedSession(position: null, gameType: '벙개');
    final FakeScoresRepository repository = FakeScoresRepository()
      ..pages[1] = scoresPage(page: 1, total: 1, items: <GameSession>[session]);
    await _openRecords(tester, repository);

    expect(find.textContaining('벙개'), findsWidgets);
    expect(find.byKey(const Key('record-rank-1')), findsNothing);
    expect(find.byType(Icon), findsWidgets);
  });

  testWidgets('team Records card opens the exact club activity', (
    WidgetTester tester,
  ) async {
    final GameSession session = GameSession(
      id: 'linked-session',
      source: GameSessionSource.personal,
      gameDate: DateTime.utc(2026, 9, 19),
      gameType: '정기전',
      team: const GameSessionTeam(id: 'team-1', name: '테스트 동호회'),
      scores: const <GameSessionScore>[
        GameSessionScore(id: 'linked-score', score: 210, memo: null),
      ],
      total: 210,
      average: 210,
      gameCount: 1,
      activityId: '2026-09-19~REGULAR',
    );
    final FakeScoresRepository scoresRepository = FakeScoresRepository()
      ..pages[1] = scoresPage(page: 1, total: 1, items: <GameSession>[session]);
    final FakeClubRepository clubRepository = FakeClubRepository();

    await _openRecords(
      tester,
      scoresRepository,
      clubRepository: clubRepository,
    );
    await tester.tap(find.byKey(const Key('record-session-linked-session')));
    await tester.pump();
    final Finder targetCard = find.byKey(
      Key('club-activity-${testClubActivityFeedItem.id}'),
    );
    for (
      int attempt = 0;
      attempt < 20 && targetCard.evaluate().isEmpty;
      attempt++
    ) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.byKey(const Key('club-activities-list')), findsOneWidget);
    final Card highlighted = tester.widget<Card>(targetCard);
    expect(highlighted.color, isNotNull);
    expect(tester.getTopLeft(targetCard).dy, greaterThanOrEqualTo(0));
    expect(tester.getBottomLeft(targetCard).dy, lessThanOrEqualTo(800));
    expect(clubRepository.requestedActivityFeedTargets, <String?>[
      '2026-09-19~REGULAR',
    ]);
    await tester.pump(const Duration(seconds: 3));
  });

  testWidgets('Records card scrolls twelve scores on a 360px scaled layout', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(360, 720);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 1.2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final List<GameSessionScore> scores = List<GameSessionScore>.generate(
      12,
      (int index) =>
          GameSessionScore(id: 'score-$index', score: 300, memo: null),
    );
    final GameSession session = GameSession(
      id: 'long-session',
      source: GameSessionSource.personal,
      gameDate: DateTime.utc(2026, 9, 22),
      gameType: '정기전',
      team: const GameSessionTeam(
        id: 'team-1',
        name: '아주 긴 이름을 가진 테스트 볼링 동호회 팀 이름',
      ),
      scores: scores,
      total: 3600,
      average: 300,
      gameCount: 12,
      rank: const GameSessionRank(position: 1, participantCount: 13),
    );
    final FakeScoresRepository repository = FakeScoresRepository()
      ..pages[1] = scoresPage(page: 1, total: 1, items: <GameSession>[session]);
    await _openRecords(tester, repository);

    expect(find.text('12게임'), findsOneWidget);
    expect(find.text('총핀 3600'), findsOneWidget);
    expect(find.text('AVG 300.0'), findsOneWidget);
    expect(find.text('300'), findsNWidgets(12));
    expect(find.byKey(const Key('record-scores-long-session')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Records shows an initial error and retries', (
    WidgetTester tester,
  ) async {
    const ApiException error = ApiException(
      kind: ApiErrorKind.networkUnavailable,
      userMessage: '네트워크 연결을 확인해주세요.',
    );
    final FakeScoresRepository repository = FakeScoresRepository()
      ..errors[1] = error;

    await _openRecords(tester, repository);

    expect(find.text(error.userMessage), findsOneWidget);
    repository.errors.remove(1);
    await tester.tap(find.text('다시 시도'));
    await tester.pumpAndSettle();

    expect(find.text('215'), findsOneWidget);
    expect(repository.requestedPages, <int>[1, 1]);
  });

  testWidgets('Records loads another page without replacing existing scores', (
    WidgetTester tester,
  ) async {
    final pending = pendingScoresPage();
    final FakeScoresRepository repository = FakeScoresRepository()
      ..pages[1] = scoresPage(
        page: 1,
        total: 21,
        items: <GameSession>[scoreRecord('score-1', 201)],
      )
      ..pendingPages[2] = pending.future;
    await _openRecords(tester, repository);

    await tester.ensureVisible(find.byKey(const Key('records-load-more')));
    await tester.drag(
      find.byKey(const Key('records-list')),
      const Offset(0, -180),
    );
    await tester.pump();
    await tester.tap(find.byKey(const Key('records-load-more')));
    await tester.pump();

    expect(find.text('201'), findsOneWidget);
    expect(find.byKey(const Key('records-loading-more')), findsOneWidget);
    pending.complete(
      scoresPage(
        page: 2,
        total: 21,
        items: <GameSession>[scoreRecord('score-2', 202)],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('201'), findsOneWidget);
    expect(find.text('202'), findsOneWidget);
    expect(find.byKey(const Key('records-load-more')), findsNothing);
  });

  testWidgets('Records keeps the list when loading another page fails', (
    WidgetTester tester,
  ) async {
    const ApiException error = ApiException(
      kind: ApiErrorKind.networkUnavailable,
      userMessage: '네트워크 연결을 확인해주세요.',
    );
    final FakeScoresRepository repository = FakeScoresRepository()
      ..pages[1] = scoresPage(
        page: 1,
        total: 21,
        items: <GameSession>[scoreRecord('score-1', 201)],
      )
      ..errors[2] = error;
    await _openRecords(tester, repository);

    await tester.ensureVisible(find.byKey(const Key('records-load-more')));
    await tester.drag(
      find.byKey(const Key('records-list')),
      const Offset(0, -180),
    );
    await tester.pump();
    await tester.tap(find.byKey(const Key('records-load-more')));
    await tester.pumpAndSettle();

    expect(find.text('201'), findsOneWidget);
    expect(find.text(error.userMessage), findsOneWidget);
    expect(find.text('다시 시도'), findsOneWidget);
  });
}

GameSession _rankedSession({required int? position, String gameType = '정기전'}) {
  return GameSession(
    id: 'ranked-$position-$gameType',
    source: GameSessionSource.personal,
    gameDate: DateTime.utc(2026, 9, 22),
    gameType: gameType,
    team: const GameSessionTeam(id: 'team-1', name: '배볼러'),
    scores: const <GameSessionScore>[
      GameSessionScore(id: 's1', score: 202, memo: null),
    ],
    total: 202,
    average: 202,
    gameCount: 1,
    rank: position == null
        ? null
        : GameSessionRank(position: position, participantCount: 13),
  );
}

Future<void> _openRecords(
  WidgetTester tester,
  FakeScoresRepository scoresRepository, {
  bool settleRecords = true,
  FakeClubRepository? clubRepository,
}) async {
  final FakeAuthRepository authRepository = FakeAuthRepository()
    ..bootstrapResult = testUser;
  final FakeDashboardRepository dashboardRepository = FakeDashboardRepository();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(authRepository),
        dashboardRepositoryProvider.overrideWithValue(dashboardRepository),
        scoresRepositoryProvider.overrideWithValue(scoresRepository),
        clubRepositoryProvider.overrideWithValue(
          clubRepository ?? FakeClubRepository(),
        ),
      ],
      child: const BowlingManagerApp(),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('기록'));
  if (settleRecords) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
}
