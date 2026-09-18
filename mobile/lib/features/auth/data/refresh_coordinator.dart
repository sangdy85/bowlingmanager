import 'dart:async';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/core/storage/secure_storage.dart';
import 'package:bowlingmanager_mobile/features/auth/data/auth_api.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_tokens.dart';

typedef AuthenticationFailureCallback = FutureOr<void> Function();

class RefreshCoordinator {
  RefreshCoordinator(
    this._authApi,
    this._storage,
    this._onAuthenticationFailure,
  );

  final AuthApi _authApi;
  final TokenStorage _storage;
  final AuthenticationFailureCallback _onAuthenticationFailure;

  Future<AuthTokens>? _refreshing;

  Future<AuthTokens> refreshSingleFlight() {
    final Future<AuthTokens>? activeRefresh = _refreshing;
    if (activeRefresh != null) return activeRefresh;

    late final Future<AuthTokens> refresh;
    refresh = _performRefresh().whenComplete(() {
      if (identical(_refreshing, refresh)) _refreshing = null;
    });
    _refreshing = refresh;
    return refresh;
  }

  Future<void> invalidateSession() async {
    await _storage.clearTokens();
    await _onAuthenticationFailure();
  }

  Future<AuthTokens> _performRefresh() async {
    final String? refreshToken = await _storage.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      await invalidateSession();
      throw const ApiException(
        kind: ApiErrorKind.unauthorized,
        userMessage: '로그인이 필요합니다.',
        code: 'MISSING_REFRESH_TOKEN',
      );
    }

    try {
      final AuthTokens tokens = await _authApi.refresh(refreshToken);
      await _storage.saveTokens(
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      );
      return tokens;
    } on Object {
      await invalidateSession();
      rethrow;
    }
  }
}
