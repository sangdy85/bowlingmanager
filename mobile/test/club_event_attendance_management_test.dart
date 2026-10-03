import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_events_api.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_events_repository.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_admin_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_event_detail_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';

void main() {
  testWidgets('owner manages a long member attendance list', (tester) async {
    final _AttendanceApi api = _AttendanceApi(role: 'OWNER');
    await _pumpDetail(tester, api);

    expect(find.byKey(const Key('event-admin-operations')), findsOneWidget);
    expect(find.byKey(const Key('attendance-management')), findsOneWidget);
    await tester.tap(find.byKey(const Key('attendance-management')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('attendance-management-list')), findsOneWidget);
    expect(find.text('회원 1'), findsOneWidget);
    await tester.tap(find.byKey(const Key('attendance-status-member-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('불참').last);
    await tester.pumpAndSettle();

    expect(api.changes, <String>['member-1:NOT_ATTENDING']);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'member sees the read-only attendance and guest lists without management action',
    (tester) async {
      await _pumpDetail(tester, _AttendanceApi(role: 'MEMBER'));
      expect(find.byKey(const Key('event-admin-operations')), findsNothing);
      expect(find.byKey(const Key('attendance-management')), findsNothing);
      expect(find.text('미응답 30'), findsOneWidget);
      await tester.tap(find.text('미응답 30'));
      await tester.pumpAndSettle();
      expect(find.text('회원 1'), findsOneWidget);
      await tester.tap(find.text('게스트 1'));
      await tester.pumpAndSettle();
      expect(find.text('게스트 회원'), findsOneWidget);
    },
  );

  testWidgets(
    'member attendance list remains visible after the event is locked',
    (tester) async {
      await _pumpDetail(tester, _AttendanceApi(role: 'MEMBER', locked: true));
      expect(find.text('미응답 30'), findsOneWidget);
      expect(find.byKey(const Key('attendance-management')), findsNothing);
    },
  );

  testWidgets(
    'manager attendance failure keeps the sheet and shows safe error',
    (tester) async {
      final _AttendanceApi api = _AttendanceApi(role: 'MANAGER')
        ..error = const ApiException(
          kind: ApiErrorKind.server,
          userMessage: '참석 상태를 저장하지 못했습니다.',
        );
      await _pumpDetail(tester, api);
      await tester.tap(find.byKey(const Key('attendance-management')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('attendance-status-member-1')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('참석').last);
      await tester.pumpAndSettle();

      expect(find.text('참석 상태를 저장하지 못했습니다.'), findsOneWidget);
      expect(
        find.byKey(const Key('attendance-management-list')),
        findsOneWidget,
      );
    },
  );
}

Future<void> _pumpDetail(WidgetTester tester, _AttendanceApi api) async {
  final FakeAuthRepository auth = FakeAuthRepository()
    ..bootstrapResult = testUser;
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(auth),
        clubEventsRepositoryProvider.overrideWithValue(
          ClubEventsRepository(api),
        ),
      ],
      child: const MaterialApp(
        home: ClubEventDetailScreen(teamId: 'team-1', eventId: 'event-1'),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

class _AttendanceApi extends ClubEventsApi {
  _AttendanceApi({required this.role, this.locked = false}) : super(Dio());

  final String role;
  final bool locked;
  final List<String> changes = <String>[];
  ApiException? error;

  @override
  Future<ClubEventAdminState> fetchAdminOperations(
    String teamId,
    String eventId,
  ) async => ClubEventAdminState.fromJson(<String, dynamic>{
    'eventId': eventId,
    'title': '10월 팀전',
    'competitionType': null,
    'competitionStatus': null,
    'laneDrawStatus': locked ? 'COMPLETED' : 'NOT_STARTED',
    'gameCount': null,
    'scoreCount': 0,
    'activePublicationCount': 0,
    'financeLinkCount': 0,
    'generation': 1,
    'teams': <Object>[],
    'unassignedParticipants': <Object>[],
    'eventParticipants': <Object>[],
    'audits': <Object>[],
  });

  @override
  Future<ClubEvent> fetchEvent(String teamId, String eventId) async =>
      ClubEvent.fromJson(<String, Object?>{
        'id': eventId,
        'teamId': teamId,
        'teamName': '테스트 동호회',
        'title': '10월 팀전',
        'date': '2026-10-10',
        'time': '19:00',
        'location': '서울 볼링장',
        'gameType': '정기전',
        'attendanceEnabled': true,
        'laneDrawEnabled': false,
        'laneDrawMode': 'BULK',
        'laneDrawStatus': locked ? 'COMPLETED' : 'NOT_STARTED',
        'myRole': role,
        'myAttendance': 'UNANSWERED',
        'counts': <String, int>{
          'attending': 0,
          'notAttending': 0,
          'unanswered': 30,
          'guests': 1,
        },
        'guests': <Object>[
          <String, Object>{'id': 'guest-1', 'name': '게스트 회원'},
        ],
        'slots': <Object>[],
        'assignments': <Object>[],
        'myAssignment': null,
        'attendance': <Object>[
          for (int index = 1; index <= 30; index++)
            <String, Object>{
              'memberId': 'member-$index',
              'name': '회원 $index',
              'status': 'UNANSWERED',
            },
        ],
        'bowlerHiddenEnabled': false,
        'competition': null,
      });

  @override
  Future<void> setMemberAttendance(
    String teamId,
    String eventId,
    String memberId,
    ClubEventAttendance status,
  ) async {
    if (error case final ApiException failure) throw failure;
    changes.add('$memberId:${status.apiValue}');
  }
}
