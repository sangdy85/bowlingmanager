import 'dart:async';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_events_api.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_team_competition_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_team_competition_card.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('late-add action is shown only in the allowed TEAM phases', (
    WidgetTester tester,
  ) async {
    for (final String status in <String>[
      'ATTENDANCE_LOCKED',
      'DRAFT_READY',
      'DRAFT_IN_PROGRESS',
      'LUCKY_DRAW',
      'TEAMS_FINALIZED',
      'LANES_ASSIGNED',
    ]) {
      await _pumpCard(tester, api: _LateParticipantApi(), status: status);
      expect(
        find.byKey(const Key('add-late-participant')),
        findsOneWidget,
        reason: status,
      );
    }
    for (final String status in <String>['ATTENDANCE_OPEN', 'PUBLISHED']) {
      await _pumpCard(tester, api: _LateParticipantApi(), status: status);
      expect(
        find.byKey(const Key('add-late-participant')),
        findsNothing,
        reason: status,
      );
    }
  });

  testWidgets('locked TEAM adds an eligible member without a reset warning', (
    WidgetTester tester,
  ) async {
    final _LateParticipantApi api = _LateParticipantApi();
    int providerLoads = 0;
    await _pumpCard(
      tester,
      api: api,
      status: 'ATTENDANCE_LOCKED',
      onProviderLoad: () => providerLoads += 1,
    );

    await tester.tap(find.byKey(const Key('add-late-participant')));
    await tester.pumpAndSettle();
    expect(find.text('늦은 참가자 추가'), findsNWidgets(2));
    expect(find.textContaining('초기화는 발생하지 않습니다'), findsOneWidget);
    expect(find.text('참가 중 회원'), findsNothing);
    expect(find.text('추가 가능 회원'), findsOneWidget);
    await tester.tap(find.byKey(const Key('confirm-late-participant')));
    await tester.pumpAndSettle();

    expect(api.actions, <Map<String, dynamic>>[
      <String, dynamic>{
        'action': 'ADD_LATE_PARTICIPANT',
        'participantKind': 'MEMBER',
        'memberId': 'member-2',
      },
    ]);
    expect(providerLoads, greaterThanOrEqualTo(2));
    expect(find.text('늦은 참가자를 추가했습니다.'), findsOneWidget);
  });

  testWidgets('drafted TEAM warns, accepts a guest, and supports cancel', (
    WidgetTester tester,
  ) async {
    final _LateParticipantApi api = _LateParticipantApi();
    await _pumpCard(tester, api: api, status: 'DRAFT_READY');

    await tester.tap(find.byKey(const Key('add-late-participant')));
    await tester.pumpAndSettle();
    expect(find.text('참가자 추가 및 팀 편성 초기화'), findsOneWidget);
    expect(find.textContaining('팀장 선정과 드래프트 결과가 모두 초기화'), findsOneWidget);
    expect(find.text('추가하고 다시 편성'), findsOneWidget);
    await tester.tap(find.text('취소'));
    await tester.pumpAndSettle();
    expect(api.actions, isEmpty);

    await tester.tap(find.byKey(const Key('add-late-participant')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('게스트'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('late-guest-name')), '새 게스트');
    await tester.pump();
    await tester.tap(find.byKey(const Key('confirm-late-participant')));
    await tester.pumpAndSettle();
    expect(api.actions.single, <String, dynamic>{
      'action': 'ADD_LATE_PARTICIPANT',
      'participantKind': 'GUEST',
      'guestName': '새 게스트',
    });
    expect(find.textContaining('기존 드래프트가 초기화되었습니다'), findsOneWidget);
  });

  testWidgets('lane-assigned TEAM warning includes lane reset', (
    WidgetTester tester,
  ) async {
    await _pumpCard(
      tester,
      api: _LateParticipantApi(),
      status: 'LANES_ASSIGNED',
    );
    await tester.tap(find.byKey(const Key('add-late-participant')));
    await tester.pumpAndSettle();
    expect(find.textContaining('기존 레인 배정도 초기화'), findsOneWidget);
  });

  testWidgets('member cannot see late-add and score error is shown safely', (
    WidgetTester tester,
  ) async {
    await _pumpCard(
      tester,
      api: _LateParticipantApi(),
      status: 'ATTENDANCE_LOCKED',
      canManage: false,
    );
    expect(find.byKey(const Key('add-late-participant')), findsNothing);

    final _LateParticipantApi failing = _LateParticipantApi()
      ..error = const ApiException(
        kind: ApiErrorKind.server,
        code: 'COMPETITION_SCORE_STARTED',
        userMessage: '이미 경기 점수가 입력되어 참가자를 변경할 수 없습니다.',
      );
    await _pumpCard(tester, api: failing, status: 'ATTENDANCE_LOCKED');
    await tester.tap(find.byKey(const Key('add-late-participant')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('confirm-late-participant')));
    await tester.pumpAndSettle();
    expect(find.text('이미 경기 점수가 입력되어 참가자를 변경할 수 없습니다.'), findsOneWidget);
  });

  testWidgets('late-add blocks a second tap while the request is in flight', (
    WidgetTester tester,
  ) async {
    final Completer<void> pending = Completer<void>();
    final _LateParticipantApi api = _LateParticipantApi()..pending = pending;
    await _pumpCard(tester, api: api, status: 'ATTENDANCE_LOCKED');
    await tester.tap(find.byKey(const Key('add-late-participant')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('confirm-late-participant')));
    await tester.pump();
    expect(api.actions, hasLength(1));
    final OutlinedButton button = tester.widget<OutlinedButton>(
      find.byKey(const Key('add-late-participant')),
    );
    expect(button.onPressed, isNull);
    pending.complete();
    await tester.pumpAndSettle();
    expect(api.actions, hasLength(1));
  });
}

Future<void> _pumpCard(
  WidgetTester tester, {
  required _LateParticipantApi api,
  required String status,
  bool canManage = true,
  void Function()? onProviderLoad,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      key: UniqueKey(),
      overrides: [
        clubEventsApiProvider.overrideWithValue(api),
        clubTeamCompetitionProvider.overrideWith((ref, request) async {
          onProviderLoad?.call();
          return ClubTeamCompetitionState.fromJson(_state(status, canManage));
        }),
      ],
      child: MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: ClubTeamCompetitionCard(
              userId: 'user-1',
              teamId: 'team-1',
              eventId: 'event-1',
              competitionMode: ClubCompetitionMode.official,
              attendance: const <ClubEventAttendanceItem>[
                ClubEventAttendanceItem(
                  memberId: 'member-1',
                  name: '참가 중 회원',
                  status: ClubEventAttendance.attending,
                ),
                ClubEventAttendanceItem(
                  memberId: 'member-2',
                  name: '추가 가능 회원',
                  status: ClubEventAttendance.notAttending,
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Map<String, dynamic> _state(String status, bool canManage) => <String, dynamic>{
  'generation': 2,
  'status': status,
  'canManage': canManage,
  'isCurrentCaptain': false,
  'currentTurn': null,
  'laneNumbers': status == 'LANES_ASSIGNED' ? <int>[1] : <int>[],
  'teams': <Object>[],
  'remainingParticipants': <Object>[],
  'history': <Object>[],
  'myTeam': null,
  'results': <String, Object>{
    'complete': false,
    'requiresPinTieBreakPolicy': false,
    'individual': <Object>[],
    'games': <Object>[],
    'teams': <Object>[],
  },
};

class _LateParticipantApi extends ClubEventsApi {
  _LateParticipantApi() : super(Dio());

  final List<Map<String, dynamic>> actions = <Map<String, dynamic>>[];
  ApiException? error;
  Completer<void>? pending;

  @override
  Future<void> teamCompetitionAction(
    String teamId,
    String eventId,
    Map<String, dynamic> action,
  ) async {
    actions.add(Map<String, dynamic>.from(action));
    if (error case final ApiException failure) throw failure;
    if (pending case final Completer<void> completer) await completer.future;
  }
}
