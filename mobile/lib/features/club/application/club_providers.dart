import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_api.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_repository.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_records_state.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_records_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_management_models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

typedef ClubRequest = ({String userId, String teamId});
typedef ClubStatisticsRequest = ({
  String userId,
  String teamId,
  int year,
  ClubRecordFilter filter,
});
typedef ClubActivityRequest = ({
  String userId,
  String teamId,
  String activityId,
});
typedef ClubActivityFeedRequest = ({
  String userId,
  String teamId,
  int year,
  String typesKey,
});

const int clubActivitiesPageLimit = 20;
const int clubActivityFeedPageLimit = 10;

String clubActivityTypesKey(Iterable<ClubRecordFilter> filters) =>
    ClubRecordFilter.values
        .where(
          (ClubRecordFilter filter) =>
              filter != ClubRecordFilter.all && filters.contains(filter),
        )
        .map((ClubRecordFilter filter) => filter.apiValue)
        .join(',');

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

final clubStatisticsProvider = FutureProvider.autoDispose
    .family<ClubStatistics, ClubStatisticsRequest>((
      Ref ref,
      ClubStatisticsRequest request,
    ) {
      return ref
          .watch(clubRepositoryProvider)
          .fetchClubStatistics(
            teamId: request.teamId,
            year: request.year,
            filter: request.filter,
          );
    }, retry: (int retryCount, Object error) => null);

final clubActivitiesControllerProvider = AsyncNotifierProvider.autoDispose
    .family<
      ClubActivitiesController,
      ClubActivitiesState,
      ClubStatisticsRequest
    >(
      ClubActivitiesController.new,
      retry: (int retryCount, Object error) => null,
    );

final clubActivityFeedControllerProvider = AsyncNotifierProvider.autoDispose
    .family<
      ClubActivityFeedController,
      ClubActivityFeedState,
      ClubActivityFeedRequest
    >(
      ClubActivityFeedController.new,
      retry: (int retryCount, Object error) => null,
    );

final clubActivityProvider = FutureProvider.autoDispose
    .family<ClubActivityDetail, ClubActivityRequest>((
      Ref ref,
      ClubActivityRequest request,
    ) {
      return ref
          .watch(clubRepositoryProvider)
          .fetchClubActivity(
            teamId: request.teamId,
            activityId: request.activityId,
          );
    }, retry: (int retryCount, Object error) => null);

final clubActivityEditProvider = FutureProvider.autoDispose
    .family<ClubActivityEditEnvelope, ClubActivityRequest>((
      Ref ref,
      ClubActivityRequest request,
    ) {
      return ref
          .watch(clubRepositoryProvider)
          .fetchEditableActivity(
            teamId: request.teamId,
            activityId: request.activityId,
          );
    }, retry: (int retryCount, Object error) => null);

class ClubActivitiesController extends AsyncNotifier<ClubActivitiesState> {
  ClubActivitiesController(this.request);

  final ClubStatisticsRequest request;
  late ClubRepository _repository;

  @override
  Future<ClubActivitiesState> build() {
    _repository = ref.watch(clubRepositoryProvider);
    return _fetchPage(1);
  }

  Future<ClubActivitiesState> _fetchPage(int page) async {
    final ClubActivitiesPage result = await _repository.fetchClubActivities(
      teamId: request.teamId,
      year: request.year,
      filter: request.filter,
      page: page,
      limit: clubActivitiesPageLimit,
    );
    if (result.page != page ||
        result.year != request.year ||
        result.filter != request.filter) {
      throw ApiException.malformedResponse();
    }
    return ClubActivitiesState(
      items: result.items,
      page: result.page,
      totalPages: result.totalPages,
    );
  }

  Future<void> retryInitial() async {
    state = const AsyncLoading<ClubActivitiesState>();
    final AsyncValue<ClubActivitiesState> result = await AsyncValue.guard(
      () => _fetchPage(1),
    );
    if (ref.mounted) state = result;
  }

  Future<void> refreshActivities() async {
    final ClubActivitiesState? current = state.value;
    try {
      final ClubActivitiesState refreshed = await _fetchPage(1);
      if (ref.mounted) state = AsyncData<ClubActivitiesState>(refreshed);
    } on Object catch (error, stackTrace) {
      if (!ref.mounted) return;
      if (current == null) {
        state = AsyncError<ClubActivitiesState>(error, stackTrace);
      } else {
        state = AsyncData<ClubActivitiesState>(
          current.copyWith(
            refreshErrorMessage: clubErrorMessage(error),
            paginationErrorMessage: null,
            isLoadingMore: false,
          ),
        );
      }
    }
  }

  Future<void> loadNextPage() async {
    final ClubActivitiesState? current = state.value;
    if (current == null || current.isLoadingMore || !current.hasNextPage) {
      return;
    }
    state = AsyncData<ClubActivitiesState>(
      current.copyWith(
        isLoadingMore: true,
        paginationErrorMessage: null,
        refreshErrorMessage: null,
      ),
    );
    try {
      final int requestedPage = current.page + 1;
      final ClubActivitiesState next = await _fetchPage(requestedPage);
      if (!ref.mounted) return;
      final Set<String> ids = current.items
          .map((ClubActivity item) => item.id)
          .toSet();
      state = AsyncData<ClubActivitiesState>(
        ClubActivitiesState(
          items: List<ClubActivity>.unmodifiable(<ClubActivity>[
            ...current.items,
            ...next.items.where((ClubActivity item) => ids.add(item.id)),
          ]),
          page: next.page,
          totalPages: next.totalPages,
        ),
      );
    } on Object catch (error) {
      if (!ref.mounted) return;
      state = AsyncData<ClubActivitiesState>(
        current.copyWith(
          isLoadingMore: false,
          paginationErrorMessage: clubErrorMessage(error),
          refreshErrorMessage: null,
        ),
      );
    }
  }
}

class ClubActivityFeedController extends AsyncNotifier<ClubActivityFeedState> {
  ClubActivityFeedController(this.request);

  final ClubActivityFeedRequest request;
  late ClubRepository _repository;

  List<ClubRecordFilter> get _types => request.typesKey
      .split(',')
      .where((String value) => value.isNotEmpty)
      .map(ClubRecordFilter.fromJson)
      .where((ClubRecordFilter filter) => filter != ClubRecordFilter.all)
      .toList(growable: false);

  @override
  Future<ClubActivityFeedState> build() {
    _repository = ref.watch(clubRepositoryProvider);
    return _fetchPage(1);
  }

  Future<ClubActivityFeedState> _fetchPage(int page) async {
    final List<ClubRecordFilter> types = _types;
    if (types.isEmpty) {
      return const ClubActivityFeedState(
        items: <ClubActivityFeedItem>[],
        currentMemberId: null,
        page: 1,
        totalPages: 0,
      );
    }
    final ClubActivityFeedPage result = await _repository.fetchClubActivityFeed(
      teamId: request.teamId,
      year: request.year,
      types: types,
      page: page,
      limit: clubActivityFeedPageLimit,
    );
    if (result.page != page ||
        result.year != request.year ||
        clubActivityTypesKey(result.types) != request.typesKey) {
      throw ApiException.malformedResponse();
    }
    return ClubActivityFeedState(
      items: result.items,
      currentMemberId: result.currentMemberId,
      page: result.page,
      totalPages: result.totalPages,
    );
  }

  Future<void> retryInitial() async {
    state = const AsyncLoading<ClubActivityFeedState>();
    final AsyncValue<ClubActivityFeedState> result = await AsyncValue.guard(
      () => _fetchPage(1),
    );
    if (ref.mounted) state = result;
  }

  Future<void> refreshActivities() async {
    final ClubActivityFeedState? current = state.value;
    try {
      final ClubActivityFeedState refreshed = await _fetchPage(1);
      if (ref.mounted) state = AsyncData<ClubActivityFeedState>(refreshed);
    } on Object catch (error, stackTrace) {
      if (!ref.mounted) return;
      if (current == null) {
        state = AsyncError<ClubActivityFeedState>(error, stackTrace);
      } else {
        state = AsyncData<ClubActivityFeedState>(
          current.copyWith(
            refreshErrorMessage: clubErrorMessage(error),
            paginationErrorMessage: null,
            isLoadingMore: false,
          ),
        );
      }
    }
  }

  Future<void> loadNextPage() async {
    final ClubActivityFeedState? current = state.value;
    if (current == null || current.isLoadingMore || !current.hasNextPage) {
      return;
    }
    state = AsyncData<ClubActivityFeedState>(
      current.copyWith(
        isLoadingMore: true,
        paginationErrorMessage: null,
        refreshErrorMessage: null,
      ),
    );
    try {
      final ClubActivityFeedState next = await _fetchPage(current.page + 1);
      if (!ref.mounted) return;
      final Set<String> ids = current.items
          .map((ClubActivityFeedItem item) => item.id)
          .toSet();
      state = AsyncData<ClubActivityFeedState>(
        ClubActivityFeedState(
          items: List<ClubActivityFeedItem>.unmodifiable(<ClubActivityFeedItem>[
            ...current.items,
            ...next.items.where(
              (ClubActivityFeedItem item) => ids.add(item.id),
            ),
          ]),
          currentMemberId: next.currentMemberId ?? current.currentMemberId,
          page: next.page,
          totalPages: next.totalPages,
        ),
      );
    } on Object catch (error) {
      if (!ref.mounted) return;
      state = AsyncData<ClubActivityFeedState>(
        current.copyWith(
          isLoadingMore: false,
          paginationErrorMessage: clubErrorMessage(error),
          refreshErrorMessage: null,
        ),
      );
    }
  }
}

String clubErrorMessage(Object error) {
  if (error is ApiException) return error.userMessage;
  return '동호회 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
}
