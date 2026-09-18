import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract interface class TokenStorage {
  Future<String?> readAccessToken();

  Future<String?> readRefreshToken();

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  });

  Future<void> clearTokens();
}

class SecureStorageService implements TokenStorage {
  SecureStorageService({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  static const String _tokenPairKey = 'mobileAuthTokenPair';

  final FlutterSecureStorage _storage;

  @override
  Future<String?> readAccessToken() async => (await _readTokenPair())?.$1;

  @override
  Future<String?> readRefreshToken() async => (await _readTokenPair())?.$2;

  @override
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    final String encoded = jsonEncode(<String, String>{
      'accessToken': accessToken,
      'refreshToken': refreshToken,
    });
    await _storage.write(key: _tokenPairKey, value: encoded);
  }

  @override
  Future<void> clearTokens() async {
    await _storage.delete(key: _tokenPairKey);
  }

  Future<(String, String)?> _readTokenPair() async {
    final String? encoded = await _storage.read(key: _tokenPairKey);
    if (encoded == null || encoded.isEmpty) return null;

    try {
      final Object? decoded = jsonDecode(encoded);
      if (decoded is! Map) return null;
      final Object? accessToken = decoded['accessToken'];
      final Object? refreshToken = decoded['refreshToken'];
      if (accessToken is! String ||
          accessToken.isEmpty ||
          refreshToken is! String ||
          refreshToken.isEmpty) {
        return null;
      }
      return (accessToken, refreshToken);
    } on FormatException {
      return null;
    }
  }
}
