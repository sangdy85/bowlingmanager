import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_team_competition_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_team_results_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'MINI renders four ranked team tables with dynamic game columns',
    (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(800, 5000));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await _pumpResults(
        tester,
        _state(gameCount: 3),
        ClubCompetitionMode.mini,
      );

      expect(find.byKey(const Key('team-results-card')), findsOneWidget);
      for (int team = 1; team <= 4; team++) {
        expect(find.byKey(Key('team-result-team-team-$team')), findsOneWidget);
        expect(find.byKey(Key('team-result-table-team-$team')), findsOneWidget);
        expect(
          find.byKey(Key('team-result-total-pins-team-$team')),
          findsOneWidget,
        );
        expect(
          find.byKey(Key('team-result-points-team-$team')),
          findsOneWidget,
        );
      }
      expect(find.text('3G'), findsNWidgets(4));
      expect(find.text('4G'), findsNothing);
      expect(find.text('선수 1'), findsOneWidget);
      expect(find.text('111'), findsWidgets);
      final Finder firstTeam = find.byKey(const Key('team-result-team-team-1'));
      expect(
        find.descendant(of: firstTeam, matching: find.text('1위')),
        findsWidgets,
      );
      expect(
        find.descendant(of: firstTeam, matching: find.text('336')),
        findsWidgets,
      );
      expect(
        find.descendant(of: firstTeam, matching: find.text('12')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: firstTeam, matching: find.text('4')),
        findsNWidgets(3),
      );
      expect(find.text('시즌 포인트 미지급'), findsNWidgets(4));
      expect(find.textContaining('시즌 +0P'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('OFFICIAL renders awarded season points', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(800, 5000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await _pumpResults(
      tester,
      _state(gameCount: 5),
      ClubCompetitionMode.official,
    );

    expect(find.text('5G'), findsNWidgets(4));
    expect(find.text('시즌 +35P'), findsOneWidget);
    expect(find.text('시즌 포인트 미지급'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}

Future<void> _pumpResults(
  WidgetTester tester,
  ClubTeamCompetitionState state,
  ClubCompetitionMode mode,
) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: ClubTeamResultsCard(state: state, competitionMode: mode),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

ClubTeamCompetitionState _state({required int gameCount}) {
  const List<int> seasonPoints = <int>[35, 20, 10, 5];
  final List<List<int>> scores = <List<int>>[
    for (int team = 1; team <= 4; team++)
      <int>[
        for (int game = 1; game <= gameCount; game++) 100 + team * 10 + game,
      ],
  ];
  return ClubTeamCompetitionState.fromJson(<String, dynamic>{
    'generation': 1,
    'status': 'LANES_ASSIGNED',
    'canManage': false,
    'isCurrentCaptain': false,
    'currentTurn': null,
    'laneNumbers': <int>[8, 9],
    'laneSlots': <Object>[],
    'teams': <Object>[
      for (int team = 1; team <= 4; team++)
        <String, Object?>{
          'id': 'team-$team',
          'name': 'TEAM $team',
          'draftOrder': team,
          'lanePriority': team,
          'teamHandicap': team == 1 ? 10 : 0,
          'captainMemberId': 'member-$team',
          'captainName': '선수 $team',
          'members': <Object>[
            <String, Object?>{
              'participantId': 'participant-$team',
              'participantKind': 'MEMBER',
              'memberId': 'member-$team',
              'guestId': null,
              'name': '선수 $team',
              'assignmentType': 'CAPTAIN',
              'assignmentOrder': 0,
              'laneSlot': '${7 + team}-1',
            },
          ],
        },
    ],
    'remainingParticipants': <Object>[],
    'history': <Object>[],
    'myTeam': 'team-1',
    'results': <String, Object?>{
      'complete': true,
      'requiresPinTieBreakPolicy': false,
      'effectivePlayerCount': 1,
      'individual': <Object>[
        for (int team = 1; team <= 4; team++)
          <String, Object?>{
            'rank': team,
            'memberId': 'member-$team',
            'guestId': null,
            'name': '선수 $team',
            'competitionTeamId': 'team-$team',
            'scores': scores[team - 1],
            'total': scores[team - 1].fold<int>(0, (sum, score) => sum + score),
            'average': scores[team - 1].reduce((a, b) => a + b) / gameCount,
          },
      ],
      'games': <Object>[
        for (int game = 1; game <= gameCount; game++)
          <String, Object?>{
            'gameNumber': game,
            'complete': true,
            'teams': <Object>[
              for (int team = 1; team <= 4; team++)
                <String, Object?>{
                  'teamId': 'team-$team',
                  'teamName': 'TEAM $team',
                  'complete': true,
                  'rawTeamTotal': scores[team - 1][game - 1],
                  'excludedScores': <int>[],
                  'normalizedTeamTotal': scores[team - 1][game - 1],
                  'teamHandicap': team == 1 ? 10 : 0,
                  'handicapAppliedTotal':
                      scores[team - 1][game - 1] + (team == 1 ? 10 : 0),
                  'rank': team,
                  'points': 5 - team,
                },
            ],
          },
      ],
      'teams': <Object>[
        for (int team = 1; team <= 4; team++)
          <String, Object?>{
            'competitionTeamId': 'team-$team',
            'name': 'TEAM $team',
            'finalRank': team,
            'memberCount': 1,
            'teamHandicap': team == 1 ? 10 : 0,
            'totalPoints': (5 - team) * gameCount,
            'rawPins': scores[team - 1].fold<int>(
              0,
              (sum, score) => sum + score,
            ),
            'effectivePins': scores[team - 1].fold<int>(
              0,
              (sum, score) => sum + score,
            ),
            'appliedPins':
                scores[team - 1].fold<int>(0, (sum, score) => sum + score) +
                (team == 1 ? 10 * gameCount : 0),
            'seasonPoint': seasonPoints[team - 1],
          },
      ],
    },
  });
}
