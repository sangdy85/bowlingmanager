import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/home/data/dashboard_api.dart';
import 'package:bowlingmanager_mobile/features/home/data/dashboard_repository.dart';
import 'package:bowlingmanager_mobile/features/home/domain/dashboard.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final Provider<DashboardApi> dashboardApiProvider = Provider<DashboardApi>(
  (Ref ref) => MobileDashboardApi(ref.watch(apiClientProvider).dio),
);

final Provider<DashboardRepository> dashboardRepositoryProvider =
    Provider<DashboardRepository>((Ref ref) {
      return MobileDashboardRepository(ref.watch(dashboardApiProvider));
    });

final dashboardProvider = FutureProvider.autoDispose.family<Dashboard, String>((
  Ref ref,
  String _,
) {
  return ref.watch(dashboardRepositoryProvider).fetchDashboard();
}, retry: (int retryCount, Object error) => null);
