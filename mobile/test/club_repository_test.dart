import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_repository.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/club_fakes.dart';

void main() {
  test('repository delegates list, detail and member requests', () async {
    final FakeClubApi api = FakeClubApi();
    final MobileClubRepository repository = MobileClubRepository(api);

    expect(await repository.fetchClubs(), <Object>[testClub]);
    expect(await repository.fetchClubDetail('team-1'), testClubDetail);
    expect(await repository.fetchClubMembers('team-1'), testClubMembers);
  });

  test('repository propagates API errors', () async {
    final FakeClubApi api = FakeClubApi()
      ..error = const ApiException(
        kind: ApiErrorKind.networkUnavailable,
        userMessage: '네트워크 연결을 확인해주세요.',
      );
    final MobileClubRepository repository = MobileClubRepository(api);

    await expectLater(repository.fetchClubs(), throwsA(isA<ApiException>()));
  });
}
