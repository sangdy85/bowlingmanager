class AuthTokens {
  const AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.tokenType,
    required this.expiresIn,
    required this.refreshTokenExpiresIn,
  });

  final String accessToken;
  final String refreshToken;
  final String tokenType;
  final int expiresIn;
  final int refreshTokenExpiresIn;

  factory AuthTokens.fromJson(Map<String, dynamic> json) {
    final Object? accessToken = json['accessToken'];
    final Object? refreshToken = json['refreshToken'];
    final Object? tokenType = json['tokenType'];
    final Object? expiresIn = json['expiresIn'];
    final Object? refreshTokenExpiresIn = json['refreshTokenExpiresIn'];

    if (accessToken is! String ||
        accessToken.isEmpty ||
        refreshToken is! String ||
        refreshToken.isEmpty ||
        tokenType is! String ||
        tokenType.toLowerCase() != 'bearer' ||
        expiresIn is! int ||
        expiresIn <= 0 ||
        refreshTokenExpiresIn is! int ||
        refreshTokenExpiresIn <= 0) {
      throw const FormatException('Invalid authentication token response.');
    }

    return AuthTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
      tokenType: tokenType,
      expiresIn: expiresIn,
      refreshTokenExpiresIn: refreshTokenExpiresIn,
    );
  }
}
