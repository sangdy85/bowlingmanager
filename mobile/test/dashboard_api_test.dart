import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:bowlingmanager_mobile/core/domain/game_session.dart';
import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/home/data/dashboard_api.dart';
import 'package:bowlingmanager_mobile/features/home/domain/dashboard.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('MobileDashboardApi calls GET /dashboard and parses success', () async {
    RequestOptions? capturedRequest;
    final Dio dio =
        Dio(BaseOptions(baseUrl: 'https://example.test/api/mobile/v1'))
          ..httpClientAdapter = _FakeHttpClientAdapter((
            RequestOptions options,
          ) async {
            capturedRequest = options;
            return _jsonResponse(200, _dashboardEnvelope);
          });

    final Dashboard dashboard = await MobileDashboardApi(dio).fetchDashboard();

    expect(capturedRequest?.method, 'GET');
    expect(capturedRequest?.uri.path, '/api/mobile/v1/dashboard');
    expect(dashboard.average, 187.4);
    expect(dashboard.recentScores.single.score, 215);
    expect(dashboard.recentSessions.single.average, 215);
    final route = Uri.parse(
      clubActivityRouteForSession(dashboard.recentSessions.single)!,
    );
    expect(route.path, '/club/team-1/records');
    expect(route.queryParameters['target'], '2026-09-15~REGULAR');
    expect(
      clubActivityRouteForSession(
        GameSession(
          id: 'personal-session',
          source: GameSessionSource.personal,
          gameDate: DateTime.utc(2026, 9, 15),
          gameType: '연습',
          team: null,
          scores: const <GameSessionScore>[
            GameSessionScore(id: 'personal-score', score: 180, memo: null),
          ],
          total: 180,
          average: 180,
          gameCount: 1,
        ),
      ),
      isNull,
    );
    dio.close(force: true);
  });

  test('MobileDashboardApi rejects a malformed envelope', () async {
    final Dio dio =
        Dio(BaseOptions(baseUrl: 'https://example.test/api/mobile/v1'))
          ..httpClientAdapter = _FakeHttpClientAdapter((
            RequestOptions options,
          ) async {
            return _jsonResponse(200, <String, Object>{
              'data': <String, Object>{},
            });
          });

    await expectLater(
      MobileDashboardApi(dio).fetchDashboard(),
      throwsA(
        isA<ApiException>().having(
          (ApiException error) => error.kind,
          'kind',
          ApiErrorKind.malformedResponse,
        ),
      ),
    );
    dio.close(force: true);
  });

  test('MobileDashboardApi maps an API error to ApiException', () async {
    final Dio dio =
        Dio(BaseOptions(baseUrl: 'https://example.test/api/mobile/v1'))
          ..httpClientAdapter = _FakeHttpClientAdapter((
            RequestOptions options,
          ) async {
            return _jsonResponse(500, <String, Object>{
              'success': false,
              'error': <String, Object>{
                'code': 'INTERNAL_SERVER_ERROR',
                'message': '요청을 처리하는 중 오류가 발생했습니다.',
              },
            });
          });

    await expectLater(
      MobileDashboardApi(dio).fetchDashboard(),
      throwsA(
        isA<ApiException>().having(
          (ApiException error) => error.kind,
          'kind',
          ApiErrorKind.server,
        ),
      ),
    );
    dio.close(force: true);
  });
}

const Map<String, Object> _dashboardEnvelope = <String, Object>{
  'success': true,
  'data': <String, Object>{
    'year': 2026,
    'average': 187.4,
    'highScore': 245,
    'gameCount': 36,
    'recentAverage': 215,
    'recentScores': <Object>[
      <String, Object?>{
        'id': 'score-1',
        'source': 'PERSONAL',
        'score': 215,
        'gameDate': '2026-09-15T00:00:00.000Z',
        'gameType': '정기전',
        'memo': null,
        'team': <String, Object>{'id': 'team-1', 'name': '테스트 팀'},
      },
    ],
    'recentSessions': <Object>[
      <String, Object?>{
        'id': 'session-1',
        'source': 'PERSONAL',
        'gameDate': '2026-09-15T00:00:00.000Z',
        'gameType': '정기전',
        'team': <String, Object>{'id': 'team-1', 'name': '테스트 팀'},
        'activityId': '2026-09-15~REGULAR',
        'scores': <Object>[
          <String, Object?>{'id': 'score-1', 'score': 215, 'memo': null},
        ],
        'total': 215,
        'average': 215,
        'gameCount': 1,
      },
    ],
  },
};

ResponseBody _jsonResponse(int statusCode, Object body) {
  return ResponseBody.fromString(
    jsonEncode(body),
    statusCode,
    headers: <String, List<String>>{
      Headers.contentTypeHeader: <String>[Headers.jsonContentType],
    },
  );
}

typedef _AdapterHandler = FutureOr<ResponseBody> Function(
  RequestOptions options,
);

class _FakeHttpClientAdapter implements HttpClientAdapter {
  _FakeHttpClientAdapter(this._handler);

  final _AdapterHandler _handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return _handler(options);
  }

  @override
  void close({bool force = false}) {}
}
