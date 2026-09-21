import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/records/data/scores_repository.dart';
import 'package:bowlingmanager_mobile/features/records/domain/score_record.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/records_fakes.dart';

void main() {
  test('MobileScoresRepository forwards pagination and result', () async {
    final FakeScoresApi api = FakeScoresApi();
    final MobileScoresRepository repository = MobileScoresRepository(api);

    final ScoresPage page = await repository.fetchScores(page: 2, limit: 20);

    expect(page, same(testScoresPage));
    expect(api.requestedPage, 2);
    expect(api.requestedLimit, 20);
  });

  test('MobileScoresRepository propagates API errors', () async {
    final FakeScoresApi api = FakeScoresApi()
      ..error = const ApiException(
        kind: ApiErrorKind.networkUnavailable,
        userMessage: '네트워크 연결을 확인해주세요.',
      );
    final MobileScoresRepository repository = MobileScoresRepository(api);

    await expectLater(
      repository.fetchScores(page: 1, limit: 20),
      throwsA(isA<ApiException>()),
    );
  });
}
