import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

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
        'gameType': null,
        'memo': null,
        'team': null,
      },
    ],
    'recentSessions': <Object>[
      <String, Object?>{
        'id': 'session-1',
        'source': 'PERSONAL',
        'gameDate': '2026-09-15T00:00:00.000Z',
        'gameType': null,
        'team': null,
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
