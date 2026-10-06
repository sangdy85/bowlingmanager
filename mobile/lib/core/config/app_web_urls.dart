abstract final class AppWebUrls {
  static const String baseUrl = 'https://www.bowlingmanager.co.kr';

  static final Uri registration = Uri.parse('$baseUrl/register');
  static final Uri passwordRecovery = Uri.parse(
    '$baseUrl/find-account/password',
  );
  static final Uri teamCreation = Uri.parse('$baseUrl/team/create');
  static final Uri privacyPolicy = Uri.parse('$baseUrl/privacy');
  static final Uri terms = Uri.parse('$baseUrl/terms');
  static final Uri inquiry = Uri.parse('$baseUrl/inquiry');
}
