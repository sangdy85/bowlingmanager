import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:dio/dio.dart';

abstract interface class CurrentUserApi {
  Future<AuthUser> me();
}

class MobileCurrentUserApi implements CurrentUserApi {
  MobileCurrentUserApi(this._dio);

  final Dio _dio;

  @override
  Future<AuthUser> me() async {
    try {
      final Response<dynamic> response = await _dio.get<dynamic>('/me');
      final Object? body = response.data;
      if (body is! Map || body['success'] != true || body['data'] is! Map) {
        throw const FormatException('Invalid API response envelope.');
      }
      return AuthUser.fromJson(Map<String, dynamic>.from(body['data'] as Map));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    } on TypeError {
      throw ApiException.malformedResponse();
    }
  }
}
