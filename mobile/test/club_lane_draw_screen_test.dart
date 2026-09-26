import 'dart:async';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_events_api.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_events_repository.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_lane_draw_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';

void main() {
  testWidgets(
    'cards hide lanes, disable while drawing and reveal server result',
    (tester) async {
      final api = _FakeEventsApi();
      await _pump(tester, api);

      expect(find.byKey(const Key('lane-draw-card-0')), findsOneWidget);
      expect(find.text('12-2'), findsNothing);
      await tester.tap(find.byKey(const Key('lane-draw-card-0')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('lane-draw-card-1')));
      expect(api.drawCount, 1);

      api.pending.complete(_assignment);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('lane-draw-result')), findsOneWidget);
      expect(find.text('12-2'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'already assigned member sees the existing lane without drawing',
    (tester) async {
      final api = _FakeEventsApi(event: _event(assignment: _assignment));
      await _pump(tester, api);
      expect(find.byKey(const Key('lane-draw-result')), findsOneWidget);
      expect(find.byKey(const Key('lane-draw-card-0')), findsNothing);
      expect(api.drawCount, 0);
    },
  );

  testWidgets('draw failure is safe and supports retry', (tester) async {
    final api = _FakeEventsApi()
      ..error = const ApiException(
        kind: ApiErrorKind.timeout,
        userMessage: '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
      );
    await _pump(tester, api);
    await tester.tap(find.byKey(const Key('lane-draw-card-0')));
    await tester.pumpAndSettle();
    expect(find.text('다시 시도'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Future<void> _pump(WidgetTester tester, _FakeEventsApi api) async {
  final auth = FakeAuthRepository()..bootstrapResult = testUser;
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(auth),
        clubEventsRepositoryProvider.overrideWithValue(
          ClubEventsRepository(api),
        ),
      ],
      child: const MaterialApp(
        home: ClubLaneDrawScreen(teamId: 'team-1', eventId: 'event-1'),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

class _FakeEventsApi extends ClubEventsApi {
  _FakeEventsApi({ClubEvent? event}) : event = event ?? _event(), super(Dio());

  final ClubEvent event;
  final Completer<ClubEventLaneAssignment> pending =
      Completer<ClubEventLaneAssignment>();
  Object? error;
  int drawCount = 0;

  @override
  Future<ClubEvent> fetchEvent(String teamId, String eventId) async => event;

  @override
  Future<ClubEventLaneAssignment> drawMine(
    String teamId,
    String eventId,
  ) async {
    drawCount += 1;
    if (error case final Object value) throw value;
    return pending.future;
  }
}

const ClubEventLaneAssignment _assignment = ClubEventLaneAssignment(
  id: 'assignment-1',
  memberId: 'member-1',
  guestId: null,
  name: '회원',
  laneNumber: 12,
  position: 2,
  label: '12-2',
);

ClubEvent _event({ClubEventLaneAssignment? assignment}) =>
    ClubEvent.fromJson(<String, Object?>{
      'id': 'event-1',
      'teamId': 'team-1',
      'teamName': '테스트 동호회',
      'title': '정기전',
      'date': '2026-09-26',
      'time': '19:00',
      'location': '테스트 볼링장',
      'gameType': '정기전',
      'attendanceEnabled': true,
      'laneDrawEnabled': true,
      'laneDrawMode': 'INDIVIDUAL',
      'laneDrawStatus': 'OPEN',
      'myRole': 'MEMBER',
      'myAttendance': 'ATTENDING',
      'counts': <String, int>{
        'attending': 2,
        'notAttending': 0,
        'unanswered': 0,
        'guests': 0,
      },
      'guests': <Object>[],
      'slots': <Object>[
        <String, Object>{'id': 'slot-1', 'laneNumber': 12, 'position': 1},
        <String, Object>{'id': 'slot-2', 'laneNumber': 12, 'position': 2},
      ],
      'assignments': assignment == null
          ? <Object>[]
          : <Object>[
              <String, Object?>{
                'id': assignment.id,
                'memberId': assignment.memberId,
                'guestId': assignment.guestId,
                'name': assignment.name,
                'laneNumber': assignment.laneNumber,
                'position': assignment.position,
                'label': assignment.label,
              },
            ],
      'myAssignment': assignment == null
          ? null
          : <String, Object?>{
              'id': assignment.id,
              'memberId': assignment.memberId,
              'guestId': assignment.guestId,
              'name': assignment.name,
              'laneNumber': assignment.laneNumber,
              'position': assignment.position,
              'label': assignment.label,
            },
      'attendance': null,
      'bowlerHiddenEnabled': false,
      'competition': null,
    });
