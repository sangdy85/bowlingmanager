import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/admin/data/super_admin_repository.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('loads team states and sends a strict Bowler Hidden toggle', () async {
    final List<RequestOptions> requests = <RequestOptions>[];
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter((RequestOptions options) {
        requests.add(options);
        return _json(200, <String, Object>{
          'success': true,
          'data': <String, Object>{
            if (options.method == 'GET')
              'teams': <Object>[_teamJson()]
            else
              'team': _teamJson(bowlerHiddenEnabled: true),
          },
        });
      });
    final MobileSuperAdminRepository repository = MobileSuperAdminRepository(
      dio,
    );

    final teams = await repository.fetchTeams();
    final updated = await repository.setBowlerHiddenEnabled(
      teamId: 'team/1',
      enabled: true,
    );

    expect(teams.single.seasonRankingEnabled, isTrue);
    expect(teams.single.bowlerHiddenEnabled, isFalse);
    expect(updated.bowlerHiddenEnabled, isTrue);
    expect(requests[0].method, 'GET');
    expect(requests[0].path, '/admin/teams');
    expect(requests[1].method, 'PATCH');
    expect(requests[1].path, '/admin/teams/team%2F1/bowler-hidden');
    expect(requests[1].data, <String, dynamic>{'enabled': true});
  });

  test('rejects malformed team state and maps safe API failures', () async {
    Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter(
        (_) => _json(200, <String, Object>{
          'success': true,
          'data': <String, Object>{
            'teams': <Object>[_teamJson(bowlerHiddenEnabled: 'ON')],
          },
        }),
      );
    await expectLater(
      MobileSuperAdminRepository(dio).fetchTeams(),
      throwsA(
        isA<ApiException>().having(
          (ApiException error) => error.kind,
          'kind',
          ApiErrorKind.malformedResponse,
        ),
      ),
    );

    dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter(
        (_) => _json(403, <String, Object>{
          'success': false,
          'error': <String, Object>{
            'code': 'FORBIDDEN',
            'message': '슈퍼 관리자 권한이 필요합니다.',
          },
        }),
      );
    await expectLater(
      MobileSuperAdminRepository(dio).fetchTeams(),
      throwsA(
        isA<ApiException>()
            .having(
              (ApiException error) => error.kind,
              'kind',
              ApiErrorKind.forbidden,
            )
            .having(
              (ApiException error) => error.userMessage,
              'message',
              '슈퍼 관리자 권한이 필요합니다.',
            ),
      ),
    );
  });
}

Map<String, Object> _teamJson({Object bowlerHiddenEnabled = false}) =>
    <String, Object>{
      'id': 'team-1',
      'name': '테스트 동호회',
      'code': 'TEST01',
      'bowlerHiddenEnabled': bowlerHiddenEnabled,
      'seasonRankingEnabled': true,
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
