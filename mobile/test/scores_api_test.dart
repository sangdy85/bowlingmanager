import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/records/data/scores_api.dart';
import 'package:bowlingmanager_mobile/features/records/domain/score_record.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('MobileScoresApi calls GET /scores with page and limit', () async {
    RequestOptions? capturedRequest;
    final Dio dio =
        Dio(BaseOptions(baseUrl: 'https://example.test/api/mobile/v1'))
          ..httpClientAdapter = _FakeHttpClientAdapter((
            RequestOptions options,
          ) async {
            capturedRequest = options;
            return _jsonResponse(200, _scoresEnvelope);
          });

    final ScoresPage page = await MobileScoresApi(dio)
        .fetchScores(page: 2, limit: 20);

    expect(capturedRequest?.method, 'GET');
    expect(capturedRequest?.uri.path, '/api/mobile/v1/scores');
    expect(capturedRequest?.uri.queryParameters, <String, String>{
      'page': '2',
      'limit': '20',
    });
    expect(page.items.single.score, 215);
    dio.close(force: true);
  });

  test('MobileScoresApi rejects a malformed envelope', () async {
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
      MobileScoresApi(dio).fetchScores(page: 1, limit: 20),
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

  test('MobileScoresApi maps an API error to ApiException', () async {
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
      MobileScoresApi(dio).fetchScores(page: 1, limit: 20),
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

const Map<String, Object> _scoresEnvelope = <String, Object>{
  'success': true,
  'data': <String, Object>{
    'items': <Object>[
      <String, Object?>{
        'id': 'score-1',
        'score': 215,
        'gameDate': '2026-09-15T00:00:00.000Z',
        'gameType': null,
        'memo': null,
        'team': null,
      },
    ],
    'pagination': <String, Object>{
      'page': 2,
      'limit': 20,
      'total': 21,
      'totalPages': 2,
    },
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
