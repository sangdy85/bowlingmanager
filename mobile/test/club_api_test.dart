import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_api.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
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
}

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
