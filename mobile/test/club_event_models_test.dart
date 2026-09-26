import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'competition mode keeps OFFICIAL and MINI separate from competition type',
    () {
      expect(
        ClubCompetitionMode.fromJson('OFFICIAL'),
        ClubCompetitionMode.official,
      );
      expect(ClubCompetitionMode.fromJson('MINI'), ClubCompetitionMode.mini);
      expect(() => ClubCompetitionMode.fromJson('TEAM'), throwsFormatException);
    },
  );

  test('parses member event detail with nullable game type', () {
    final ClubEvent event = ClubEvent.fromJson(eventJson());
    expect(event.myRole, ClubRole.member);
    expect(event.gameType, isNull);
    expect(event.myAttendance, ClubEventAttendance.attending);
    expect(event.myAssignment?.label, '3-2');
    expect(event.attendance, isNull);
  });

  test('parses manager attendance overview and empty draw results', () {
    final Map<String, dynamic> json = eventJson()
      ..['myRole'] = 'MANAGER'
      ..['myAssignment'] = null
      ..['assignments'] = <Object>[]
      ..['attendance'] = <Object>[
        <String, Object>{
          'memberId': 'member-1',
          'name': '회원',
          'status': 'UNANSWERED',
        },
      ];
    final ClubEvent event = ClubEvent.fromJson(json);
    expect(event.canManage, isTrue);
    expect(event.attendance!.single.status, ClubEventAttendance.unanswered);
    expect(event.assignments, isEmpty);
  });

  test('rejects malformed participant or enum contracts', () {
    expect(
      () => ClubEvent.fromJson(eventJson()..['laneDrawStatus'] = 'BROKEN'),
      throwsFormatException,
    );
    final Map<String, dynamic> json = eventJson();
    (json['assignments'] as List<Object?>).first = <String, Object?>{
      'id': 'assignment-1',
      'memberId': 'member-1',
      'guestId': 'guest-1',
      'name': '회원',
      'laneNumber': 3,
      'position': 2,
      'label': '3-2',
    };
    expect(() => ClubEvent.fromJson(json), throwsFormatException);
  });

  test('parses gated individual competition and ranking result', () {
    final Map<String, dynamic> json = eventJson()
      ..['bowlerHiddenEnabled'] = true
      ..['competition'] = <String, Object>{
        'enabled': true,
        'type': 'INDIVIDUAL',
        'mode': 'MINI',
        'status': 'DRAFT',
        'rankPoints': <Object>[
          <String, int>{'rank': 1, 'points': 20},
        ],
      };
    final ClubEvent event = ClubEvent.fromJson(json);
    expect(event.bowlerHiddenEnabled, isTrue);
    expect(event.competition?.mode, ClubCompetitionMode.mini);
    expect(event.competition?.rankPoints.single.points, 20);

    final ClubCompetitionResult result = ClubCompetitionResult.fromJson(
      <String, dynamic>{
        'enabled': true,
        'status': 'DRAFT',
        'groupingPolicy': 'WEIGHTED_30_40_30_MANUAL_FALLBACK',
        'overall': <Object>[
          <String, Object>{
            'rank': 1,
            'memberId': 'member-1',
            'name': '회원',
            'scores': <int>[200, 210],
            'gameCount': 2,
            'total': 410,
            'average': 205.0,
            'points': 20,
          },
        ],
        'participantPreview': <Object>[],
        'groupAssignments': <Object>[
          <String, Object?>{
            'participantId': 'member-1',
            'name': '회원',
            'effectiveGroup': 'B',
          },
        ],
        'myPreview': <String, Object?>{
          'memberId': 'member-1',
          'participantKind': 'MEMBER',
          'participantId': 'member-1',
          'guestId': null,
          'name': '회원',
          'gameSampleCount': 2,
          'recent50Average': 205.0,
          'recent12Average': 205.0,
          'ratingStatus': 'DATA_INSUFFICIENT',
          'expectedScore': null,
          'regularExpectedScore': null,
          'manualGroupingScore': null,
          'groupingScore': null,
          'groupingSource': 'MANUAL_REQUIRED',
          'baseTier': null,
          'finalGroup': null,
        },
      },
    );
    expect(result.overall.single.total, 410);
    expect(result.myPreview?.recent12Average, 205.0);
    expect(result.myPreview?.groupingSource, 'MANUAL_REQUIRED');
    expect(result.groupAssignments?.single.effectiveGroup, 'B');
  });

  test('parses automatic and manual grouping sources without hiding insufficient data', () {
    Map<String, dynamic> preview(
      String source,
      Object? score,
      Object? manual,
    ) => <String, dynamic>{
      'participantKind': 'MEMBER',
      'participantId': 'member-1',
      'memberId': 'member-1',
      'guestId': null,
      'name': '회원',
      'gameSampleCount': 50,
      'recent50Average': 190.0,
      'recent12Average': 195.0,
      'regularExpectedScore': source == 'AUTO' ? 185.0 : null,
      'manualGroupingScore': manual,
      'groupingScore': score,
      'groupingSource': source,
      'ratingStatus': 'READY',
      'baseTier': 'B',
      'finalGroup': 'B조',
    };
    final automatic = ClubCompetitionPreview.fromJson(
      preview('AUTO', 190.5, null),
    );
    final manual = ClubCompetitionPreview.fromJson(preview('MANUAL', 191, 191));
    expect(automatic.groupingSource, 'AUTO');
    expect(manual.manualGroupingScore, 191);
    final overridden = ClubCompetitionPreview.fromJson(
      preview('MANUAL_OVERRIDE', 198.2, null)
        ..['autoGroupingScore'] = 198.2
        ..['autoGroup'] = 'B'
        ..['manualGroup'] = 'C'
        ..['effectiveGroup'] = 'C',
    );
    expect(overridden.autoGroup, 'B');
    expect(overridden.manualGroup, 'C');
    expect(overridden.effectiveGroup, 'C');
    expect(
      () => ClubCompetitionPreview.fromJson(preview('MANUAL', 191, -1)),
      throwsFormatException,
    );
  });

  test('parses gated team competition configuration', () {
    final Map<String, dynamic> json = eventJson()
      ..['bowlerHiddenEnabled'] = true
      ..['competition'] = <String, Object>{
        'enabled': true,
        'type': 'TEAM',
        'status': 'ATTENDANCE_OPEN',
        'rankPoints': <Object>[
          <String, int>{'rank': 1, 'points': 5},
        ],
      };
    final event = ClubEvent.fromJson(json);
    expect(event.competition?.type, ClubCompetitionType.team);
    expect(event.competition?.status, 'ATTENDANCE_OPEN');
  });

  test('EVENT config preserves server window and game count in draft', () {
    final Map<String, dynamic> json = eventJson()
      ..['bowlerHiddenEnabled'] = true
      ..['competition'] = <String, Object>{
        'enabled': true,
        'type': 'EVENT',
        'status': 'ATTENDANCE_OPEN',
        'rankPoints': <Object>[],
        'competitionStartAt': '2026-09-22T10:00:00.000Z',
        'voteCloseAt': '2026-09-22T10:30:00.000Z',
        'votingDurationMinutes': 30,
        'gameCount': 4,
      };
    final event = ClubEvent.fromJson(json);
    expect(event.competition?.type, ClubCompetitionType.event);
    expect(event.competition?.gameCount, 4);
    expect(event.competition?.votingDurationMinutes, 30);

    final draft = ClubEventDraft(
      title: '이벤트전',
      date: '2026-09-22',
      time: '19:00',
      location: '볼링장',
      gameType: '정기전',
      attendanceEnabled: true,
      laneDrawEnabled: false,
      laneDrawMode: ClubEventDrawMode.bulk,
      competitionEnabled: true,
      competitionType: ClubCompetitionType.event,
      competitionMode: ClubCompetitionMode.mini,
      competitionGameCount: 4,
    );
    expect(draft.toJson()['competitionType'], 'EVENT');
    expect(draft.toJson()['competitionMode'], 'MINI');
    expect(draft.toJson()['competitionGameCount'], 4);
  });
}

Map<String, dynamic> eventJson() => <String, dynamic>{
  'id': 'event-1',
  'teamId': 'team-1',
  'title': '정기전',
  'date': '2026-09-22',
  'time': '19:00',
  'location': '테스트 볼링장',
  'gameType': null,
  'attendanceEnabled': true,
  'laneDrawEnabled': true,
  'laneDrawMode': 'INDIVIDUAL',
  'laneDrawStatus': 'OPEN',
  'myRole': 'MEMBER',
  'myAttendance': 'ATTENDING',
  'counts': <String, int>{
    'attending': 1,
    'notAttending': 0,
    'unanswered': 0,
    'guests': 0,
  },
  'guests': <Object>[],
  'slots': <Object>[
    <String, Object>{'id': 'slot-1', 'laneNumber': 3, 'position': 2},
  ],
  'assignments': <Object?>[
    <String, Object?>{
      'id': 'assignment-1',
      'memberId': 'member-1',
      'guestId': null,
      'name': '회원',
      'laneNumber': 3,
      'position': 2,
      'label': '3-2',
    },
  ],
  'myAssignment': <String, Object?>{
    'id': 'assignment-1',
    'memberId': 'member-1',
    'guestId': null,
    'name': '회원',
    'laneNumber': 3,
    'position': 2,
    'label': '3-2',
  },
  'attendance': null,
};
