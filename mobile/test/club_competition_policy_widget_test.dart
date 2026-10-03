import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_events_api.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_team_competition_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_team_competition_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';

void main() {
  testWidgets(
    'team result distinguishes effective pins, handicap, and applied score',
    (WidgetTester tester) async {
      final state = ClubTeamCompetitionState.fromJson(<String, dynamic>{
        'generation': 1,
        'status': 'TEAMS_FINALIZED',
        'canManage': false,
        'isCurrentCaptain': false,
        'currentTurn': null,
        'teams': <Object>[
          <String, Object?>{
            'id': 'team-a',
            'name': 'TEAM 1',
            'draftOrder': 1,
            'lanePriority': null,
            'teamHandicap': 10,
            'captainMemberId': 'member-1',
            'captainName': '팀장',
            'members': <Object>[],
          },
        ],
        'remainingParticipants': <Object>[],
        'history': <Object>[],
        'myTeam': null,
        'results': <String, Object>{
          'complete': true,
          'requiresPinTieBreakPolicy': false,
          'effectivePlayerCount': 4,
          'individual': <Object>[],
          'games': <Object>[
            <String, Object>{
              'gameNumber': 1,
              'complete': true,
              'teams': <Object>[
                <String, Object?>{
                  'teamId': 'team-a',
                  'teamName': 'TEAM 1',
                  'complete': true,
                  'rawTeamTotal': 750,
                  'excludedScores': <int>[100],
                  'normalizedTeamTotal': 650,
                  'teamHandicap': 10,
                  'handicapAppliedTotal': 660,
                  'rank': 1,
                  'points': 5,
                },
              ],
            },
          ],
          'teams': <Object>[
            <String, Object>{
              'competitionTeamId': 'team-a',
              'name': 'TEAM 1',
              'finalRank': 1,
              'memberCount': 5,
              'teamHandicap': 10,
              'totalPoints': 5,
              'rawPins': 750,
              'effectivePins': 650,
              'appliedPins': 660,
            },
          ],
        },
      });
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            clubTeamCompetitionProvider.overrideWith(
              (ref, request) async => state,
            ),
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

      expect(find.textContaining('Effective 650'), findsWidgets);
      expect(find.textContaining('핸디 10'), findsWidgets);
      expect(find.textContaining('적용 660'), findsWidgets);
      expect(find.textContaining('정책 확정이 필요'), findsNothing);
    },
  );

  testWidgets('TEAM lane pool supports 1-24 lanes with capacities from 1 to 6', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(360, 720));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final api = _LaneApi();
    final state = ClubTeamCompetitionState.fromJson(<String, dynamic>{
      'generation': 1,
      'status': 'TEAMS_FINALIZED',
      'canManage': true,
      'isCurrentCaptain': false,
      'currentTurn': null,
      'laneNumbers': <int>[3],
      'laneSlots': <Object>[
        <String, Object>{'id': 'slot-3-1', 'laneNumber': 3, 'position': 1},
        <String, Object>{'id': 'slot-3-2', 'laneNumber': 3, 'position': 2},
      ],
      'teams': <Object>[
        _team('team-a', 'TEAM A', 'member-1'),
        _team('team-b', 'TEAM B', 'member-2'),
      ],
      'remainingParticipants': <Object>[],
      'history': <Object>[],
      'myTeam': 'team-a',
      'results': <String, Object>{
        'complete': false,
        'requiresPinTieBreakPolicy': false,
        'teams': <Object>[],
      },
    });
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          clubEventsApiProvider.overrideWithValue(api),
          clubTeamCompetitionProvider.overrideWith(
            (ref, request) async => state,
          ),
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
    expect(find.byKey(const Key('assign-team-lanes')), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(find.byKey(const Key('assign-team-lanes')))
          .onPressed,
      isNotNull,
    );

    await tester.tap(find.byKey(const Key('configure-team-lanes')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('team-lane-option-1')), findsOneWidget);
    expect(find.byKey(const Key('team-lane-option-24')), findsOneWidget);
    expect(find.text('참가자 2명 · 선택 좌석 2개'), findsOneWidget);
    expect(find.text('배정 가능'), findsOneWidget);
    expect(find.text('2명'), findsOneWidget);
    await tester.ensureVisible(find.byKey(const Key('decrease-team-lane-3')));
    await tester.tap(find.byKey(const Key('decrease-team-lane-3')));
    await tester.pump();
    expect(find.text('참가자보다 좌석이 1개 부족합니다.'), findsOneWidget);
    await tester.tap(find.byKey(const Key('increase-team-lane-3')));
    await tester.pump();

    Future<void> enableLane(int lane) async {
      final finder = find.byKey(Key('team-lane-option-$lane'));
      await tester.ensureVisible(finder);
      await tester.tap(finder);
      await tester.pump();
    }

    Future<void> changeCapacity(int lane, int delta) async {
      final key = Key('${delta > 0 ? 'increase' : 'decrease'}-team-lane-$lane');
      for (int index = 0; index < delta.abs(); index++) {
        await tester.ensureVisible(find.byKey(key));
        await tester.tap(find.byKey(key));
        await tester.pump();
      }
    }

    await enableLane(1);
    await changeCapacity(1, -2);
    await enableLane(2);
    await enableLane(4);
    await changeCapacity(4, 1);
    await enableLane(5);
    await changeCapacity(5, 2);
    await enableLane(6);
    await changeCapacity(6, 3);
    expect(find.text('참가자 2명 · 선택 좌석 21개'), findsOneWidget);
    expect(find.text('좌석이 19개 여유 있습니다.'), findsOneWidget);
    await tester.tap(find.byKey(const Key('save-team-lanes')));
    await tester.pumpAndSettle();
    expect(api.savedSlots, hasLength(21));
    expect(
      <int, int>{
        for (int lane = 1; lane <= 6; lane++)
          lane: api.savedSlots.where((slot) => slot.laneNumber == lane).length,
      },
      <int, int>{1: 1, 2: 3, 3: 2, 4: 4, 5: 5, 6: 6},
    );
    expect(
      api.savedSlots.every(
        (slot) =>
            slot.position >= 1 &&
            slot.position <=
                api.savedSlots
                    .where((item) => item.laneNumber == slot.laneNumber)
                    .length,
      ),
      isTrue,
    );
  });
}

Map<String, Object?> _team(String id, String name, String memberId) =>
    <String, Object?>{
      'id': id,
      'name': name,
      'draftOrder': id == 'team-a' ? 1 : 2,
      'lanePriority': null,
      'teamHandicap': 0,
      'captainMemberId': memberId,
      'captainName': name,
      'members': <Object>[
        <String, Object?>{
          'participantId': 'participant-$memberId',
          'participantKind': 'MEMBER',
          'memberId': memberId,
          'guestId': null,
          'name': name,
          'assignmentType': 'CAPTAIN',
          'assignmentOrder': 0,
          'laneSlot': null,
        },
      ],
    };

class _LaneApi extends ClubEventsApi {
  _LaneApi() : super(Dio());
  List<({int laneNumber, int position})> savedSlots =
      <({int laneNumber, int position})>[];

  @override
  Future<void> replaceLaneSlots(
    String teamId,
    String eventId,
    List<({int laneNumber, int position})> slots, {
    bool resetAssignments = false,
  }) async {
    savedSlots = List<({int laneNumber, int position})>.from(slots);
  }
}
