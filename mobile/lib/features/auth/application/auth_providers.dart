import 'package:bowlingmanager_mobile/core/config/app_config.dart';
import 'package:bowlingmanager_mobile/core/network/api_client.dart';
import 'package:bowlingmanager_mobile/core/storage/secure_storage.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_controller.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_state.dart';
import 'package:bowlingmanager_mobile/features/auth/data/auth_api.dart';
import 'package:bowlingmanager_mobile/features/auth/data/auth_repository.dart';
import 'package:bowlingmanager_mobile/features/auth/data/current_user_api.dart';
import 'package:bowlingmanager_mobile/features/auth/data/refresh_coordinator.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final Provider<AppConfig> appConfigProvider = Provider<AppConfig>(
  (Ref ref) => AppConfig.fromEnvironment(),
);

final Provider<TokenStorage> tokenStorageProvider = Provider<TokenStorage>(
  (Ref ref) => SecureStorageService(),
);

final Provider<Dio> authDioProvider = Provider<Dio>((Ref ref) {
  final Dio dio = Dio(createMobileApiOptions(ref.watch(appConfigProvider)));
  ref.onDispose(() => dio.close(force: true));
  return dio;
});

final Provider<AuthApi> authApiProvider = Provider<AuthApi>(
  (Ref ref) => MobileAuthApi(ref.watch(authDioProvider)),
);

final Provider<RefreshCoordinator> refreshCoordinatorProvider =
    Provider<RefreshCoordinator>((Ref ref) {
      return RefreshCoordinator(
        ref.watch(authApiProvider),
        ref.watch(tokenStorageProvider),
        () {
          ref.read(authControllerProvider.notifier).authenticationFailed();
        },
      );
    });

final Provider<ApiClient> apiClientProvider = Provider<ApiClient>((Ref ref) {
  final ApiClient client = ApiClient(
    ref.watch(tokenStorageProvider),
    ref.watch(refreshCoordinatorProvider),
    config: ref.watch(appConfigProvider),
  );
  ref.onDispose(() => client.dio.close(force: true));
  return client;
});

final Provider<CurrentUserApi> currentUserApiProvider =
    Provider<CurrentUserApi>(
      (Ref ref) => MobileCurrentUserApi(ref.watch(apiClientProvider).dio),
    );

final Provider<AuthRepository> authRepositoryProvider =
    Provider<AuthRepository>((Ref ref) {
      return MobileAuthRepository(
        ref.watch(authApiProvider),
        ref.watch(currentUserApiProvider),
        ref.watch(tokenStorageProvider),
        ref.watch(refreshCoordinatorProvider),
      );
    });

final NotifierProvider<AuthController, AuthState> authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);
