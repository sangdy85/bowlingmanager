import 'dart:convert';
import 'dart:typed_data';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_expansion_api.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('uses protected member, profile, ranking and board paths', () async {
    final requests = <RequestOptions>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter((options) {
        requests.add(options);
        final data = switch ((options.method, options.path)) {
          ('GET', '/teams/team-1/members/member-1') => <String, Object?>{
            'member': _memberJson(),
          },
          ('GET', '/teams/team-1/profile') ||
          (
            'PATCH',
            '/teams/team-1/profile',
          ) => <String, Object?>{'profile': _profileJson()},
          ('GET', '/teams/team-1/season-ranking') => <String, Object?>{
            'enabled': false,
            'season': null,
            'seasons': <Object>[],
            'competitionType': 'TEAM',
            'rankings': <Object>[],
          },
          ('GET', '/teams/team-1/season-ranking/members/member-1') =>
            <String, Object?>{'member': _rankingRowJson()},
          ('GET', '/teams/team-1/posts') => <String, Object?>{
            'items': <Object>[],
            'pagination': <String, int>{
              'page': 1,
              'limit': 20,
              'total': 0,
              'totalPages': 0,
            },
          },
          ('GET', '/teams/team-1/posts/post-1') => <String, Object?>{
            'post': _postJson(),
          },
          ('DELETE', '/teams/team-1/posts/post-1') => <String, Object?>{
            'deletedPostId': 'post-1',
          },
          _ => <String, Object?>{'postId': 'post-1'},
        };
        return _json(200, <String, Object?>{'success': true, 'data': data});
      });
    final api = ClubExpansionApi(dio);

    await api.fetchMember('team-1', 'member-1', 2026);
    await api.fetchProfile('team-1');
    await api.updateProfile('team-1', <String, dynamic>{'notice': '공지'});
    await api.fetchSeasonRanking(
      'team-1',
      seasonId: 'season-1',
      competitionType: 'TEAM',
    );
    await api.fetchSeasonMember(
      'team-1',
      'member-1',
      seasonId: 'season-1',
      competitionType: 'TEAM',
    );
    await api.fetchPosts('team-1', 1);
    await api.fetchPost('team-1', 'post-1');
    await api.savePost('team-1', title: '제목', content: '본문');
    await api.savePost('team-1', postId: 'post-1', title: '수정', content: '본문');
    await api.deletePost('team-1', 'post-1');

    expect(
      requests.map((item) => '${item.method} ${item.path}'),
      containsAll(<String>[
        'GET /teams/team-1/members/member-1',
        'GET /teams/team-1/profile',
        'PATCH /teams/team-1/profile',
        'GET /teams/team-1/season-ranking',
        'GET /teams/team-1/season-ranking/members/member-1',
        'GET /teams/team-1/posts',
        'GET /teams/team-1/posts/post-1',
        'POST /teams/team-1/posts',
        'PATCH /teams/team-1/posts/post-1',
        'DELETE /teams/team-1/posts/post-1',
      ]),
    );
    expect(requests.first.queryParameters['year'], 2026);
    expect(
      requests
          .firstWhere((item) => item.path.endsWith('/posts'))
          .queryParameters,
      <String, Object>{'page': 1, 'limit': 20},
    );
    final rankingRequests = requests.where(
      (item) => item.path.contains('/season-ranking'),
    );
    for (final request in rankingRequests) {
      expect(request.queryParameters['seasonId'], 'season-1');
      expect(request.queryParameters['type'], 'TEAM');
    }
  });

  test('maps malformed expansion envelopes to the shared API error', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter(
        (_) => _json(200, <String, Object>{'success': true, 'data': 'bad'}),
      );
    await expectLater(
      ClubExpansionApi(dio).fetchProfile('team-1'),
      throwsA(
        isA<ApiException>().having(
          (error) => error.kind,
          'kind',
          ApiErrorKind.malformedResponse,
        ),
      ),
    );
  });
}

Map<String, dynamic> _memberJson() => <String, dynamic>{
  'id': 'member-1',
  'name': '회원',
  'alias': null,
  'role': 'MEMBER',
  'handicap': null,
  'joinedAt': '2025-01-01T00:00:00.000Z',
  'activityStartDate': null,
  'year': 2026,
  'attendanceRate': 0,
  'attended': 0,
  'activityCount': 0,
  'gameCount': 0,
  'total': 0,
  'average': 0,
  'monthlyAverages': List<int?>.filled(12, null),
  'medals': <String, int>{'gold': 0, 'silver': 0, 'bronze': 0},
  'recentRegularScores': <Object>[],
};

Map<String, dynamic> _profileJson() => <String, dynamic>{
  'id': 'team-1',
  'name': '팀',
  'description': null,
  'notice': null,
  'myRole': 'OWNER',
  'seasonRankingEnabled': false,
  'activeSeason': null,
};

Map<String, dynamic> _postJson() => <String, dynamic>{
  'id': 'post-1',
  'title': '제목',
  'content': '본문',
  'authorName': '작성자',
  'createdAt': '2026-09-22T00:00:00.000Z',
  'updatedAt': '2026-09-22T00:00:00.000Z',
  'images': <Object>[],
  'canEdit': true,
};

Map<String, dynamic> _rankingRowJson() => <String, dynamic>{
  'rank': 1,
  'id': 'member-1',
  'name': '회원',
  'points': 20,
  'attended': 1,
  'games': 0,
  'average': 0,
  'gold': 0,
  'silver': 0,
  'bronze': 0,
  'individualPoints': 0,
  'teamPoints': 20,
  'eventPoints': 0,
  'competitionsPlayed': 1,
  'individualWins': 0,
  'teamWins': 0,
  'eventWins': 0,
  'entries': <Object>[],
  'monthlyHistory': List<Object>.filled(12, <Object>[]),
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
