import 'package:bowlingmanager_mobile/core/storage/secure_storage.dart';
import 'package:bowlingmanager_mobile/features/auth/data/auth_api.dart';
import 'package:bowlingmanager_mobile/features/auth/data/auth_repository.dart';
import 'package:bowlingmanager_mobile/features/auth/data/current_user_api.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_tokens.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';

const AuthTokens testTokens = AuthTokens(
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'Bearer',
  expiresIn: 900,
  refreshTokenExpiresIn: 2592000,
);

const AuthUser testUser = AuthUser(
  id: 'user-1',
  email: 'user@example.com',
  name: '테스트 볼러',
  role: 'USER',
  handicap: 10,
);

class MemoryTokenStorage implements TokenStorage {
  String? accessToken;
  String? refreshToken;
  int saveCount = 0;
  int clearCount = 0;

  @override
  Future<void> clearTokens() async {
    clearCount += 1;
    accessToken = null;
    refreshToken = null;
  }

  @override
  Future<String?> readAccessToken() async => accessToken;

  @override
  Future<String?> readRefreshToken() async => refreshToken;

  @override
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    saveCount += 1;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }
}

class FakeAuthApi implements AuthApi {
  AuthTokens loginResult = testTokens;
  AuthTokens refreshResult = testTokens;
  Object? loginError;
  Object? refreshError;
  Object? logoutError;
  int loginCount = 0;
  int refreshCount = 0;
  int logoutCount = 0;
  String? loggedOutRefreshToken;

  @override
  Future<AuthTokens> login(String email, String password) async {
    loginCount += 1;
    if (loginError case final Object error) throw error;
    return loginResult;
  }

  @override
  Future<void> logout(String refreshToken) async {
    logoutCount += 1;
    loggedOutRefreshToken = refreshToken;
    if (logoutError case final Object error) throw error;
  }

  @override
  Future<AuthTokens> refresh(String refreshToken) async {
    refreshCount += 1;
    if (refreshError case final Object error) throw error;
    return refreshResult;
  }
}

class FakeCurrentUserApi implements CurrentUserApi {
  AuthUser result = testUser;
  Object? error;
  int callCount = 0;

  @override
  Future<AuthUser> me() async {
    callCount += 1;
    if (error case final Object currentError) throw currentError;
    return result;
  }
}

class FakeAuthRepository implements AuthRepository {
  AuthUser? bootstrapResult;
  AuthUser loginResult = testUser;
  Object? bootstrapError;
  Object? loginError;
  Object? logoutError;
  int bootstrapCount = 0;
  int loginCount = 0;
  int logoutCount = 0;

  @override
  Future<AuthUser?> bootstrap() async {
    bootstrapCount += 1;
    if (bootstrapError case final Object error) throw error;
    return bootstrapResult;
  }

  @override
  Future<AuthUser> login(String email, String password) async {
    loginCount += 1;
    if (loginError case final Object error) throw error;
    return loginResult;
  }

  @override
  Future<void> logout() async {
    logoutCount += 1;
    if (logoutError case final Object error) throw error;
  }
}
