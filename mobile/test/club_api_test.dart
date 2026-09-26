import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_api.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_management_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_records_models.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('fetches team list, detail and members from protected paths', () async {
    final List<String> paths = <String>[];
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter((RequestOptions options) {
        paths.add(options.path);
        if (options.path == '/teams') {
          return _json(200, <String, Object>{
            'success': true,
            'data': <String, Object>{
              'teams': <Object>[
                <String, Object>{
                  'id': 'team-1',
                  'name': '테스트 동호회',
                  'myRole': 'OWNER',
                  'memberCount': 2,
                },
              ],
            },
          });
        }
        if (options.path == '/teams/team-1') {
          return _json(200, <String, Object>{
            'success': true,
            'data': <String, Object>{
              'team': <String, Object>{
                'id': 'team-1',
                'name': '테스트 동호회',
                'myRole': 'OWNER',
                'memberCount': 2,
              },
            },
          });
        }
        return _json(200, <String, Object>{
          'success': true,
          'data': <String, Object>{
            'members': <Object>[
              <String, Object?>{
                'id': 'membership-1',
                'name': '회원',
                'role': 'MEMBER',
                'handicap': null,
              },
            ],
          },
        });
      });
    final MobileClubApi api = MobileClubApi(dio);

    final List<ClubSummary> clubs = await api.fetchClubs();
    final ClubDetail detail = await api.fetchClubDetail('team-1');
    final List<ClubMember> members = await api.fetchClubMembers('team-1');

    expect(clubs.single.myRole, ClubRole.owner);
    expect(detail.name, '테스트 동호회');
    expect(members.single.handicap, isNull);
    expect(paths, <String>['/teams', '/teams/team-1', '/teams/team-1/members']);
  });

  test('maps API errors and malformed envelopes', () async {
    Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter(
        (_) => _json(401, <String, Object>{
          'success': false,
          'error': <String, Object>{
            'code': 'UNAUTHORIZED',
            'message': '로그인이 필요합니다.',
          },
        }),
      );
    await expectLater(
      MobileClubApi(dio).fetchClubs(),
      throwsA(
        isA<ApiException>().having(
          (ApiException error) => error.kind,
          'kind',
          ApiErrorKind.unauthorized,
        ),
      ),
    );

    dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter(
        (_) => _json(200, <String, Object>{'success': true, 'data': 'bad'}),
      );
    await expectLater(
      MobileClubApi(dio).fetchClubs(),
      throwsA(
        isA<ApiException>().having(
          (ApiException error) => error.kind,
          'kind',
          ApiErrorKind.malformedResponse,
        ),
      ),
    );
  });

  test('fetches team statistics, activities and activity detail', () async {
    final List<RequestOptions> requests = <RequestOptions>[];
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter((RequestOptions options) {
        requests.add(options);
        if (options.path.endsWith('/statistics')) {
          return _json(200, <String, Object>{
            'success': true,
            'data': _statisticsJson,
          });
        }
        if (options.path.endsWith('/activities')) {
          return _json(200, <String, Object>{
            'success': true,
            'data': <String, Object>{
              'year': 2026,
              'filter': 'REGULAR',
              'items': <Object>[_activityJson],
              'pagination': <String, int>{
                'page': 1,
                'limit': 20,
                'total': 1,
                'totalPages': 1,
              },
            },
          });
        }
        if (options.path.endsWith('/activities/feed')) {
          return _json(200, <String, Object?>{
            'success': true,
            'data': <String, Object?>{
              'year': 2026,
              'types': <String>['REGULAR', 'CASUAL'],
              'currentMemberId': 'membership-1',
              'items': <Object>[
                <String, Object>{
                  ..._activityJson,
                  'canManage': true,
                  'participants': <Object>[
                    <String, Object>{
                      'rank': 1,
                      'id': 'membership-1',
                      'name': '회원',
                      'scores': <int>[200, 210],
                      'total': 410,
                      'average': 205,
                    },
                  ],
                },
              ],
              'pagination': <String, int>{
                'page': 1,
                'limit': 10,
                'total': 1,
                'totalPages': 1,
              },
            },
          });
        }
        return _json(200, <String, Object>{
          'success': true,
          'data': <String, Object>{
            'activity': <String, Object>{
              ..._activityJson,
              'participants': <Object>[
                <String, Object>{
                  'rank': 1,
                  'id': 'membership-1',
                  'name': '회원',
                  'scores': <int>[200, 210],
                  'total': 410,
                  'average': 205,
                },
              ],
            },
          },
        });
      });
    final MobileClubApi api = MobileClubApi(dio);

    final ClubStatistics statistics = await api.fetchClubStatistics(
      teamId: 'team-1',
      year: 2026,
      filter: ClubRecordFilter.regular,
    );
    final ClubActivitiesPage activities = await api.fetchClubActivities(
      teamId: 'team-1',
      year: 2026,
      filter: ClubRecordFilter.regular,
      page: 1,
      limit: 20,
    );
    final ClubActivityDetail detail = await api.fetchClubActivity(
      teamId: 'team-1',
      activityId: '2026-09-19~REGULAR',
    );
    final ClubActivityFeedPage feed = await api.fetchClubActivityFeed(
      teamId: 'team-1',
      year: 2026,
      types: const <ClubRecordFilter>[
        ClubRecordFilter.regular,
        ClubRecordFilter.casual,
      ],
      page: 1,
      limit: 10,
      targetActivityId: '2026-09-19~REGULAR',
    );

    expect(statistics.members.single.average, 205);
    expect(activities.items.single.participantCount, 1);
    expect(detail.participants.single.scores, <int>[200, 210]);
    expect(feed.items.single.canManage, isTrue);
    expect(feed.currentMemberId, 'membership-1');
    expect(requests[0].queryParameters, <String, Object>{
      'year': 2026,
      'type': 'REGULAR',
    });
    expect(requests[1].queryParameters['page'], 1);
    expect(requests[2].path, contains('2026-09-19~REGULAR'));
    expect(requests[3].queryParameters, <String, Object>{
      'year': 2026,
      'types': 'REGULAR,CASUAL',
      'page': 1,
      'limit': 10,
      'target': '2026-09-19~REGULAR',
    });
  });

  test(
    'uses management write contracts without exposing credentials',
    () async {
      final List<RequestOptions> requests = <RequestOptions>[];
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
        ..httpClientAdapter = _Adapter((RequestOptions options) {
          requests.add(options);
          if (options.path == '/scores/bulk') {
            return _json(201, <String, Object>{
              'success': true,
              'data': <String, int>{'createdCount': 2, 'playerCount': 1},
            });
          }
          if (options.path.endsWith('/edit') && options.method == 'GET') {
            return _json(200, <String, Object>{
              'success': true,
              'data': _editableJson,
            });
          }
          if (options.path.endsWith('/edit')) {
            return _json(200, <String, Object>{
              'success': true,
              'data': <String, Object>{
                'activityId': '2026-09-20~ALL',
                'updatedCount': 2,
              },
            });
          }
          if (options.path.contains('/members/')) {
            return _json(200, <String, Object>{
              'success': true,
              'data': options.method == 'PATCH'
                  ? <String, Object>{
                      'memberId': 'membership-1',
                      'role': 'MANAGER',
                    }
                  : <String, Object>{'removedMemberId': 'membership-1'},
            });
          }
          return _json(200, <String, Object>{
            'success': true,
            'data': <String, int>{'deletedCount': 2},
          });
        });
      final MobileClubApi api = MobileClubApi(dio);
      const participant = ClubParticipantDraft(
        memberId: 'membership-1',
        name: '회원',
        scores: <ClubScoreDraft>[
          ClubScoreDraft(value: 0),
          ClubScoreDraft(value: 300),
        ],
      );
      final created = await api.createScores(
        teamId: 'team-1',
        date: '2026-09-20',
        gameType: '정기전',
        memo: null,
        participants: const <ClubParticipantDraft>[participant],
      );
      final editable = await api.fetchEditableActivity(
        teamId: 'team-1',
        activityId: '2026-09-19~REGULAR',
      );
      final updated = await api.updateActivity(
        teamId: 'team-1',
        activity: editable.activity,
      );
      final deleted = await api.deleteActivity(
        teamId: 'team-1',
        activityId: editable.activity.id,
        revision: editable.activity.revision,
      );
      await api.removeMember(teamId: 'team-1', memberId: 'membership-1');
      final role = await api.changeMemberRole(
        teamId: 'team-1',
        memberId: 'membership-1',
        role: ClubRole.manager,
      );

      expect(created.changedCount, 2);
      expect(updated.activityId, '2026-09-20~ALL');
      expect(deleted.changedCount, 2);
      expect(role, ClubRole.manager);
      expect((requests[0].data as Map)['players'], isNotEmpty);
      expect((requests[2].data as Map)['revision'], 'revision-1');
      expect((requests[3].data as Map)['revision'], 'revision-1');
      expect(
        requests.map((request) => request.path),
        everyElement(isNot(contains('token'))),
      );
    },
  );
}

const Map<String, Object> _editableJson = <String, Object>{
  'role': 'OWNER',
  'activity': <String, Object?>{
    'id': '2026-09-19~REGULAR',
    'revision': 'revision-1',
    'date': '2026-09-19',
    'gameType': '정기전',
    'memo': null,
    'scoreCount': 2,
    'participants': <Object>[
      <String, Object?>{
        'memberId': 'membership-1',
        'name': '회원',
        'scores': <Object>[
          <String, Object>{'id': 'score-1', 'score': 200},
          <String, Object>{'id': 'score-2', 'score': 210},
        ],
      },
    ],
  },
};

const Map<String, Object> _statisticsJson = <String, Object>{
  'year': 2026,
  'filter': 'REGULAR',
  'availableYears': <int>[2026],
  'summary': <String, Object>{
    'activityCount': 1,
    'memberCount': 1,
    'attendanceRate': 100,
    'gameCount': 2,
    'monthlyAverages': <int?>[
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      205,
      null,
      null,
      null,
    ],
    'total': 410,
    'average': 205,
  },
  'members': <Object>[
    <String, Object>{
      'id': 'membership-1',
      'name': '회원',
      'attendanceRate': 100,
      'attended': 1,
      'activityCount': 1,
      'gameCount': 2,
      'monthlyAverages': <int?>[
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        205,
        null,
        null,
        null,
      ],
      'total': 410,
      'average': 205,
    },
  ],
};

const Map<String, Object> _activityJson = <String, Object>{
  'id': '2026-09-19~REGULAR',
  'date': '2026-09-19',
  'gameType': '정기전',
  'participantCount': 1,
  'gameCount': 2,
  'dailyAverage': 205,
};

ResponseBody _json(int statusCode, Object body) => ResponseBody.fromString(
  jsonEncode(body),
  statusCode,
  headers: <String, List<String>>{
    Headers.contentTypeHeader: <String>[Headers.jsonContentType],
  },
);

class _Adapter implements HttpClientAdapter {
  _Adapter(this.handler);

  final FutureOr<ResponseBody> Function(RequestOptions) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => handler(options);

  @override
  void close({bool force = false}) {}
}
