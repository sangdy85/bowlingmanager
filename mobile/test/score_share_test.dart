import 'dart:async';

import 'package:bowlingmanager_mobile/core/domain/game_session.dart';
import 'package:bowlingmanager_mobile/features/records/share/score_share_card.dart';
import 'package:bowlingmanager_mobile/features/records/share/score_share_data.dart';
import 'package:bowlingmanager_mobile/features/records/share/score_share_preview_sheet.dart';
import 'package:bowlingmanager_mobile/shared/share/share_image_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ScoreShareData', () {
    test('converts display fields and computes high without exposing memo', () {
      final ScoreShareData data = ScoreShareData.fromSession(
        session: _session(
          scores: const <int>[0, 245, 213],
          gameType: '  정기전  ',
          teamName: '  스트라이크 클럽  ',
          rank: const GameSessionRank(position: 2, participantCount: 24),
          total: 458,
          average: 152.7,
        ),
        displayName: '  테스트 볼러  ',
      );

      expect(data.displayName, '테스트 볼러');
      expect(data.dateLabel, '2026.09.22');
      expect(data.gameTypeLabel, '정기전');
      expect(data.teamLabel, '스트라이크 클럽');
      expect(data.scores, <int>[0, 245, 213]);
      expect(data.total, 458);
      expect(data.average, 152.7);
      expect(data.high, 245);
      expect(data.rankPosition, 2);
      expect(data.rankParticipantCount, 24);
    });

    test('uses personal record and source label fallbacks', () {
      final ScoreShareData data = ScoreShareData.fromSession(
        session: _session(
          scores: const <int>[300],
          gameType: ' ',
          source: GameSessionSource.tournament,
        ),
        displayName: '볼러',
      );

      expect(data.teamLabel, '개인 기록');
      expect(data.gameTypeLabel, '대회');
      expect(data.scores, <int>[300]);
      expect(data.high, 300);
    });

    test('keeps every score in its original order', () {
      final ScoreShareData data = ScoreShareData.fromSession(
        session: _session(scores: const <int>[101, 202, 150, 0, 300, 199]),
        displayName: '볼러',
      );

      expect(data.scores, <int>[101, 202, 150, 0, 300, 199]);
      expect(data.high, 300);
    });
  });

  testWidgets('card handles long values, many scores and no rank', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(420, 1800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final ScoreShareData data = ScoreShareData.fromSession(
      session: _session(
        scores: const <int>[0, 120, 180, 210, 250, 300],
        gameType: '아주 긴 경기 유형 이름이 여러 줄이 되어도 안전한 경기',
        teamName: '아주 긴 동호회 이름이 카드 너비를 넘어가도 안전한 볼링 동호회',
      ),
      displayName: '아주 긴 사용자 이름을 가진 테스트 볼러 이름입니다',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(child: ScoreShareCard(data: data)),
        ),
      ),
    );

    expect(find.byKey(const Key('score-share-rank')), findsNothing);
    for (int index = 0; index < 6; index++) {
      expect(find.byKey(Key('score-share-score-$index')), findsOneWidget);
    }
    expect(tester.takeException(), isNull);
  });

  testWidgets('preview shows card, share and close controls', (
    WidgetTester tester,
  ) async {
    await _pumpPreview(tester, _FakeShareService());

    expect(find.byKey(const Key('score-share-card')), findsOneWidget);
    expect(find.byKey(const Key('score-share-submit')), findsOneWidget);
    expect(find.byKey(const Key('score-share-close')), findsOneWidget);
  });

  testWidgets('preview prevents duplicate share while work is pending', (
    WidgetTester tester,
  ) async {
    final Completer<void> pending = Completer<void>();
    final _FakeShareService service = _FakeShareService(result: pending.future);
    await _pumpPreview(tester, service);

    await tester.tap(find.byKey(const Key('score-share-submit')));
    await tester.tap(find.byKey(const Key('score-share-submit')));
    await tester.pump();

    expect(service.callCount, 1);
    expect(find.byKey(const Key('score-share-progress')), findsOneWidget);
    pending.complete();
    await tester.pump();
  });

  testWidgets('preview reports image generation failure without crashing', (
    WidgetTester tester,
  ) async {
    final _FakeShareService service = _FakeShareService(
      error: StateError('capture failed'),
    );
    await _pumpPreview(tester, service);

    await tester.tap(find.byKey(const Key('score-share-submit')));
    await tester.pumpAndSettle();

    expect(service.callCount, 1);
    expect(find.textContaining('공유 이미지를 만들지 못했습니다'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Future<void> _pumpPreview(
  WidgetTester tester,
  ShareImageService service,
) async {
  await tester.binding.setSurfaceSize(const Size(420, 900));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: ScoreSharePreviewSheet(
          data: ScoreShareData.fromSession(
            session: _session(scores: const <int>[213, 245, 226]),
            displayName: '테스트 볼러',
          ),
          service: service,
        ),
      ),
    ),
  );
}

GameSession _session({
  required List<int> scores,
  String? gameType = '연습',
  String? teamName,
  GameSessionSource source = GameSessionSource.personal,
  GameSessionRank? rank,
  int? total,
  double? average,
}) {
  final int calculatedTotal = scores.fold<int>(
    0,
    (int sum, int score) => sum + score,
  );
  return GameSession(
    id: 'private-session-id',
    source: source,
    gameDate: DateTime.utc(2026, 9, 22),
    gameType: gameType,
    team: teamName == null
        ? null
        : GameSessionTeam(id: 'private-team-id', name: teamName),
    scores: <GameSessionScore>[
      for (int index = 0; index < scores.length; index++)
        GameSessionScore(
          id: 'private-score-$index',
          score: scores[index],
          memo: '공유하면 안 되는 메모',
        ),
    ],
    total: total ?? calculatedTotal,
    average: average ?? calculatedTotal / scores.length,
    gameCount: scores.length,
    rank: rank,
    activityId: 'private-activity-id',
  );
}

class _FakeShareService implements ShareImageService {
  _FakeShareService({Future<void>? result, this.error})
    : result = result ?? Future<void>.value();

  final Future<void> result;
  final Object? error;
  int callCount = 0;

  @override
  Future<void> share(
    GlobalKey boundaryKey, {
    required String fileName,
    required String text,
  }) async {
    callCount += 1;
    if (error case final Object currentError) throw currentError;
    await result;
  }
}
