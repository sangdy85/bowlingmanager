import 'package:bowlingmanager_mobile/core/config/app_web_urls.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('web account URLs use the canonical centralized base URL', () {
    expect(AppWebUrls.baseUrl, 'https://www.bowlingmanager.co.kr');
    expect(
      AppWebUrls.registration.toString(),
      'https://www.bowlingmanager.co.kr/register',
    );
    expect(
      AppWebUrls.passwordRecovery.toString(),
      'https://www.bowlingmanager.co.kr/find-account/password',
    );
  });
}
