import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_events_api.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_events_repository.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_events_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'support/auth_fakes.dart';

void main() {
  testWidgets('upcoming list always links to separately ordered past events', (
    tester,
  ) async {
    final api = _FakeEventsApi();
    final auth = FakeAuthRepository()..bootstrapResult = testUser;
    final router = GoRouter(
      initialLocation: '/club/team-1/events',
      routes: <RouteBase>[
        GoRoute(
          path: '/club/:teamId/events',
          builder: (_, _) => const ClubEventsScreen(teamId: 'team-1'),
          routes: <RouteBase>[
            GoRoute(
              path: 'past',
              builder: (_, _) =>
                  const ClubEventsScreen(teamId: 'team-1', past: true),
            ),
          ],
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(auth),
          clubEventsRepositoryProvider.overrideWithValue(
            ClubEventsRepository(api),
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('예정 경기'), findsOneWidget);
    expect(find.text('지난 경기'), findsNothing);
    expect(find.byKey(const Key('club-past-events')), findsOneWidget);
    expect(api.scopes, <ClubEventListScope>[ClubEventListScope.upcoming]);

    await tester.tap(find.byKey(const Key('club-past-events')));
    await tester.pumpAndSettle();
    expect(find.text('지난 경기 기록'), findsOneWidget);
    expect(find.text('지난 경기'), findsOneWidget);
    expect(api.scopes, <ClubEventListScope>[
      ClubEventListScope.upcoming,
      ClubEventListScope.past,
    ]);
    expect(tester.takeException(), isNull);
  });
}

class _FakeEventsApi extends ClubEventsApi {
  _FakeEventsApi() : super(Dio());
  final List<ClubEventListScope> scopes = <ClubEventListScope>[];

  @override
  Future<ClubEventsEnvelope> fetchEvents(
    String teamId,
    ClubEventListScope scope,
  ) async {
    scopes.add(scope);
    return ClubEventsEnvelope(
      role: ClubRole.member,
      events: <ClubEvent>[
        _event(scope == ClubEventListScope.past ? '지난 경기' : '예정 경기'),
      ],
    );
  }
}

ClubEvent _event(String title) => ClubEvent.fromJson(<String, Object?>{
  'id': title,
  'teamId': 'team-1',
  'teamName': '테스트 동호회',
  'title': title,
  'date': '2026-09-26',
  'time': '19:00',
  'location': '테스트 볼링장',
  'gameType': '정기전',
  'attendanceEnabled': true,
  'laneDrawEnabled': false,
  'laneDrawMode': 'BULK',
  'laneDrawStatus': 'NOT_STARTED',
  'myRole': 'MEMBER',
  'myAttendance': 'UNANSWERED',
  'counts': <String, int>{
    'attending': 0,
    'notAttending': 0,
    'unanswered': 1,
    'guests': 0,
  },
  'guests': <Object>[],
  'slots': <Object>[],
  'assignments': <Object>[],
  'myAssignment': null,
  'attendance': null,
  'bowlerHiddenEnabled': false,
  'competition': null,
});
