enum AppEnvironment { development, production }

class AppConfig {
  const AppConfig({required this.environment, required this.apiBaseUrl});

  static const String productionApiBaseUrl =
      'https://bowlingmanager.co.kr/api/mobile/v1';
  static const String developmentApiBaseUrl =
      'http://10.0.2.2:3000/api/mobile/v1';

  final AppEnvironment environment;
  final String apiBaseUrl;

  factory AppConfig.fromEnvironment() {
    const String environmentName = String.fromEnvironment(
      'APP_ENV',
      defaultValue: 'development',
    );
    const String apiBaseUrlOverride = String.fromEnvironment('API_BASE_URL');
    final AppEnvironment environment = environmentName == 'production'
        ? AppEnvironment.production
        : AppEnvironment.development;

    return AppConfig(
      environment: environment,
      apiBaseUrl: apiBaseUrlOverride.isNotEmpty
          ? apiBaseUrlOverride
          : environment == AppEnvironment.production
          ? productionApiBaseUrl
          : developmentApiBaseUrl,
    );
  }
}
