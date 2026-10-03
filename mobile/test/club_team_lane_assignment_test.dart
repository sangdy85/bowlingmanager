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
  testWidgets('manager preview follows team and participant order', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(700, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final _TeamActionApi api = _TeamActionApi();
    await _pumpCard(tester, api, _state(status: 'TEAMS_FINALIZED'));

    await tester.tap(find.byKey(const Key('assign-team-lanes')));
    await tester.pumpAndSettle();
    expect(_text(tester, 'lane-preview-participant-1'), '→ 1-1');
    expect(_text(tester, 'lane-preview-participant-2'), '→ 1-2');
    expect(_text(tester, 'lane-preview-participant-3'), '→ 2-1');

    await tester.tap(find.byKey(const Key('team-order-up-team-2')));
    await tester.pump();
    expect(_text(tester, 'lane-preview-participant-3'), '→ 1-1');
    expect(_text(tester, 'lane-preview-participant-1'), '→ 1-2');
    expect(_text(tester, 'lane-preview-participant-2'), '→ 2-1');

    await tester.ensureVisible(
      find.byKey(const Key('member-order-up-participant-2')),
    );
    await tester.tap(find.byKey(const Key('member-order-up-participant-2')));
    await tester.pump();
    expect(_text(tester, 'lane-preview-participant-2'), '→ 1-2');
    expect(_text(tester, 'lane-preview-participant-1'), '→ 2-1');

    await tester.tap(find.text('이 순서로 배정'));
    await tester.pumpAndSettle();
    expect(api.actions.single['action'], 'ASSIGN_LANES');
    final teams = api.actions.single['teams'] as List<dynamic>;
    expect(teams[0]['competitionTeamId'], 'team-2');
    expect(teams[0]['participantIds'], <String>['participant-3']);
    expect(teams[1]['participantIds'], <String>[
      'participant-2',
      'participant-1',
    ]);
  });

  testWidgets(
    'manager adjustment swaps occupied slots and moves to an empty slot',
    (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(700, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final _TeamActionApi api = _TeamActionApi();
      await _pumpCard(tester, api, _state(status: 'LANES_ASSIGNED'));

      await tester.tap(find.byKey(const Key('adjust-team-lanes')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('lane-adjust-participant-1')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('1-2').last);
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<DropdownButton<String>>(
              find.byKey(const Key('lane-adjust-participant-2')),
            )
            .value,
        'slot-1',
      );

      await tester.tap(find.byKey(const Key('lane-adjust-participant-3')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('2-2').last);
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('save-adjusted-team-lanes')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('confirm-adjust-team-lanes')));
      await tester.pumpAndSettle();

      expect(api.actions.single['action'], 'ADJUST_LANES');
      expect(api.actions.single['assignments'], <Map<String, String>>[
        <String, String>{'participantId': 'participant-1', 'slotId': 'slot-2'},
        <String, String>{'participantId': 'participant-2', 'slotId': 'slot-1'},
        <String, String>{'participantId': 'participant-3', 'slotId': 'slot-4'},
      ]);
    },
  );

  testWidgets(
    'member sees lane assignments and draft history without adjustment',
    (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(700, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final _TeamActionApi api = _TeamActionApi();
      await _pumpCard(
        tester,
        api,
        _state(status: 'LANES_ASSIGNED', canManage: false, withHistory: true),
      );

      expect(find.byKey(const Key('adjust-team-lanes')), findsNothing);
      expect(find.text('1-1'), findsOneWidget);
      expect(find.text('1-2'), findsOneWidget);
      await tester.tap(find.text('TEAM 2'));
      await tester.pumpAndSettle();
      expect(find.text('2-1'), findsOneWidget);
      expect(find.byKey(const Key('team-draft-history')), findsOneWidget);
    },
  );

  testWidgets('assigned lane capacity change requires reset confirmation', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(700, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final _TeamActionApi api = _TeamActionApi();
    await _pumpCard(tester, api, _state(status: 'LANES_ASSIGNED'));

    await tester.tap(find.byKey(const Key('configure-team-lanes')));
    await tester.pumpAndSettle();
    expect(find.text('레인 배정을 다시 설정하면 현재 레인 배정이 초기화됩니다.'), findsOneWidget);
    await tester.tap(find.byKey(const Key('confirm-reset-lane-capacity')));
    await tester.pumpAndSettle();
    expect(find.text('참가자 3명 · 선택 좌석 4개'), findsOneWidget);
    await tester.tap(find.byKey(const Key('decrease-team-lane-2')));
    await tester.pump();
    expect(find.text('배정 가능'), findsOneWidget);
    await tester.tap(find.byKey(const Key('save-team-lanes')));
    await tester.pumpAndSettle();

    expect(api.resetAssignments, isTrue);
    expect(api.savedSlots, <({int laneNumber, int position})>[
      (laneNumber: 1, position: 1),
      (laneNumber: 1, position: 2),
      (laneNumber: 2, position: 1),
    ]);
  });

  testWidgets('nonconsecutive existing slots are reported and blocked', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(700, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final _TeamActionApi api = _TeamActionApi();
    await _pumpCard(
      tester,
      api,
      _state(
        status: 'TEAMS_FINALIZED',
        laneSlots: <Object>[
          <String, Object>{'id': 'slot-1', 'laneNumber': 1, 'position': 1},
          <String, Object>{'id': 'slot-3', 'laneNumber': 1, 'position': 3},
        ],
      ),
    );

    await tester.tap(find.byKey(const Key('configure-team-lanes')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('invalid-team-lane-capacity')), findsOneWidget);
    expect(find.textContaining('1번 레인의 자리 번호가'), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(find.byKey(const Key('save-team-lanes')))
          .onPressed,
      isNull,
    );

    await tester.tap(find.byKey(const Key('decrease-team-lane-1')));
    await tester.pump();
    expect(find.byKey(const Key('invalid-team-lane-capacity')), findsNothing);
    expect(
      tester
          .widget<FilledButton>(find.byKey(const Key('save-team-lanes')))
          .onPressed,
      isNotNull,
    );
  });
}

String _text(WidgetTester tester, String key) =>
    tester.widget<Text>(find.byKey(Key(key))).data!;

Future<void> _pumpCard(
  WidgetTester tester,
  ClubEventsApi api,
  ClubTeamCompetitionState state,
) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        clubEventsApiProvider.overrideWithValue(api),
        clubTeamCompetitionProvider.overrideWith((ref, request) async => state),
      ],
      child: const MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: ClubTeamCompetitionCard(
              userId: 'user-1',
              teamId: 'team-1',
              eventId: 'event-1',
              competitionMode: ClubCompetitionMode.official,
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

ClubTeamCompetitionState _state({
  required String status,
  bool canManage = true,
  bool withHistory = false,
  List<Object>? laneSlots,
}) => ClubTeamCompetitionState.fromJson(<String, dynamic>{
  'generation': 2,
  'status': status,
  'canManage': canManage,
  'isCurrentCaptain': false,
  'currentTurn': null,
  'laneNumbers': <int>[1, 2],
  'laneSlots':
      laneSlots ??
      <Object>[
        <String, Object>{'id': 'slot-1', 'laneNumber': 1, 'position': 1},
        <String, Object>{'id': 'slot-2', 'laneNumber': 1, 'position': 2},
        <String, Object>{'id': 'slot-3', 'laneNumber': 2, 'position': 1},
        <String, Object>{'id': 'slot-4', 'laneNumber': 2, 'position': 2},
      ],
  'teams': <Object>[
    _team('team-1', 1, <Map<String, Object?>>[
      _participant(
        'participant-1',
        'member-1',
        '홍길동',
        status == 'LANES_ASSIGNED' ? '1-1' : null,
      ),
      _participant(
        'participant-2',
        'member-2',
        '김철수',
        status == 'LANES_ASSIGNED' ? '1-2' : null,
      ),
    ]),
    _team('team-2', 2, <Map<String, Object?>>[
      _participant(
        'participant-3',
        'member-3',
        '이영희',
        status == 'LANES_ASSIGNED' ? '2-1' : null,
      ),
    ]),
  ],
  'remainingParticipants': <Object>[],
  'history': withHistory
      ? <Object>[
          <String, Object>{
            'id': 'pick-1',
            'pickNumber': 1,
            'roundNumber': 1,
            'pickType': 'CAPTAIN_PICK',
            'teamName': 'TEAM 1',
            'selectedDisplayName': '김철수',
          },
        ]
      : <Object>[],
  'myTeam': 'team-1',
  'results': <String, Object>{
    'complete': false,
    'requiresPinTieBreakPolicy': false,
    'teams': <Object>[],
  },
});

Map<String, Object?> _team(
  String id,
  int order,
  List<Map<String, Object?>> members,
) => <String, Object?>{
  'id': id,
  'name': 'TEAM $order',
  'draftOrder': order,
  'lanePriority': order,
  'teamHandicap': 0,
  'captainMemberId': members.first['memberId'],
  'captainName': members.first['name'],
  'members': members,
};

Map<String, Object?> _participant(
  String participantId,
  String memberId,
  String name,
  String? laneSlot,
) => <String, Object?>{
  'participantId': participantId,
  'participantKind': 'MEMBER',
  'memberId': memberId,
  'guestId': null,
  'name': name,
  'assignmentType': 'DRAFT',
  'assignmentOrder': 1,
  'laneSlot': laneSlot,
};

class _TeamActionApi extends ClubEventsApi {
  _TeamActionApi() : super(Dio());

  final List<Map<String, dynamic>> actions = <Map<String, dynamic>>[];
  List<({int laneNumber, int position})> savedSlots =
      <({int laneNumber, int position})>[];
  bool resetAssignments = false;

  @override
  Future<void> teamCompetitionAction(
    String teamId,
    String eventId,
    Map<String, dynamic> action,
  ) async {
    actions.add(Map<String, dynamic>.from(action));
  }

  @override
  Future<void> replaceLaneSlots(
    String teamId,
    String eventId,
    List<({int laneNumber, int position})> slots, {
    bool resetAssignments = false,
  }) async {
    savedSlots = List<({int laneNumber, int position})>.from(slots);
    this.resetAssignments = resetAssignments;
  }
}
