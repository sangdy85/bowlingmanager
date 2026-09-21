import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Map<String, dynamic> userJson(Object? handicap) => <String, dynamic>{
    'id': 'user-1',
    'email': 'user@example.com',
    'name': '테스트 볼러',
    'role': 'USER',
    'handicap': handicap,
  };

  test('AuthUser.fromJson accepts a null handicap', () {
    final AuthUser user = AuthUser.fromJson(userJson(null));

    expect(user.handicap, isNull);
  });

  test('AuthUser.fromJson accepts an integer handicap', () {
    final AuthUser user = AuthUser.fromJson(userJson(10));

    expect(user.handicap, 10);
  });

  test('AuthUser.fromJson rejects invalid handicap types', () {
    for (final Object invalidHandicap in <Object>['10', 10.0, true]) {
      expect(
        () => AuthUser.fromJson(userJson(invalidHandicap)),
        throwsA(isA<FormatException>()),
        reason: 'Unexpectedly accepted ${invalidHandicap.runtimeType}',
      );
    }
  });
}
