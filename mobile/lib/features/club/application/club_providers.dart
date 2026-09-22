import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_api.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_repository.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

typedef ClubRequest = ({String userId, String teamId});

final Provider<ClubApi> clubApiProvider = Provider<ClubApi>(
  (Ref ref) => MobileClubApi(ref.watch(apiClientProvider).dio),
);

final Provider<ClubRepository> clubRepositoryProvider =
    Provider<ClubRepository>((Ref ref) {
      return MobileClubRepository(ref.watch(clubApiProvider));
    });

final clubListProvider = FutureProvider.autoDispose
    .family<List<ClubSummary>, String>((Ref ref, String _) {
      return ref.watch(clubRepositoryProvider).fetchClubs();
    }, retry: (int retryCount, Object error) => null);

final clubDetailProvider = FutureProvider.autoDispose
    .family<ClubDetail, ClubRequest>((Ref ref, ClubRequest request) {
      return ref.watch(clubRepositoryProvider).fetchClubDetail(request.teamId);
    }, retry: (int retryCount, Object error) => null);

final clubMembersProvider = FutureProvider.autoDispose
    .family<List<ClubMember>, ClubRequest>((Ref ref, ClubRequest request) {
      return ref.watch(clubRepositoryProvider).fetchClubMembers(request.teamId);
    }, retry: (int retryCount, Object error) => null);

String clubErrorMessage(Object error) {
  if (error is ApiException) return error.userMessage;
  return '동호회 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
}
