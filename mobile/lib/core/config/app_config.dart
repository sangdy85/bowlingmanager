import 'package:flutter/foundation.dart';

enum AppEnvironment { development, production }

class AppConfig {
  const AppConfig({required this.environment, required this.apiBaseUrl});

  static const String productionApiBaseUrl =
      'https://bowlingmanager.co.kr/api/mobile/v1';
  static const String developmentApiBaseUrl =
      'http://10.0.2.2:3000/api/mobile/v1';

  final AppEnvironment environment;
  final String apiBaseUrl;

  factory AppConfig.fromEnvironment() => AppConfig.resolve(
    environmentName: const String.fromEnvironment('APP_ENV'),
    apiBaseUrlOverride: const String.fromEnvironment('API_BASE_URL'),
    isReleaseMode: kReleaseMode,
  );

  @visibleForTesting
  factory AppConfig.resolve({
    required String environmentName,
    required String apiBaseUrlOverride,
    required bool isReleaseMode,
  }) {
    final AppEnvironment environment = isReleaseMode
        ? AppEnvironment.production
        : environmentName.trim().toLowerCase() == 'production'
        ? AppEnvironment.production
        : AppEnvironment.development;
    final String override = apiBaseUrlOverride.trim();
    if (override.isNotEmpty) {
      final Uri? uri = Uri.tryParse(override);
      final bool containsWhitespaceOrControl = RegExp(
        r'[\s\u0000-\u001F\u007F]',
        unicode: true,
      ).hasMatch(apiBaseUrlOverride);
      final bool validHttpUrl =
          uri != null &&
          !containsWhitespaceOrControl &&
          (uri.scheme == 'http' || uri.scheme == 'https') &&
          uri.host.isNotEmpty &&
          uri.userInfo.isEmpty &&
          !uri.hasQuery &&
          !uri.hasFragment;
      if (!validHttpUrl || (isReleaseMode && uri.scheme != 'https')) {
        throw StateError(
          isReleaseMode
              ? 'Release API_BASE_URL must be a valid HTTPS URL.'
              : 'API_BASE_URL must be a valid HTTP(S) URL.',
        );
      }
    }

    return AppConfig(
      environment: environment,
      apiBaseUrl: override.isNotEmpty
          ? override
          : environment == AppEnvironment.production
          ? productionApiBaseUrl
          : developmentApiBaseUrl,
    );
  }
}
