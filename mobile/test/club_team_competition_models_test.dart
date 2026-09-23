import 'package:bowlingmanager_mobile/features/club/domain/club_team_competition_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses authoritative draft state without private user identity', () {
    final ClubTeamCompetitionState state = ClubTeamCompetitionState.fromJson(
      teamCompetitionJson(),
    );
    expect(state.polling, isTrue);
    expect(state.isCurrentCaptain, isTrue);
    expect(state.currentTurn?.roundNumber, 2);
    expect(state.teams.single.members.single.laneSlot, isNull);
    expect(state.history.single.automatic, isFalse);
    expect(state.results.teams.single.totalPoints, 5);
    expect(state.results.individual.single.scores, <int>[200]);
    expect(state.results.games.single.teams.single.normalizedTeamTotal, 200);
  });

  test('parses finalized empty results and nullable final rank', () {
    final Map<String, dynamic> json = teamCompetitionJson()
      ..['status'] = 'TEAMS_FINALIZED'
      ..['currentTurn'] = null
      ..['results'] = <String, dynamic>{
        'complete': false,
        'requiresPinTieBreakPolicy': true,
        'teams': <Object>[
          <String, Object?>{
            'competitionTeamId': 'team-a',
            'name': 'TEAM 1',
            'finalRank': null,
            'totalPoints': 8,
            'rawPins': 1400,
            'effectivePins': 1200,
          },
        ],
      };
    final state = ClubTeamCompetitionState.fromJson(json);
    expect(state.polling, isFalse);
    expect(state.results.complete, isFalse);
    expect(state.results.teams.single.finalRank, isNull);
  });

  test('rejects malformed participant and result contracts', () {
    final Map<String, dynamic> badParticipant = teamCompetitionJson();
    ((badParticipant['teams'] as List).first as Map)['members'] = <Object>[
      <String, Object?>{
        'memberId': 'member-1',
        'name': '회원',
        'assignmentType': 'CAPTAIN',
        'assignmentOrder': 0,
        'laneSlot': 3,
      },
    ];
    expect(
      () => ClubTeamCompetitionState.fromJson(badParticipant),
      throwsFormatException,
    );

    final Map<String, dynamic> badResult = teamCompetitionJson();
    ((badResult['results'] as Map)['teams'] as List).first = <String, Object?>{
      'name': 'TEAM 1',
      'finalRank': 1,
      'totalPoints': -1,
      'rawPins': 400,
      'effectivePins': 400,
    };
    expect(
      () => ClubTeamCompetitionState.fromJson(badResult),
      throwsFormatException,
    );
  });
}

Map<String, dynamic> teamCompetitionJson() => <String, dynamic>{
  'eventId': 'event-1',
  'generation': 1,
  'status': 'DRAFT_IN_PROGRESS',
  'canManage': false,
  'isCurrentCaptain': true,
  'currentTurn': <String, Object>{
    'pickNumber': 3,
    'roundNumber': 2,
    'direction': 'REVERSE',
    'competitionTeamId': 'team-a',
    'captainMemberId': 'member-1',
    'captainName': '팀장',
  },
  'plan': <String, int>{
    'attendeeCount': 5,
    'captainCount': 2,
    'draftPerTeam': 1,
    'draftTotal': 2,
    'remainder': 1,
  },
  'teams': <Object>[
    <String, Object?>{
      'id': 'team-a',
      'name': 'TEAM 1',
      'draftOrder': 1,
      'lanePriority': null,
      'teamHandicap': 0,
      'captainMemberId': 'member-1',
      'captainName': '팀장',
      'members': <Object>[
        <String, Object?>{
          'memberId': 'member-1',
          'name': '팀장',
          'assignmentType': 'CAPTAIN',
          'assignmentOrder': 0,
          'laneSlot': null,
        },
      ],
    },
  ],
  'remainingParticipants': <Object>[
    <String, Object?>{
      'memberId': 'member-2',
      'name': '회원',
      'assignmentType': null,
      'assignmentOrder': null,
      'laneSlot': null,
    },
  ],
  'history': <Object>[
    <String, Object>{
      'id': 'pick-1',
      'generation': 1,
      'pickNumber': 1,
      'roundNumber': 1,
      'direction': 'FORWARD',
      'pickType': 'CAPTAIN_PICK',
      'competitionTeamId': 'team-a',
      'teamName': 'TEAM 1',
      'captainMemberId': 'member-1',
      'selectedMemberId': 'member-2',
      'selectedDisplayName': '회원',
      'createdAt': '2026-09-22T10:00:00.000Z',
    },
  ],
  'myTeam': 'team-a',
  'results': <String, dynamic>{
    'complete': true,
    'effectivePlayerCount': 1,
    'individual': <Object>[
      <String, Object>{
        'rank': 1,
        'memberId': 'member-1',
        'name': '팀장',
        'competitionTeamId': 'team-a',
        'scores': <int>[200],
        'total': 200,
        'average': 200.0,
      },
    ],
    'games': <Object>[
      <String, Object>{
        'gameNumber': 1,
        'complete': true,
        'teams': <Object>[
          <String, Object?>{
            'teamId': 'team-a',
            'teamName': 'TEAM 1',
            'complete': true,
            'rawTeamTotal': 200,
            'excludedScores': <int>[],
            'normalizedTeamTotal': 200,
            'handicapAppliedTotal': null,
            'rank': 1,
            'points': 5,
          },
        ],
      },
    ],
    'requiresPinTieBreakPolicy': false,
    'teams': <Object>[
      <String, Object?>{
        'competitionTeamId': 'team-a',
        'name': 'TEAM 1',
        'memberCount': 1,
        'teamHandicap': 0,
        'totalPoints': 5,
        'rawPins': 200,
        'effectivePins': 200,
        'finalRank': 1,
      },
    ],
  },
  'policies': <String, String>{
    'guests': 'EXCLUDED_V1_NO_STABLE_SCORE_IDENTITY',
    'memberSlotOrder': 'MANAGER_EXPLICIT_ORDER',
    'finalPinTieBreak': 'PENDING_RAW_OR_EFFECTIVE_DECISION',
    'teamHandicapApplication': 'PENDING_PRODUCT_DECISION',
  },
};
