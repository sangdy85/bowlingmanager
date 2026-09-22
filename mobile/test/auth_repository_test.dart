import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/data/auth_repository.dart';
import 'package:bowlingmanager_mobile/features/auth/data/refresh_coordinator.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';

void main() {
  late MemoryTokenStorage storage;
  late FakeAuthApi authApi;
  late FakeCurrentUserApi userApi;
  late RefreshCoordinator coordinator;
  late MobileAuthRepository repository;

  setUp(() {
    storage = MemoryTokenStorage();
    authApi = FakeAuthApi();
    userApi = FakeCurrentUserApi();
    coordinator = RefreshCoordinator(authApi, storage, () {});
    repository = MobileAuthRepository(authApi, userApi, storage, coordinator);
  });

  test(
    'login success saves the token pair and returns the current user',
    () async {
      final user = await repository.login('user@example.com', 'password');

      expect(user, same(testUser));
      expect(storage.accessToken, testTokens.accessToken);
      expect(storage.refreshToken, testTokens.refreshToken);
      expect(storage.saveCount, 1);
      expect(userApi.callCount, 1);
    },
  );

  test('login failure never saves tokens', () async {
    authApi.loginError = const ApiException(
      kind: ApiErrorKind.unauthorized,
      userMessage: '이메일 또는 비밀번호를 확인해주세요.',
      code: 'INVALID_CREDENTIALS',
    );

    await expectLater(
      repository.login('user@example.com', 'wrong'),
      throwsA(isA<ApiException>()),
    );
    expect(storage.saveCount, 0);
    expect(storage.accessToken, isNull);
    expect(storage.refreshToken, isNull);
  });

  test('bootstrap with a valid access token loads the current user', () async {
    storage
      ..accessToken = 'existing-access'
      ..refreshToken = 'existing-refresh';

    final user = await repository.bootstrap();

    expect(user, same(testUser));
    expect(userApi.callCount, 1);
    expect(authApi.refreshCount, 0);
  });

  test('refresh current user reuses the protected current-user API', () async {
    final user = await repository.refreshCurrentUser();

    expect(user, same(testUser));
    expect(userApi.callCount, 1);
  });

  test(
    'refresh failure clears tokens and reports authentication failure',
    () async {
      storage.refreshToken = 'expired-refresh';
      authApi.refreshError = const ApiException(
        kind: ApiErrorKind.unauthorized,
        userMessage: '유효하지 않은 Refresh Token입니다.',
      );
      var authenticationFailures = 0;
      coordinator = RefreshCoordinator(
        authApi,
        storage,
        () => authenticationFailures += 1,
      );

      await expectLater(
        coordinator.refreshSingleFlight(),
        throwsA(isA<ApiException>()),
      );
      expect(storage.clearCount, 1);
      expect(authenticationFailures, 1);
    },
  );

  test('logout calls the API and always clears local tokens', () async {
    storage
      ..accessToken = 'existing-access'
      ..refreshToken = 'existing-refresh';

    await repository.logout();

    expect(authApi.logoutCount, 1);
    expect(authApi.loggedOutRefreshToken, 'existing-refresh');
    expect(storage.accessToken, isNull);
    expect(storage.refreshToken, isNull);
    expect(storage.clearCount, 1);
  });

  test('logout clears local tokens when server revocation fails', () async {
    storage
      ..accessToken = 'existing-access'
      ..refreshToken = 'existing-refresh';
    authApi.logoutError = const ApiException(
      kind: ApiErrorKind.networkUnavailable,
      userMessage: '네트워크 연결을 확인해주세요.',
    );

    await repository.logout();

    expect(authApi.logoutCount, 1);
    expect(storage.accessToken, isNull);
    expect(storage.refreshToken, isNull);
    expect(storage.clearCount, 1);
  });
}
