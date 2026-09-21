import 'package:bowlingmanager_mobile/features/home/data/dashboard_api.dart';
import 'package:bowlingmanager_mobile/features/home/domain/dashboard.dart';

abstract interface class DashboardRepository {
  Future<Dashboard> fetchDashboard();
}

class MobileDashboardRepository implements DashboardRepository {
  MobileDashboardRepository(this._api);

  final DashboardApi _api;

  @override
  Future<Dashboard> fetchDashboard() => _api.fetchDashboard();
}
