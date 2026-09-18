import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/core/storage/secure_storage.dart';
import 'package:bowlingmanager_mobile/features/auth/data/auth_api.dart';
import 'package:bowlingmanager_mobile/features/auth/data/current_user_api.dart';
import 'package:bowlingmanager_mobile/features/auth/data/refresh_coordinator.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_tokens.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';

abstract interface class AuthRepository {
  Future<AuthUser?> bootstrap();

  Future<AuthUser> login(String email, String password);

  Future<void> logout();
}

class MobileAuthRepository implements AuthRepository {
  MobileAuthRepository(
    this._authApi,
    this._currentUserApi,
    this._storage,
    this._refreshCoordinator,
  );

  final AuthApi _authApi;
  final CurrentUserApi _currentUserApi;
  final TokenStorage _storage;
  final RefreshCoordinator _refreshCoordinator;

  @override
  Future<AuthUser?> bootstrap() async {
    final String? accessToken = await _storage.readAccessToken();
    final String? refreshToken = await _storage.readRefreshToken();

    if (accessToken == null && refreshToken == null) return null;
    if (refreshToken == null) {
      await _storage.clearTokens();
      return null;
    }

    try {
      if (accessToken == null) {
        await _refreshCoordinator.refreshSingleFlight();
      }
      return await _currentUserApi.me();
    } on Object {
      await _storage.clearTokens();
      rethrow;
    }
  }

  @override
  Future<AuthUser> login(String email, String password) async {
    final AuthTokens tokens = await _authApi.login(email, password);
    await _storage.saveTokens(
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    );

    try {
      return await _currentUserApi.me();
    } on Object {
      await _storage.clearTokens();
      rethrow;
    }
  }

  @override
  Future<void> logout() async {
    final String? refreshToken = await _storage.readRefreshToken();
    try {
      if (refreshToken != null && refreshToken.isNotEmpty) {
        await _authApi.logout(refreshToken);
      }
    } on ApiException {
      // Local logout must complete even when server revocation cannot be confirmed.
    } finally {
      await _storage.clearTokens();
    }
  }
}
