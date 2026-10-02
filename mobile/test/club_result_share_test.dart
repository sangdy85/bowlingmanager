import 'dart:async';

import 'package:bowlingmanager_mobile/features/club/domain/club_records_models.dart';
import 'package:bowlingmanager_mobile/features/club/share/club_result_share_card.dart';
import 'package:bowlingmanager_mobile/features/club/share/club_result_share_data.dart';
import 'package:bowlingmanager_mobile/features/club/share/club_result_share_preview_sheet.dart';
import 'package:bowlingmanager_mobile/shared/share/share_image_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ClubResultShareData', () {
    test('converts activity fields and orders the top three by rank', () {
      final ClubResultShareData data = ClubResultShareData.fromActivity(
        activity: _activity(
          participants: <ClubActivityParticipant>[
            _participant(rank: 3, id: 'third', name: '이선수'),
            _participant(rank: 1, id: 'first', name: '홍길동'),
            _participant(rank: 4, id: 'mine', name: '내이름'),
            _participant(rank: 2, id: 'second', name: '김볼러'),
          ],
        ),
        clubName: '  테스트 동호회  ',
        currentMemberId: 'mine',
      );

      expect(data.clubName, '테스트 동호회');
      expect(data.dateLabel, '2026.09.19');
      expect(data.gameTypeLabel, '정기전');
      expect(data.participantCount, 4);
      expect(data.gameCount, 3);
      expect(data.dailyAverage, 210.5);
      expect(data.topParticipants.map((item) => item.rank), <int>[1, 2, 3]);
      expect(data.currentUserOutsideTopThree?.rank, 4);
      expect(data.currentUserOutsideTopThree?.isCurrentUser, isTrue);
    });

    for (final int participantCount in <int>[1, 2, 3]) {
      test('supports $participantCount participant(s)', () {
        final ClubResultShareData data = ClubResultShareData.fromActivity(
          activity: _activity(
            participants: <ClubActivityParticipant>[
              for (int rank = 1; rank <= participantCount; rank++)
                _participant(rank: rank, id: 'member-$rank'),
            ],
          ),
        );

        expect(data.topParticipants, hasLength(participantCount));
        expect(data.currentUserOutsideTopThree, isNull);
      });
    }

    test('shows no duplicate my record when current user is in top three', () {
      final ClubResultShareData data = ClubResultShareData.fromActivity(
        activity: _activity(
          participants: <ClubActivityParticipant>[
            for (int rank = 1; rank <= 4; rank++)
              _participant(rank: rank, id: 'member-$rank'),
          ],
        ),
        currentMemberId: 'member-2',
      );

      expect(data.topParticipants, hasLength(3));
      expect(data.currentUserOutsideTopThree, isNull);
    });

    test('uses top three only when current member id is null', () {
      final ClubResultShareData data = ClubResultShareData.fromActivity(
        activity: _activity(
          participants: <ClubActivityParticipant>[
            for (int rank = 1; rank <= 5; rank++)
              _participant(rank: rank, id: 'member-$rank'),
          ],
        ),
      );

      expect(data.topParticipants.map((item) => item.rank), <int>[1, 2, 3]);
      expect(data.currentUserOutsideTopThree, isNull);
    });

    test('keeps every actual score and does not pad different game counts', () {
      final ClubResultShareData data = ClubResultShareData.fromActivity(
        activity: _activity(
          participants: <ClubActivityParticipant>[
            _participant(
              rank: 1,
              id: 'member-1',
              scores: const <int>[0, 180, 210, 300, 199, 220],
            ),
            _participant(
              rank: 2,
              id: 'member-2',
              scores: const <int>[200, 210],
            ),
          ],
        ),
      );

      expect(data.participants.first.scores, <int>[0, 180, 210, 300, 199, 220]);
      expect(data.participants.last.scores, <int>[200, 210]);
    });

    test('uses safe club name and game type fallbacks', () {
      final ClubResultShareData data = ClubResultShareData.fromActivity(
        activity: _activity(
          gameType: ' ',
          participants: <ClubActivityParticipant>[
            _participant(rank: 1, id: 'member-1'),
          ],
        ),
        clubName: ' ',
      );

      expect(data.clubName, isNull);
      expect(data.clubNameLabel, '동호회 경기 결과');
      expect(data.gameTypeLabel, '경기 기록');
    });
  });

  test('maskShareName follows the privacy rules', () {
    expect(maskShareName(' 홍길동 '), '홍**');
    expect(maskShareName('John'), 'J***');
    expect(maskShareName('AB'), 'A*');
    expect(maskShareName('A'), 'A');
    expect(maskShareName('  '), '볼러');
  });

  testWidgets('card shows top three and a separate lower-ranked current user', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(420, 2200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final ClubResultShareData data = ClubResultShareData.fromActivity(
      activity: _activity(
        participants: <ClubActivityParticipant>[
          for (int rank = 1; rank <= 4; rank++)
            _participant(rank: rank, id: 'member-$rank'),
        ],
      ),
      currentMemberId: 'member-4',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: ClubResultShareCard(data: data, maskNames: true),
          ),
        ),
      ),
    );

    for (int rank = 1; rank <= 4; rank++) {
      expect(find.byKey(Key('club-result-share-rank-$rank')), findsOneWidget);
    }
    expect(
      find.byKey(const Key('club-result-share-my-record')),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('card handles long text, large values and six games', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(420, 2400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final ClubResultShareData data = ClubResultShareData.fromActivity(
      activity: _activity(
        gameType: '매우 긴 정기 교류 경기 이름이 카드 너비를 넘어가는 경기 유형',
        dailyAverage: 300,
        participants: <ClubActivityParticipant>[
          for (int rank = 1; rank <= 3; rank++)
            _participant(
              rank: rank,
              id: 'member-$rank',
              name: '매우 긴 참가자 이름이 여러 줄로 표시되는 테스트 볼러 $rank',
              scores: const <int>[300, 300, 300, 300, 300, 300],
              total: 1800,
              average: 300,
            ),
        ],
      ),
      clubName: '매우 긴 동호회 이름이 두 줄을 넘어가도 안전해야 하는 볼링 동호회',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: ClubResultShareCard(data: data, maskNames: false),
          ),
        ),
      ),
    );

    for (int rank = 1; rank <= 3; rank++) {
      for (int index = 0; index < 6; index++) {
        expect(
          find.byKey(Key('club-result-share-$rank-score-$index')),
          findsOneWidget,
        );
      }
    }
    expect(tester.takeException(), isNull);
  });

  testWidgets('preview masks names by default and toggle reveals them', (
    WidgetTester tester,
  ) async {
    await _pumpPreview(tester, _FakeShareImageService());

    final SwitchListTile toggle = tester.widget<SwitchListTile>(
      find.byKey(const Key('club-result-share-mask')),
    );
    expect(toggle.value, isTrue);
    expect(find.text('홍**'), findsOneWidget);
    expect(find.text('홍길동'), findsNothing);

    await tester.tap(find.byKey(const Key('club-result-share-mask')));
    await tester.pump();

    expect(find.text('홍길동'), findsOneWidget);
    expect(find.byKey(const Key('club-result-share-card')), findsOneWidget);
    expect(find.byKey(const Key('club-result-share-submit')), findsOneWidget);
    expect(find.byKey(const Key('club-result-share-close')), findsOneWidget);
  });

  testWidgets('preview prevents duplicate sharing while pending', (
    WidgetTester tester,
  ) async {
    final Completer<void> pending = Completer<void>();
    final _FakeShareImageService service = _FakeShareImageService(
      result: pending.future,
    );
    await _pumpPreview(tester, service);

    await tester.tap(find.byKey(const Key('club-result-share-submit')));
    await tester.tap(find.byKey(const Key('club-result-share-submit')));
    await tester.pump();

    expect(service.callCount, 1);
    expect(find.byKey(const Key('club-result-share-progress')), findsOneWidget);
    pending.complete();
    await tester.pump();
  });

  testWidgets('preview reports a real image share failure without crashing', (
    WidgetTester tester,
  ) async {
    final _FakeShareImageService service = _FakeShareImageService(
      error: StateError('capture failed'),
    );
    await _pumpPreview(tester, service);

    await tester.tap(find.byKey(const Key('club-result-share-submit')));
    await tester.pumpAndSettle();

    expect(service.callCount, 1);
    expect(find.textContaining('공유 이미지를 만들지 못했습니다'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('share sheet dismissal completion is not shown as an error', (
    WidgetTester tester,
  ) async {
    final _FakeShareImageService service = _FakeShareImageService();
    await _pumpPreview(tester, service);

    await tester.tap(find.byKey(const Key('club-result-share-submit')));
    await tester.pumpAndSettle();

    expect(service.callCount, 1);
    expect(service.fileName, 'bowlingmanager-club-result.png');
    expect(service.text, '테스트 동호회 경기 결과입니다.');
    expect(find.byType(SnackBar), findsNothing);
  });
}

Future<void> _pumpPreview(
  WidgetTester tester,
  ShareImageService service,
) async {
  await tester.binding.setSurfaceSize(const Size(420, 900));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  final ClubResultShareData data = ClubResultShareData.fromActivity(
    activity: _activity(
      participants: <ClubActivityParticipant>[
        _participant(rank: 1, id: 'member-1', name: '홍길동'),
      ],
    ),
    clubName: '테스트 동호회',
    currentMemberId: 'member-1',
  );
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: ClubResultSharePreviewSheet(data: data, service: service),
      ),
    ),
  );
}

ClubActivityFeedItem _activity({
  required List<ClubActivityParticipant> participants,
  String? gameType = '정기전',
  double dailyAverage = 210.5,
}) {
  return ClubActivityFeedItem(
    id: 'private-activity-id',
    date: DateTime.utc(2026, 9, 19),
    gameType: gameType,
    participantCount: participants.length,
    gameCount: 3,
    dailyAverage: dailyAverage,
    participants: participants,
    canManage: true,
  );
}

ClubActivityParticipant _participant({
  required int rank,
  required String id,
  String? name,
  List<int> scores = const <int>[200, 210, 220],
  int total = 630,
  double average = 210,
}) {
  return ClubActivityParticipant(
    rank: rank,
    id: id,
    name: name ?? '볼러 $rank',
    scores: scores,
    total: total,
    average: average,
  );
}

class _FakeShareImageService implements ShareImageService {
  _FakeShareImageService({Future<void>? result, this.error})
    : result = result ?? Future<void>.value();

  final Future<void> result;
  final Object? error;
  int callCount = 0;
  String? fileName;
  String? text;

  @override
  Future<void> share(
    GlobalKey boundaryKey, {
    required String fileName,
    required String text,
  }) async {
    callCount += 1;
    this.fileName = fileName;
    this.text = text;
    if (error case final Object currentError) throw currentError;
    await result;
  }
}
