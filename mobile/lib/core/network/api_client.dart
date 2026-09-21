import 'package:bowlingmanager_mobile/core/config/app_config.dart';
import 'package:bowlingmanager_mobile/core/storage/secure_storage.dart';
import 'package:bowlingmanager_mobile/features/auth/data/refresh_coordinator.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_tokens.dart';
import 'package:dio/dio.dart';

class ApiClient {
  ApiClient(
    this._storage,
    this._refreshCoordinator, {
    AppConfig? config,
    Dio? dio,
  }) : config = config ?? AppConfig.fromEnvironment(),
       dio = dio ?? Dio() {
    this.dio.options = createMobileApiOptions(this.config);
    this.dio.interceptors.add(
      InterceptorsWrapper(onRequest: _onRequest, onError: _onError),
    );
  }

  final AppConfig config;
  final Dio dio;
  final TokenStorage _storage;
  final RefreshCoordinator _refreshCoordinator;

  static const String _retryMarker = 'mobileAuthRetried';
  static const String _skipAuthMarker = 'skipMobileAuth';

  Future<void> _onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (_shouldSkipAuthentication(options)) {
      handler.next(options);
      return;
    }

    final String? accessToken = await _storage.readAccessToken();
    if (accessToken != null && accessToken.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $accessToken';
    }
    handler.next(options);
  }

  Future<void> _onError(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    final RequestOptions request = error.requestOptions;
    if (error.response?.statusCode != 401 ||
        _shouldSkipAuthentication(request)) {
      handler.next(error);
      return;
    }

    if (request.extra[_retryMarker] == true) {
      await _refreshCoordinator.invalidateSession();
      handler.next(error);
      return;
    }

    try {
      final AuthTokens tokens = await _refreshCoordinator.refreshSingleFlight();
      request.extra[_retryMarker] = true;
      request.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
      if (request.data is FormData) {
        request.data = (request.data as FormData).clone();
      }
      final Response<dynamic> response = await dio.fetch<dynamic>(request);
      handler.resolve(response);
    } on Object {
      handler.next(error);
    }
  }

  bool _shouldSkipAuthentication(RequestOptions options) {
    if (options.extra[_skipAuthMarker] == true) return true;
    final String path = options.uri.path;
    return path.endsWith('/auth/login') ||
        path.endsWith('/auth/refresh') ||
        path.endsWith('/auth/logout');
  }
}

BaseOptions createMobileApiOptions(AppConfig config) => BaseOptions(
  baseUrl: config.apiBaseUrl,
  connectTimeout: const Duration(seconds: 10),
  receiveTimeout: const Duration(seconds: 15),
  sendTimeout: const Duration(seconds: 15),
  headers: const <String, String>{
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
);
