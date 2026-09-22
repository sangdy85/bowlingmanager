import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/data/current_user_api.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('GET /me parses nullable profile fields and handicap', () async {
    RequestOptions? request;
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter((RequestOptions options) {
        request = options;
        return _json(200, <String, Object>{
          'success': true,
          'data': <String, Object?>{
            'id': 'user-1',
            'email': null,
            'name': null,
            'role': 'USER',
            'handicap': null,
          },
        });
      });

    final AuthUser user = await MobileCurrentUserApi(dio).me();

    expect(request?.method, 'GET');
    expect(request?.path, '/me');
    expect(user.email, isNull);
    expect(user.name, isNull);
    expect(user.handicap, isNull);
  });

  test('GET /me rejects malformed envelopes and profile field types', () async {
    for (final Object response in <Object>[
      <String, Object>{'success': true, 'data': 'invalid'},
      <String, Object>{
        'success': true,
        'data': <String, Object?>{
          'id': 'user-1',
          'email': 'user@example.com',
          'name': '볼러',
          'role': 'USER',
          'handicap': '10',
        },
      },
    ]) {
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
        ..httpClientAdapter = _Adapter((_) => _json(200, response));

      await expectLater(
        MobileCurrentUserApi(dio).me(),
        throwsA(
          isA<ApiException>().having(
            (ApiException error) => error.kind,
            'kind',
            ApiErrorKind.malformedResponse,
          ),
        ),
      );
    }
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
