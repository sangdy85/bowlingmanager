import 'package:bowlingmanager_mobile/core/config/app_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('debug defaults to the Android emulator development API', () {
    final AppConfig config = AppConfig.resolve(
      environmentName: '',
      apiBaseUrlOverride: '',
      isReleaseMode: false,
    );

    expect(config.environment, AppEnvironment.development);
    expect(config.apiBaseUrl, AppConfig.developmentApiBaseUrl);
  });

  test('debug supports the existing explicit production environment', () {
    final AppConfig config = AppConfig.resolve(
      environmentName: 'production',
      apiBaseUrlOverride: '',
      isReleaseMode: false,
    );

    expect(config.environment, AppEnvironment.production);
    expect(config.apiBaseUrl, AppConfig.productionApiBaseUrl);
  });

  test('release defaults to production even when APP_ENV is omitted', () {
    final AppConfig config = AppConfig.resolve(
      environmentName: '',
      apiBaseUrlOverride: '',
      isReleaseMode: true,
    );

    expect(config.environment, AppEnvironment.production);
    expect(config.apiBaseUrl, AppConfig.productionApiBaseUrl);
  });

  test('release cannot be switched back to development by APP_ENV', () {
    final AppConfig config = AppConfig.resolve(
      environmentName: 'development',
      apiBaseUrlOverride: '',
      isReleaseMode: true,
    );

    expect(config.environment, AppEnvironment.production);
    expect(config.apiBaseUrl, AppConfig.productionApiBaseUrl);
  });

  test('release accepts an explicit HTTPS API override', () {
    final AppConfig config = AppConfig.resolve(
      environmentName: '',
      apiBaseUrlOverride: 'https://staging.example.test/api/mobile/v1',
      isReleaseMode: true,
    );

    expect(config.environment, AppEnvironment.production);
    expect(config.apiBaseUrl, 'https://staging.example.test/api/mobile/v1');
  });

  test('release accepts an uppercase HTTPS scheme after URI normalization', () {
    final AppConfig config = AppConfig.resolve(
      environmentName: '',
      apiBaseUrlOverride: 'HTTPS://staging.example.test/api/mobile/v1',
      isReleaseMode: true,
    );

    expect(config.environment, AppEnvironment.production);
    expect(config.apiBaseUrl, 'HTTPS://staging.example.test/api/mobile/v1');
  });

  test('release rejects cleartext and malformed API overrides', () {
    for (final String override in <String>[
      'http://10.0.2.2:3000/api/mobile/v1',
      'not-a-url',
      'https:///api/mobile/v1',
      '//example.test/api/mobile/v1',
      'https://example.com@evil.test/api/mobile/v1',
      'https://user%40example.com@evil.test/api/mobile/v1',
      'https://user@example.test/api/mobile/v1',
      'https://example.test/api/mobile/v1?debug=true',
      'https://example.test/api/mobile/v1#fragment',
      'https://example.test /api/mobile/v1',
      ' https://example.test/api/mobile/v1',
    ]) {
      expect(
        () => AppConfig.resolve(
          environmentName: '',
          apiBaseUrlOverride: override,
          isReleaseMode: true,
        ),
        throwsStateError,
        reason: override,
      );
    }
  });

  test('debug keeps an explicit local HTTP API override available', () {
    final AppConfig config = AppConfig.resolve(
      environmentName: '',
      apiBaseUrlOverride: 'http://10.0.2.2:4000/api/mobile/v1',
      isReleaseMode: false,
    );

    expect(config.environment, AppEnvironment.development);
    expect(config.apiBaseUrl, 'http://10.0.2.2:4000/api/mobile/v1');
  });
}
