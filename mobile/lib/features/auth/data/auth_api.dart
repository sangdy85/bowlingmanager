import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_tokens.dart';
import 'package:dio/dio.dart';

abstract interface class AuthApi {
  Future<AuthTokens> login(String email, String password);

  Future<AuthTokens> refresh(String refreshToken);

  Future<void> logout(String refreshToken);
}

class MobileAuthApi implements AuthApi {
  MobileAuthApi(this._dio);

  final Dio _dio;

  @override
  Future<AuthTokens> login(String email, String password) async {
    return _requestTokens('/auth/login', <String, String>{
      'email': email,
      'password': password,
    });
  }

  @override
  Future<AuthTokens> refresh(String refreshToken) async {
    return _requestTokens('/auth/refresh', <String, String>{
      'refreshToken': refreshToken,
    });
  }

  @override
  Future<void> logout(String refreshToken) async {
    try {
      final Response<dynamic> response = await _dio.post<dynamic>(
        '/auth/logout',
        data: <String, String>{'refreshToken': refreshToken},
      );
      final Map<String, dynamic> data = _readSuccessData(response.data);
      if (data['loggedOut'] != true) throw ApiException.malformedResponse();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    }
  }

  Future<AuthTokens> _requestTokens(
    String path,
    Map<String, String> body,
  ) async {
    try {
      final Response<dynamic> response = await _dio.post<dynamic>(
        path,
        data: body,
      );
      return AuthTokens.fromJson(_readSuccessData(response.data));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    }
  }

  Map<String, dynamic> _readSuccessData(Object? body) {
    if (body is! Map || body['success'] != true || body['data'] is! Map) {
      throw const FormatException('Invalid API response envelope.');
    }
    return Map<String, dynamic>.from(body['data'] as Map);
  }
}
