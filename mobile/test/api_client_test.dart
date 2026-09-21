import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:bowlingmanager_mobile/core/config/app_config.dart';
import 'package:bowlingmanager_mobile/core/network/api_client.dart';
import 'package:bowlingmanager_mobile/features/auth/data/auth_api.dart';
import 'package:bowlingmanager_mobile/features/auth/data/refresh_coordinator.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';

void main() {
  const AppConfig config = AppConfig(
    environment: AppEnvironment.development,
    apiBaseUrl: 'https://example.test/api/mobile/v1',
  );

  test(
    'concurrent 401 responses perform one refresh and retry every request',
    () async {
      final MemoryTokenStorage storage = MemoryTokenStorage()
        ..accessToken = 'expired-access'
        ..refreshToken = 'refresh-1';
      var refreshCalls = 0;
      var expiredRequests = 0;
      var retriedRequests = 0;

      final FakeHttpClientAdapter adapter = FakeHttpClientAdapter((
        options,
      ) async {
        if (options.uri.path.endsWith('/auth/refresh')) {
          refreshCalls += 1;
          await Future<void>.delayed(const Duration(milliseconds: 30));
          return jsonResponse(200, <String, Object>{
            'success': true,
            'data': <String, Object>{
              'accessToken': 'new-access',
              'refreshToken': 'refresh-2',
              'tokenType': 'Bearer',
              'expiresIn': 900,
              'refreshTokenExpiresIn': 2592000,
            },
          });
        }

        if (options.uri.path.endsWith('/resource')) {
          final Object? authorization = options.headers['Authorization'];
          if (authorization == 'Bearer expired-access') {
            expiredRequests += 1;
            return jsonResponse(401, unauthorizedEnvelope);
          }
          if (authorization == 'Bearer new-access') {
            retriedRequests += 1;
            return jsonResponse(200, <String, Object>{
              'success': true,
              'data': <String, Object>{'ok': true},
            });
          }
        }
        return jsonResponse(500, const <String, Object>{});
      });

      final Dio authDio = Dio(createMobileApiOptions(config))
        ..httpClientAdapter = adapter;
      final RefreshCoordinator coordinator = RefreshCoordinator(
        MobileAuthApi(authDio),
        storage,
        () {},
      );
      final Dio protectedDio = Dio()..httpClientAdapter = adapter;
      final ApiClient client = ApiClient(
        storage,
        coordinator,
        config: config,
        dio: protectedDio,
      );

      final List<Response<dynamic>> responses = await Future.wait(
        <Future<Response<dynamic>>>[
          client.dio.get<dynamic>('/resource'),
          client.dio.get<dynamic>('/resource'),
          client.dio.get<dynamic>('/resource'),
        ],
      );

      expect(responses, hasLength(3));
      expect(responses.every((response) => response.statusCode == 200), isTrue);
      expect(expiredRequests, 3);
      expect(refreshCalls, 1);
      expect(retriedRequests, 3);
      expect(storage.accessToken, 'new-access');
      expect(storage.refreshToken, 'refresh-2');

      client.dio.close(force: true);
      authDio.close(force: true);
    },
  );

  test(
    'refresh failure clears tokens and rejects the original request',
    () async {
      final MemoryTokenStorage storage = MemoryTokenStorage()
        ..accessToken = 'expired-access'
        ..refreshToken = 'invalid-refresh';
      var refreshCalls = 0;
      var authenticationFailures = 0;

      final FakeHttpClientAdapter adapter = FakeHttpClientAdapter((
        options,
      ) async {
        if (options.uri.path.endsWith('/auth/refresh')) {
          refreshCalls += 1;
          return jsonResponse(401, unauthorizedEnvelope);
        }
        return jsonResponse(401, unauthorizedEnvelope);
      });
      final Dio authDio = Dio(createMobileApiOptions(config))
        ..httpClientAdapter = adapter;
      final RefreshCoordinator coordinator = RefreshCoordinator(
        MobileAuthApi(authDio),
        storage,
        () => authenticationFailures += 1,
      );
      final ApiClient client = ApiClient(
        storage,
        coordinator,
        config: config,
        dio: Dio()..httpClientAdapter = adapter,
      );

      await expectLater(
        client.dio.get<dynamic>('/resource'),
        throwsA(isA<DioException>()),
      );
      expect(refreshCalls, 1);
      expect(storage.accessToken, isNull);
      expect(storage.refreshToken, isNull);
      expect(authenticationFailures, 1);

      client.dio.close(force: true);
      authDio.close(force: true);
    },
  );

  test('a retried 401 does not start a second refresh', () async {
    final MemoryTokenStorage storage = MemoryTokenStorage()
      ..accessToken = 'expired-access'
      ..refreshToken = 'refresh-1';
    var refreshCalls = 0;
    var resourceCalls = 0;
    var authenticationFailures = 0;

    final FakeHttpClientAdapter adapter = FakeHttpClientAdapter((
      options,
    ) async {
      if (options.uri.path.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        return jsonResponse(200, <String, Object>{
          'success': true,
          'data': <String, Object>{
            'accessToken': 'new-access',
            'refreshToken': 'refresh-2',
            'tokenType': 'Bearer',
            'expiresIn': 900,
            'refreshTokenExpiresIn': 2592000,
          },
        });
      }
      resourceCalls += 1;
      return jsonResponse(401, unauthorizedEnvelope);
    });
    final Dio authDio = Dio(createMobileApiOptions(config))
      ..httpClientAdapter = adapter;
    final RefreshCoordinator coordinator = RefreshCoordinator(
      MobileAuthApi(authDio),
      storage,
      () => authenticationFailures += 1,
    );
    final ApiClient client = ApiClient(
      storage,
      coordinator,
      config: config,
      dio: Dio()..httpClientAdapter = adapter,
    );

    await expectLater(
      client.dio.get<dynamic>('/resource'),
      throwsA(isA<DioException>()),
    );
    expect(resourceCalls, 2);
    expect(refreshCalls, 1);
    expect(authenticationFailures, 1);

    client.dio.close(force: true);
    authDio.close(force: true);
  });

  test('a multipart request can be recreated after a 401 refresh', () async {
    final MemoryTokenStorage storage = MemoryTokenStorage()
      ..accessToken = 'expired-access'
      ..refreshToken = 'refresh-1';
    var refreshCalls = 0;
    var uploadCalls = 0;
    final FakeHttpClientAdapter adapter = FakeHttpClientAdapter((
      options,
    ) async {
      if (options.uri.path.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        return jsonResponse(200, <String, Object>{
          'success': true,
          'data': <String, Object>{
            'accessToken': 'new-access',
            'refreshToken': 'refresh-2',
            'tokenType': 'Bearer',
            'expiresIn': 900,
            'refreshTokenExpiresIn': 2592000,
          },
        });
      }
      uploadCalls += 1;
      if (options.headers['Authorization'] == 'Bearer expired-access') {
        return jsonResponse(401, unauthorizedEnvelope);
      }
      return jsonResponse(200, <String, Object>{
        'success': true,
        'data': <String, Object>{'ok': true},
      });
    });
    final Dio authDio = Dio(createMobileApiOptions(config))
      ..httpClientAdapter = adapter;
    final RefreshCoordinator coordinator = RefreshCoordinator(
      MobileAuthApi(authDio),
      storage,
      () {},
    );
    final ApiClient client = ApiClient(
      storage,
      coordinator,
      config: config,
      dio: Dio()..httpClientAdapter = adapter,
    );

    final Response<dynamic> response = await client.dio.post<dynamic>(
      '/upload',
      data: FormData.fromMap(<String, Object>{
        'teamId': 'team-1',
        'image': MultipartFile.fromBytes(<int>[
          1,
          2,
          3,
        ], filename: 'synthetic.jpg'),
      }),
    );

    expect(response.statusCode, 200);
    expect(refreshCalls, 1);
    expect(uploadCalls, 2);
    client.dio.close(force: true);
    authDio.close(force: true);
  });
}

const Map<String, Object> unauthorizedEnvelope = <String, Object>{
  'success': false,
  'error': <String, Object>{'code': 'UNAUTHORIZED', 'message': '로그인이 필요합니다.'},
};

ResponseBody jsonResponse(int statusCode, Object body) {
  return ResponseBody.fromString(
    jsonEncode(body),
    statusCode,
    headers: <String, List<String>>{
      Headers.contentTypeHeader: <String>[Headers.jsonContentType],
    },
  );
}

typedef AdapterHandler = FutureOr<ResponseBody> Function(
  RequestOptions options,
);

class FakeHttpClientAdapter implements HttpClientAdapter {
  FakeHttpClientAdapter(this._handler);

  final AdapterHandler _handler;

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
