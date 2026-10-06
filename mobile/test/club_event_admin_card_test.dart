import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_events_api.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_admin_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_event_admin_card.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'admin state parses nullable legacy game count and intervention data',
    () {
      final state = ClubEventAdminState.fromJson(
        _stateJson(gameCount: null, scoreCount: 4, publicationCount: 1),
      );
      expect(state.gameCount, isNull);
      expect(state.scoreCount, 4);
      expect(state.isPublished, isFalse);
      expect(state.teams.single.members.single.name, '팀장');
      expect(state.eventParticipants.single.hasBallot, isTrue);
    },
  );

  testWidgets(
    'administrator danger zone shows legacy configuration and exact score warning',
    (tester) async {
      final api = _AdminApi(
        ClubEventAdminState.fromJson(
          _stateJson(gameCount: null, scoreCount: 7),
        ),
      );
      await _pump(tester, api);

      expect(find.byKey(const Key('event-admin-operations')), findsOneWidget);
      expect(
        find.byKey(const Key('legacy-game-count-warning')),
        findsOneWidget,
      );
      expect(find.byKey(const Key('admin-clear-scores')), findsOneWidget);

      await tester.ensureVisible(find.byKey(const Key('admin-clear-scores')));
      await tester.tap(find.byKey(const Key('admin-clear-scores')));
      await tester.pumpAndSettle();
      expect(find.text('현재 입력된 경기 점수 7건이 삭제됩니다.'), findsOneWidget);
      await tester.enterText(
        find.byKey(const Key('admin-confirm-title')),
        '가을 정기전',
      );
      await tester.pump();
      await tester.tap(find.widgetWithText(FilledButton, '확인'));
      await tester.pumpAndSettle();

      expect(api.actions.single['action'], 'CLEAR_SCORES');
      expect(api.actions.single['clearScores'], isTrue);
      expect(api.fetchCount, greaterThan(1));
    },
  );

  testWidgets(
    'TEAM finalized state offers manual full assignment and warns when unbalanced',
    (tester) async {
      final json = _stateJson(type: 'TEAM', status: 'TEAMS_FINALIZED');
      json['teams'] = <Object>[
        <String, Object>{
          'id': 'team-a',
          'name': 'TEAM A',
          'captainMemberId': 'member-a',
          'members': <Object>[
            _participant('p-a', '팀장A', memberId: 'member-a'),
            _participant('p-c', '회원C', memberId: 'member-c'),
          ],
        },
        <String, Object>{
          'id': 'team-b',
          'name': 'TEAM B',
          'captainMemberId': 'member-b',
          'members': <Object>[_participant('p-b', '팀장B', memberId: 'member-b')],
        },
      ];
      final api = _AdminApi(ClubEventAdminState.fromJson(json));
      await _pump(tester, api);

      await tester.ensureVisible(find.byKey(const Key('admin-team-override')));
      await tester.tap(find.byKey(const Key('admin-team-override')));
      await tester.pumpAndSettle();
      expect(find.text('팀 인원수가 동일하지 않습니다.'), findsOneWidget);
      expect(find.byKey(const Key('admin-team-p-a')), findsOneWidget);
      expect(find.byKey(const Key('admin-team-p-b')), findsOneWidget);
      expect(find.byKey(const Key('admin-team-p-c')), findsOneWidget);
    },
  );

  testWidgets('TEAM attendance lock exposes attendance reopen action', (
    tester,
  ) async {
    final api = _AdminApi(
      ClubEventAdminState.fromJson(
        _stateJson(type: 'TEAM', status: 'ATTENDANCE_LOCKED'),
      ),
    );
    await _pump(tester, api);

    await tester.ensureVisible(
      find.byKey(const Key('admin-reopen-attendance')),
    );
    expect(find.text('참석자 마감 해제'), findsOneWidget);
    await tester.tap(find.byKey(const Key('admin-reopen-attendance')));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, '확인'));
    await tester.pumpAndSettle();

    expect(api.actions.single['action'], 'REOPEN_ATTENDANCE');
  });

  testWidgets(
    'EVENT reveal state exposes voting reset choices and new duration',
    (tester) async {
      final api = _AdminApi(
        ClubEventAdminState.fromJson(
          _stateJson(type: 'EVENT', status: 'REVEALING'),
        ),
      );
      await _pump(tester, api);

      await tester.ensureVisible(
        find.byKey(const Key('admin-reset-event-voting')),
      );
      await tester.tap(find.byKey(const Key('admin-reset-event-voting')));
      await tester.pumpAndSettle();
      expect(find.text('전체 초기화'), findsOneWidget);
      expect(find.text('현재 투표 유지'), findsOneWidget);
      expect(find.text('20분'), findsOneWidget);
    },
  );

  testWidgets(
    'published delete warns for publication, scores and retained finance records',
    (tester) async {
      final api = _AdminApi(
        ClubEventAdminState.fromJson(
          _stateJson(
            status: 'PUBLISHED',
            scoreCount: 3,
            publicationCount: 1,
            financeCount: 2,
          ),
        ),
      );
      await _pump(tester, api);

      expect(find.byKey(const Key('admin-reopen-publication')), findsOneWidget);
      await tester.ensureVisible(find.byKey(const Key('admin-delete-event')));
      await tester.tap(find.byKey(const Key('admin-delete-event')));
      await tester.pumpAndSettle();
      expect(find.text('현재 입력된 경기 점수 3건이 삭제됩니다.'), findsOneWidget);
      expect(find.text('발표된 시즌 포인트가 취소됩니다.'), findsOneWidget);
      expect(find.text('게임비/회비 기록은 유지되며 일정 연결만 해제됩니다.'), findsOneWidget);
    },
  );
}

Future<void> _pump(WidgetTester tester, _AdminApi api) async {
  await tester.binding.setSurfaceSize(const Size(540, 1100));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    ProviderScope(
      overrides: [clubEventsApiProvider.overrideWithValue(api)],
      child: MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: ClubEventAdminCard(
              userId: 'owner',
              teamId: 'team-1',
              eventId: 'event-1',
              onDeleted: () {},
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Map<String, dynamic> _stateJson({
  String type = 'INDIVIDUAL',
  String status = 'GROUPS_READY',
  int? gameCount = 3,
  int scoreCount = 0,
  int publicationCount = 0,
  int financeCount = 0,
}) => <String, dynamic>{
  'eventId': 'event-1',
  'title': '가을 정기전',
  'competitionType': type,
  'competitionStatus': status,
  'laneDrawStatus': 'NOT_STARTED',
  'gameCount': gameCount,
  'scoreCount': scoreCount,
  'activePublicationCount': publicationCount,
  'financeLinkCount': financeCount,
  'generation': 1,
  'teams': <Object>[
    <String, Object>{
      'id': 'team-a',
      'name': 'TEAM A',
      'captainMemberId': 'member-a',
      'members': <Object>[_participant('p-a', '팀장', memberId: 'member-a')],
    },
  ],
  'unassignedParticipants': <Object>[],
  'eventParticipants': <Object>[
    <String, Object>{'participantId': 'ep-a', 'name': '투표자', 'hasBallot': true},
  ],
  'audits': <Object>[],
};

Map<String, Object?> _participant(String id, String name, {String? memberId}) =>
    <String, Object?>{
      'participantId': id,
      'participantKind': memberId == null ? 'GUEST' : 'MEMBER',
      'memberId': memberId,
      'guestId': memberId == null ? 'guest-$id' : null,
      'name': name,
      'assignmentType': 'DRAFT',
    };

class _AdminApi extends ClubEventsApi {
  _AdminApi(this.state) : super(Dio());

  final ClubEventAdminState state;
  final List<Map<String, dynamic>> actions = <Map<String, dynamic>>[];
  int fetchCount = 0;

  @override
  Future<ClubEventAdminState> fetchAdminOperations(
    String teamId,
    String eventId,
  ) async {
    fetchCount += 1;
    return state;
  }

  @override
  Future<void> runAdminOperation(
    String teamId,
    String eventId,
    Map<String, dynamic> body,
  ) async {
    actions.add(Map<String, dynamic>.from(body));
  }
}
