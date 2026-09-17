import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageService {
  SecureStorageService({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  static const String accessTokenKey = 'accessToken';
  static const String refreshTokenKey = 'refreshToken';

  final FlutterSecureStorage _storage;

  Future<String?> readAccessToken() => _storage.read(key: accessTokenKey);

  Future<String?> readRefreshToken() => _storage.read(key: refreshTokenKey);

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: accessTokenKey, value: accessToken);
    await _storage.write(key: refreshTokenKey, value: refreshToken);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: accessTokenKey);
    await _storage.delete(key: refreshTokenKey);
  }
}
