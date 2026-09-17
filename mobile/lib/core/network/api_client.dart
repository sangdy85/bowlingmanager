import 'package:bowlingmanager_mobile/core/config/app_config.dart';
import 'package:dio/dio.dart';

class ApiClient {
  ApiClient({AppConfig? config, Dio? dio})
    : config = config ?? AppConfig.fromEnvironment(),
      dio = dio ?? Dio() {
    this.dio.options = BaseOptions(
      baseUrl: this.config.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      sendTimeout: const Duration(seconds: 15),
      headers: const <String, String>{'Accept': 'application/json'},
    );

    // Phase 4: add the bearer-token interceptor here. It must delegate all
    // concurrent 401 responses to one shared RefreshCoordinator Future.
  }

  final AppConfig config;
  final Dio dio;
}
