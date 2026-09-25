import 'package:bowlingmanager_mobile/features/admin/data/super_admin_repository.dart';
import 'package:bowlingmanager_mobile/features/admin/domain/super_admin_team.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final Provider<SuperAdminRepository> superAdminRepositoryProvider =
    Provider<SuperAdminRepository>((Ref ref) {
      return MobileSuperAdminRepository(ref.watch(apiClientProvider).dio);
    });

final superAdminTeamsProvider = FutureProvider.autoDispose
    .family<List<SuperAdminTeam>, String>((Ref ref, String _) {
      return ref.watch(superAdminRepositoryProvider).fetchTeams();
    }, retry: (int retryCount, Object error) => null);
