import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/home/domain/dashboard.dart';
import 'package:dio/dio.dart';

abstract interface class DashboardApi {
  Future<Dashboard> fetchDashboard();
}

class MobileDashboardApi implements DashboardApi {
  MobileDashboardApi(this._dio);

  final Dio _dio;

  @override
  Future<Dashboard> fetchDashboard() async {
    try {
      final Response<dynamic> response = await _dio.get<dynamic>('/dashboard');
      final Object? body = response.data;
      if (body is! Map || body['success'] != true || body['data'] is! Map) {
        throw const FormatException('Invalid API response envelope.');
      }
      return Dashboard.fromJson(Map<String, dynamic>.from(body['data'] as Map));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    }
  }
}
