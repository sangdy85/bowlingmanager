import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_events_api.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_competition_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_team_competition_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_competition_score_models.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('uses protected team event paths for list and mutations', () async {
    final List<RequestOptions> requests = <RequestOptions>[];
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter((RequestOptions options) {
        requests.add(options);
        if (options.path.endsWith('/events') && options.method == 'GET') {
          return _json(200, <String, Object>{
            'success': true,
            'data': <String, Object>{
              'role': 'MANAGER',
              'events': <Object>[_eventJson()],
            },
          });
        }
        if (options.path.endsWith('/events/event-1')) {
          return _json(200, <String, Object>{
            'success': true,
            'data': <String, Object>{'event': _eventJson()},
          });
        }
        return _json(200, <String, Object>{
          'success': true,
          'data': <String, Object>{'status': 'ATTENDING'},
        });
      });
    final ClubEventsApi api = ClubEventsApi(dio);

    final ClubEventsEnvelope list = await api.fetchEvents('team-1');
    final ClubEvent detail = await api.fetchEvent('team-1', 'event-1');
    await api.setAttendance('team-1', 'event-1', ClubEventAttendance.attending);
    await api.replaceLaneSlots(
      'team-1',
      'event-1',
      <({int laneNumber, int position})>[(laneNumber: 1, position: 1)],
    );
    await api.drawMine('team-1', 'event-1');

    expect(list.events.single.id, 'event-1');
    expect(detail.laneDrawMode, ClubEventDrawMode.individual);
    expect(
      requests.map((RequestOptions item) => '${item.method} ${item.path}'),
      containsAll(<String>[
        'GET /teams/team-1/events',
        'GET /teams/team-1/events/event-1',
        'PUT /teams/team-1/events/event-1/attendance',
        'PUT /teams/team-1/events/event-1/lane-config',
        'POST /teams/team-1/events/event-1/draw/mine',
      ]),
    );
  });

  test('maps API errors and malformed event envelopes', () async {
    Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter(
        (_) => _json(409, <String, Object>{
          'success': false,
          'error': <String, Object>{
            'code': 'EVENT_LOCKED',
            'message': '추첨 시작 후에는 변경할 수 없습니다.',
          },
        }),
      );
    await expectLater(
      ClubEventsApi(dio).fetchEvents('team-1'),
      throwsA(isA<ApiException>()),
    );

    dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter(
        (_) => _json(200, <String, Object>{'success': true, 'data': 'bad'}),
      );
    await expectLater(
      ClubEventsApi(dio).fetchEvents('team-1'),
      throwsA(
        isA<ApiException>().having(
          (ApiException error) => error.kind,
          'kind',
          ApiErrorKind.malformedResponse,
        ),
      ),
    );
  });

  test(
    'sends competition config and reads derived competition endpoint',
    () async {
      final List<RequestOptions> requests = <RequestOptions>[];
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
        ..httpClientAdapter = _Adapter((RequestOptions options) {
          requests.add(options);
          if (options.path.endsWith('/competition')) {
            return _json(200, <String, Object?>{
              'success': true,
              'data': <String, Object?>{
                'enabled': true,
                'competitionType': 'INDIVIDUAL',
                'status': 'DRAFT',
                'rankPoints': <Object>[],
                'overall': <Object>[],
                'participantPreview': null,
                'myPreview': null,
                'groupingPolicy': 'PENDING_PRODUCT_DECISION',
              },
            });
          }
          return _json(201, <String, Object>{
            'success': true,
            'data': <String, Object>{'event': _eventJson()},
          });
        });
      final ClubEventsApi api = ClubEventsApi(dio);
      await api.createEvent(
        'team-1',
        const ClubEventDraft(
          title: '정기전 9월 모임',
          date: '2026-09-22',
          time: '19:00',
          location: '서울 볼링장',
          gameType: '정기전',
          attendanceEnabled: true,
          laneDrawEnabled: false,
          laneDrawMode: ClubEventDrawMode.bulk,
          competitionEnabled: true,
          competitionType: ClubCompetitionType.individual,
          rankPoints: <ClubRankPoint>[ClubRankPoint(rank: 1, points: 20)],
        ),
      );
      final ClubCompetitionResult result = await api.fetchCompetition(
        'team-1',
        'event-1',
      );
      await api.individualCompetitionAction(
        'team-1',
        'event-1',
        <String, dynamic>{
          'action': 'SET_MANUAL_GROUP',
          'participantKind': 'GUEST',
          'participantId': 'guest-1',
          'manualGroup': 'B',
        },
      );
      expect(result.overall, isEmpty);
      final Map<String, dynamic> payload = Map<String, dynamic>.from(
        requests.first.data as Map,
      );
      expect(payload['competitionEnabled'], isTrue);
      expect(payload['competitionType'], 'INDIVIDUAL');
      expect(payload['title'], '정기전 9월 모임');
      expect(payload['location'], '서울 볼링장');
      expect(requests.last.path, '/teams/team-1/events/event-1/competition');
      expect((requests.last.data as Map)['manualGroup'], 'B');
    },
  );

  test('uses protected team competition state and action endpoints', () async {
    final List<RequestOptions> requests = <RequestOptions>[];
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter((RequestOptions options) {
        requests.add(options);
        return _json(200, <String, Object?>{
          'success': true,
          'data': options.method == 'GET'
              ? _teamCompetitionJson()
              : <String, Object>{'status': 'ATTENDANCE_LOCKED'},
        });
      });
    final api = ClubEventsApi(dio);
    final ClubTeamCompetitionState state = await api.fetchTeamCompetition(
      'team-1',
      'event-1',
    );
    await api.teamCompetitionAction('team-1', 'event-1', <String, dynamic>{
      'action': 'SET_HANDICAP',
      'competitionTeamId': 'competition-team-1',
      'teamHandicap': 15,
    });
    expect(state.status, 'ATTENDANCE_OPEN');
    expect(requests.map((item) => '${item.method} ${item.path}'), <String>[
      'GET /teams/team-1/events/event-1/competition/team',
      'POST /teams/team-1/events/event-1/competition/team',
    ]);
    expect((requests.last.data as Map)['teamHandicap'], 15);
  });

  test('uses protected EVENT competition state and action endpoint', () async {
    final List<RequestOptions> requests = <RequestOptions>[];
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter((RequestOptions options) {
        requests.add(options);
        return _json(200, <String, Object?>{
          'success': true,
          'data': options.method == 'GET'
              ? <String, Object?>{
                  'status': 'VOTING_OPEN',
                  'canManage': false,
                  'isParticipant': true,
                  'myParticipantId': 'participant-1',
                  'voteOpenAt': '2026-09-22T10:00:00.000Z',
                  'voteCloseAt': '2026-09-22T10:30:00.000Z',
                  'serverNow': '2026-09-22T10:10:00.000Z',
                  'gameCount': 4,
                  'participants': <Object>[],
                  'voting': <String, Object>{
                    'submittedCount': 0,
                    'pendingCount': 4,
                    'mySelections': <Object>[],
                  },
                  'reveal': <String, Object>{
                    'revealedCount': 0,
                    'totalCount': 4,
                  },
                  'finalPreview': null,
                }
              : <String, Object>{'submitted': true, 'selectionCount': 3},
        });
      });
    final ClubEventsApi api = ClubEventsApi(dio);
    final ClubEventCompetitionState state = await api.fetchEventCompetition(
      'team-1',
      'event-1',
    );
    await api.eventCompetitionAction('team-1', 'event-1', <String, dynamic>{
      'action': 'VOTE',
      'selectedParticipantIds': <String>['p2', 'p3', 'p4'],
    });
    expect(state.status, 'VOTING_OPEN');
    expect(requests.map((item) => '${item.method} ${item.path}'), <String>[
      'GET /teams/team-1/events/event-1/competition/event',
      'POST /teams/team-1/events/event-1/competition/event',
    ]);
  });

  test('loads and saves event-linked competition scores', () async {
    final List<RequestOptions> requests = <RequestOptions>[];
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter((RequestOptions options) {
        requests.add(options);
        return _json(200, <String, Object?>{
          'success': true,
          'data': options.method == 'GET'
              ? <String, Object?>{
                  'event': <String, Object?>{
                    'id': 'event-1',
                    'teamName': '테스트 동호회',
                    'title': '개인전',
                    'date': '2026-09-26',
                    'gameType': '정기전',
                    'competitionType': 'INDIVIDUAL',
                    'competitionMode': 'OFFICIAL',
                    'status': 'GROUPS_READY',
                  },
                  'gameCount': 2,
                  'readOnly': false,
                  'participants': <Object>[
                    <String, Object?>{
                      'participantId': 'member:m1',
                      'participantKind': 'MEMBER',
                      'memberId': 'm1',
                      'guestId': null,
                      'name': '회원',
                      'group': 'A',
                      'competitionTeamName': null,
                      'scores': <int>[200, 210],
                    },
                  ],
                }
              : <String, Object>{'savedCount': 2},
        });
      });
    final ClubEventsApi api = ClubEventsApi(dio);
    final ClubCompetitionScoreEntry entry = await api.fetchCompetitionScores(
      'team-1',
      'event-1',
    );
    await api.saveCompetitionScores('team-1', 'event-1', <String, dynamic>{
      'participants': <Object>[
        <String, Object>{
          'participantId': 'member:m1',
          'scores': <int>[201, 211],
        },
      ],
    });
    expect(entry.participants.single.group, 'A');
    expect(requests.map((item) => '${item.method} ${item.path}'), <String>[
      'GET /teams/team-1/events/event-1/scores',
      'POST /teams/team-1/events/event-1/scores',
    ]);
  });
}

Map<String, dynamic> _teamCompetitionJson() => <String, dynamic>{
  'generation': 1,
  'status': 'ATTENDANCE_OPEN',
  'canManage': true,
  'isCurrentCaptain': false,
  'currentTurn': null,
  'teams': <Object>[],
  'remainingParticipants': <Object>[],
  'history': <Object>[],
  'myTeam': null,
  'results': <String, Object>{
    'complete': false,
    'requiresPinTieBreakPolicy': false,
    'teams': <Object>[],
  },
};

Map<String, dynamic> _eventJson() => <String, dynamic>{
  'id': 'event-1',
  'teamId': 'team-1',
  'title': '정기전',
  'date': '2026-09-22',
  'time': '19:00',
  'location': '테스트 볼링장',
  'gameType': '정기전',
  'attendanceEnabled': true,
  'laneDrawEnabled': true,
  'laneDrawMode': 'INDIVIDUAL',
  'laneDrawStatus': 'OPEN',
  'myRole': 'MANAGER',
  'myAttendance': 'ATTENDING',
  'counts': <String, int>{
    'attending': 1,
    'notAttending': 0,
    'unanswered': 0,
    'guests': 0,
  },
  'guests': <Object>[],
  'slots': <Object>[],
  'assignments': <Object>[],
  'myAssignment': null,
  'attendance': <Object>[],
};

class _Adapter implements HttpClientAdapter {
  _Adapter(this.handler);
  final ResponseBody Function(RequestOptions options) handler;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => handler(options);
  @override
  void close({bool force = false}) {}
}

ResponseBody _json(int status, Object body) => ResponseBody.fromString(
  jsonEncode(body),
  status,
  headers: <String, List<String>>{
    Headers.contentTypeHeader: <String>[Headers.jsonContentType],
  },
);
