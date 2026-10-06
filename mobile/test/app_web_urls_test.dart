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
    expect(
      AppWebUrls.teamCreation.toString(),
      'https://www.bowlingmanager.co.kr/team/create',
    );
    expect(
      AppWebUrls.privacyPolicy.toString(),
      'https://www.bowlingmanager.co.kr/privacy',
    );
    expect(
      AppWebUrls.terms.toString(),
      'https://www.bowlingmanager.co.kr/terms',
    );
    expect(
      AppWebUrls.inquiry.toString(),
      'https://www.bowlingmanager.co.kr/inquiry',
    );
    for (final Uri uri in <Uri>[
      AppWebUrls.teamCreation,
      AppWebUrls.privacyPolicy,
      AppWebUrls.terms,
      AppWebUrls.inquiry,
    ]) {
      expect(uri.scheme, 'https');
      expect(uri.host, 'www.bowlingmanager.co.kr');
    }
  });
}
