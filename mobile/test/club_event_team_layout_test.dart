import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_team_competition_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_event_detail_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';

void main() {
  testWidgets(
    'locked TEAM puts team info above adjacent attendance and guest cards and integrates lanes',
    (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(700, 3200));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await _pumpDetail(tester, _teamState(complete: false));

      final double eventTop = _top(tester, 'event-summary-card');
      final double teamTop = _top(tester, 'team-competition-card');
      final double attendanceTop = _top(tester, 'event-attendance-card');
      final double guestTop = _top(tester, 'guest-management-card');
      expect(eventTop, lessThan(teamTop));
      expect(teamTop, lessThan(attendanceTop));
      expect(attendanceTop, lessThan(guestTop));
      expect(find.byKey(const Key('team-results-card')), findsNothing);
      expect(find.text('추첨 결과'), findsNothing);
      expect(
        find.byKey(const Key('team-info-member-participant-1')),
        findsOneWidget,
      );
      expect(find.text('9-1'), findsOneWidget);
      expect(find.text('팀장'), findsWidgets);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'complete TEAM result is directly below event and above team info',
    (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(700, 3200));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await _pumpDetail(tester, _teamState(complete: true));

      final double eventTop = _top(tester, 'event-summary-card');
      final double resultTop = _top(tester, 'team-results-card');
      final double teamTop = _top(tester, 'team-competition-card');
      expect(eventTop, lessThan(resultTop));
      expect(resultTop, lessThan(teamTop));
      expect(find.text('TEAM 최종 결과표'), findsOneWidget);
      expect(find.text('시즌 포인트 미지급'), findsWidgets);
      expect(tester.takeException(), isNull);
    },
  );
}

double _top(WidgetTester tester, String key) =>
    tester.getTopLeft(find.byKey(Key(key))).dy;

Future<void> _pumpDetail(
  WidgetTester tester,
  ClubTeamCompetitionState state,
) async {
  final FakeAuthRepository auth = FakeAuthRepository()
    ..bootstrapResult = testUser;
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(auth),
        clubEventProvider.overrideWith((ref, request) async => _event()),
        clubTeamCompetitionProvider.overrideWith((ref, request) async => state),
      ],
      child: const MaterialApp(
        home: ClubEventDetailScreen(teamId: 'team-1', eventId: 'event-1'),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

ClubEvent _event() => ClubEvent.fromJson(<String, Object?>{
  'id': 'event-1',
  'teamId': 'team-1',
  'teamName': '테스트 동호회',
  'title': 'TEAM 미니 경기',
  'date': '2026-10-10',
  'time': '19:00',
  'location': '서울 볼링장',
  'gameType': '정기전',
  'attendanceEnabled': true,
  'laneDrawEnabled': true,
  'laneDrawMode': 'BULK',
  'laneDrawStatus': 'COMPLETED',
  'myRole': 'MEMBER',
  'myAttendance': 'ATTENDING',
  'counts': <String, int>{
    'attending': 1,
    'notAttending': 0,
    'unanswered': 0,
    'guests': 1,
  },
  'guests': <Object>[
    <String, Object>{'id': 'guest-1', 'name': '게스트 회원'},
  ],
  'slots': <Object>[],
  'assignments': <Object>[
    <String, Object?>{
      'id': 'assignment-1',
      'memberId': 'member-1',
      'guestId': null,
      'name': '홍길동',
      'laneNumber': 9,
      'position': 1,
      'label': '9-1',
    },
  ],
  'myAssignment': null,
  'attendance': <Object>[
    <String, Object>{
      'memberId': 'member-1',
      'name': '홍길동',
      'status': 'ATTENDING',
    },
  ],
  'bowlerHiddenEnabled': true,
  'competition': <String, Object?>{
    'enabled': true,
    'type': 'TEAM',
    'mode': 'MINI',
    'status': 'LANES_ASSIGNED',
    'gameCount': 3,
    'rankPoints': <Object>[],
  },
});

ClubTeamCompetitionState _teamState({required bool complete}) =>
    ClubTeamCompetitionState.fromJson(<String, dynamic>{
      'generation': 1,
      'status': 'LANES_ASSIGNED',
      'canManage': false,
      'isCurrentCaptain': false,
      'currentTurn': null,
      'laneNumbers': <int>[9],
      'laneSlots': <Object>[
        <String, Object>{'id': 'slot-1', 'laneNumber': 9, 'position': 1},
      ],
      'teams': <Object>[
        <String, Object?>{
          'id': 'team-a',
          'name': 'TEAM 1',
          'draftOrder': 1,
          'lanePriority': 1,
          'teamHandicap': 0,
          'captainMemberId': 'member-1',
          'captainName': '홍길동',
          'members': <Object>[
            <String, Object?>{
              'participantId': 'participant-1',
              'participantKind': 'MEMBER',
              'memberId': 'member-1',
              'guestId': null,
              'name': '홍길동',
              'assignmentType': 'CAPTAIN',
              'assignmentOrder': 0,
              'laneSlot': '9-1',
            },
          ],
        },
      ],
      'remainingParticipants': <Object>[],
      'history': <Object>[],
      'myTeam': 'team-a',
      'results': complete
          ? <String, Object?>{
              'complete': true,
              'requiresPinTieBreakPolicy': false,
              'effectivePlayerCount': 1,
              'individual': <Object>[
                <String, Object?>{
                  'rank': 1,
                  'memberId': 'member-1',
                  'guestId': null,
                  'name': '홍길동',
                  'competitionTeamId': 'team-a',
                  'scores': <int>[200, 210, 220],
                  'total': 630,
                  'average': 210.0,
                },
              ],
              'games': <Object>[
                for (int game = 1; game <= 3; game++)
                  <String, Object?>{
                    'gameNumber': game,
                    'complete': true,
                    'teams': <Object>[
                      <String, Object?>{
                        'teamId': 'team-a',
                        'teamName': 'TEAM 1',
                        'complete': true,
                        'rawTeamTotal': 190 + game * 10,
                        'excludedScores': <int>[],
                        'normalizedTeamTotal': 190 + game * 10,
                        'teamHandicap': 0,
                        'handicapAppliedTotal': 190 + game * 10,
                        'rank': 1,
                        'points': 5,
                      },
                    ],
                  },
              ],
              'teams': <Object>[
                <String, Object?>{
                  'competitionTeamId': 'team-a',
                  'name': 'TEAM 1',
                  'finalRank': 1,
                  'memberCount': 1,
                  'teamHandicap': 0,
                  'totalPoints': 15,
                  'rawPins': 630,
                  'effectivePins': 630,
                  'appliedPins': 630,
                  'seasonPoint': 0,
                },
              ],
            }
          : <String, Object?>{
              'complete': false,
              'requiresPinTieBreakPolicy': false,
              'effectivePlayerCount': 1,
              'individual': <Object>[],
              'games': <Object>[],
              'teams': <Object>[],
            },
    });
