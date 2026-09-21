import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/home/data/dashboard_repository.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/dashboard_fakes.dart';

void main() {
  test('MobileDashboardRepository returns the API dashboard', () async {
    final FakeDashboardApi api = FakeDashboardApi();
    final MobileDashboardRepository repository = MobileDashboardRepository(api);

    final dashboard = await repository.fetchDashboard();

    expect(dashboard, same(testDashboard));
    expect(api.callCount, 1);
  });

  test('MobileDashboardRepository propagates API errors', () async {
    final FakeDashboardApi api = FakeDashboardApi()
      ..error = const ApiException(
        kind: ApiErrorKind.networkUnavailable,
        userMessage: '네트워크 연결을 확인해주세요.',
      );
    final MobileDashboardRepository repository = MobileDashboardRepository(api);

    await expectLater(
      repository.fetchDashboard(),
      throwsA(isA<ApiException>()),
    );
    expect(api.callCount, 1);
  });
}
