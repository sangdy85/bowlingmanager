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

  testWidgets('TEAM lane pool supports add, duplicate guard, remove and save', (
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
      'laneNumbers': <int>[],
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
      isNull,
    );

    await tester.tap(find.byKey(const Key('configure-team-lanes')));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('team-lane-number-input')),
      '3',
    );
    await tester.tap(find.byKey(const Key('add-team-lane')));
    await tester.pump();
    await tester.enterText(
      find.byKey(const Key('team-lane-number-input')),
      '3',
    );
    await tester.tap(find.byKey(const Key('add-team-lane')));
    await tester.pump();
    expect(find.text('이미 추가한 레인입니다.'), findsOneWidget);
    tester.widget<InputChip>(find.byKey(const Key('team-lane-3'))).onDeleted!();
    await tester.pump();
    expect(find.byKey(const Key('team-lane-3')), findsNothing);
    for (final lane in <String>['3', '4']) {
      await tester.enterText(
        find.byKey(const Key('team-lane-number-input')),
        lane,
      );
      await tester.tap(find.byKey(const Key('add-team-lane')));
      await tester.pump();
    }
    await tester.tap(find.byKey(const Key('save-team-lanes')));
    await tester.pumpAndSettle();
    expect(api.savedSlots, hasLength(12));
    expect(api.savedSlots.map((slot) => slot.laneNumber).toSet(), <int>{3, 4});
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
    List<({int laneNumber, int position})> slots,
  ) async {
    savedSlots = List<({int laneNumber, int position})>.from(slots);
  }
}
