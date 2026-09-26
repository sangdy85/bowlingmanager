import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/notifications/domain/mobile_notification.dart';
import 'package:dio/dio.dart';

class NotificationApi {
  NotificationApi(this._dio);
  final Dio _dio;

  Future<void> registerDevice(String token) async => _mutate(
    '/push/devices',
    'POST',
    <String, Object>{'token': token, 'platform': 'ANDROID'},
  );

  Future<void> revokeDevice(String token) async => _mutate(
    '/push/devices',
    'DELETE',
    <String, Object>{'token': token, 'platform': 'ANDROID'},
  );

  Future<List<MobileNotificationItem>> list() async {
    try {
      final response = await _dio.get<dynamic>(
        '/notifications',
        queryParameters: const <String, int>{'page': 1, 'limit': 50},
      );
      final data = _readData(response.data);
      final items = data['items'];
      if (items is! List) throw const FormatException();
      return List<MobileNotificationItem>.unmodifiable(
        items.map(
          (value) => MobileNotificationItem.fromJson(
            Map<String, dynamic>.from(value as Map),
          ),
        ),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    }
  }

  Future<void> markRead(String id) =>
      _mutate('/notifications/$id/read', 'POST', const <String, Object>{});

  Future<void> _mutate(
    String path,
    String method,
    Map<String, Object> data,
  ) async {
    try {
      await _dio.request<dynamic>(
        path,
        data: data,
        options: Options(method: method),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}

Map<String, dynamic> _readData(Object? value) {
  if (value is! Map || value['success'] != true || value['data'] is! Map) {
    throw const FormatException();
  }
  return Map<String, dynamic>.from(value['data'] as Map);
}
