import 'package:bowlingmanager_mobile/core/domain/game_session.dart';
import 'package:bowlingmanager_mobile/core/theme/app_theme.dart';
import 'package:bowlingmanager_mobile/features/home/presentation/recent_average_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'line chart preserves latest seven sessions in chronological order',
    (tester) async {
      final semantics = tester.ensureSemantics();
      try {
        final sessions = <GameSession>[
          for (int index = 0; index < 8; index++)
            _session(index, 210 - index.toDouble()),
        ];
        await _pump(tester, sessions);

        expect(
          find.byKey(const Key('recent-average-line-chart')),
          findsOneWidget,
        );
        expect(find.text('최근 7경기'), findsOneWidget);
        expect(find.text('210.0'), findsOneWidget);
        expect(find.text('250'), findsOneWidget);
        expect(find.text('125'), findsOneWidget);
        expect(find.text('10. 13.'), findsOneWidget);
        expect(find.text('10. 19.'), findsOneWidget);
        final summary = find.bySemanticsLabel(RegExp('최근 경기 평균, 오래된 순서'));
        expect(summary, findsOneWidget);
        final label = tester.getSemantics(summary).label;
        expect(label, contains('10. 13. 평균 204.0점'));
        expect(label.indexOf('204.0점'), lessThan(label.indexOf('210.0점')));
        expect(label, isNot(contains('203.0점')));
        expect(sessions.first.id, 'session-0');
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    },
  );

  testWidgets('empty sessions retain the existing empty state', (tester) async {
    await _pump(tester, const <GameSession>[]);
    expect(find.text('최근 기록이 없습니다.'), findsOneWidget);
    expect(find.byKey(const Key('recent-average-line-chart')), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'one zero-average session renders one date without division errors',
    (tester) async {
      await _pump(tester, <GameSession>[_session(0, 0)]);
      expect(find.text('최근 1경기'), findsOneWidget);
      expect(find.text('0.0'), findsOneWidget);
      expect(find.text('10. 19.'), findsOneWidget);
      expect(
        find.byKey(const Key('recent-average-line-chart')),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'handicap averages above 300 remain visible on an expanded axis',
    (tester) async {
      await _pump(tester, <GameSession>[_session(0, 310), _session(1, 280)]);
      expect(find.text('350'), findsOneWidget);
      expect(find.text('175'), findsOneWidget);
      expect(find.text('310.0'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  for (final width in <double>[360, 412]) {
    testWidgets('line chart fits ${width.toInt()}px with text scale 1.2', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(Size(width, 720));
      tester.platformDispatcher.textScaleFactorTestValue = 1.2;
      addTearDown(() {
        tester.binding.setSurfaceSize(null);
        tester.platformDispatcher.clearTextScaleFactorTestValue();
      });
      await _pump(tester, <GameSession>[
        for (int index = 0; index < 7; index++)
          _session(index, 150 + index * 10.0),
      ]);
      expect(
        find.byKey(const Key('recent-average-line-chart')),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    });
  }
}

Future<void> _pump(WidgetTester tester, List<GameSession> sessions) =>
    tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.dark,
        home: Scaffold(
          body: Padding(
            padding: const EdgeInsets.all(20),
            child: Align(
              alignment: Alignment.topCenter,
              child: RecentAverageChart(sessions: sessions),
            ),
          ),
        ),
      ),
    );

GameSession _session(int index, double average) => GameSession(
  id: 'session-$index',
  source: GameSessionSource.personal,
  gameDate: DateTime.utc(2026, 10, 19 - index),
  gameType: '정기전',
  team: null,
  scores: <GameSessionScore>[
    GameSessionScore(id: 'score-$index', score: average.toInt(), memo: null),
  ],
  total: average.toInt(),
  average: average,
  gameCount: 1,
);
