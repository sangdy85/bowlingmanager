import 'package:dio/dio.dart';

enum ApiErrorKind {
  timeout,
  networkUnavailable,
  badRequest,
  unauthorized,
  forbidden,
  server,
  malformedResponse,
  unknown,
}

class ApiException implements Exception {
  const ApiException({
    required this.kind,
    required this.userMessage,
    this.code,
  });

  final ApiErrorKind kind;
  final String userMessage;
  final String? code;

  factory ApiException.fromDio(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return const ApiException(
          kind: ApiErrorKind.timeout,
          userMessage: '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
        );
      case DioExceptionType.connectionError:
        return const ApiException(
          kind: ApiErrorKind.networkUnavailable,
          userMessage: '네트워크 연결을 확인해주세요.',
        );
      case DioExceptionType.badResponse:
        return _fromResponse(error.response);
      case DioExceptionType.cancel:
      case DioExceptionType.badCertificate:
      case DioExceptionType.unknown:
        return const ApiException(
          kind: ApiErrorKind.unknown,
          userMessage: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.',
        );
    }
  }

  factory ApiException.malformedResponse() => const ApiException(
    kind: ApiErrorKind.malformedResponse,
    userMessage: '서버 응답을 확인할 수 없습니다. 잠시 후 다시 시도해주세요.',
  );

  static ApiException _fromResponse(Response<dynamic>? response) {
    final int statusCode = response?.statusCode ?? 0;
    final (String?, String?) backendError = _readBackendError(response?.data);
    final String? code = backendError.$1;
    final String? message = backendError.$2;

    if (statusCode == 400) {
      return ApiException(
        kind: ApiErrorKind.badRequest,
        code: code,
        userMessage: message ?? '입력한 내용을 확인해주세요.',
      );
    }
    if (statusCode == 401) {
      return ApiException(
        kind: ApiErrorKind.unauthorized,
        code: code,
        userMessage: message ?? '로그인이 필요합니다.',
      );
    }
    if (statusCode == 403) {
      return ApiException(
        kind: ApiErrorKind.forbidden,
        code: code,
        userMessage: message ?? '요청을 수행할 권한이 없습니다.',
      );
    }
    if (statusCode >= 500) {
      return const ApiException(
        kind: ApiErrorKind.server,
        userMessage: '서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      );
    }

    return ApiException(
      kind: ApiErrorKind.unknown,
      code: code,
      userMessage: message ?? '요청을 처리하지 못했습니다.',
    );
  }

  static (String?, String?) _readBackendError(Object? data) {
    if (data is! Map) return (null, null);
    final Object? error = data['error'];
    if (error is! Map) return (null, null);
    final Object? code = error['code'];
    final Object? message = error['message'];
    return (code is String ? code : null, message is String ? message : null);
  }
}
