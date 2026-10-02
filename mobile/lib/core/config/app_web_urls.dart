abstract final class AppWebUrls {
  static const String baseUrl = 'https://www.bowlingmanager.co.kr';

  static final Uri registration = Uri.parse('$baseUrl/register');
  static final Uri passwordRecovery = Uri.parse(
    '$baseUrl/find-account/password',
  );
  static final Uri teamCreation = Uri.parse('$baseUrl/team/create');
}
