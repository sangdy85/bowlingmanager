import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/core/domain/game_session.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/records/application/records_state.dart';
import 'package:bowlingmanager_mobile/features/records/data/scores_api.dart';
import 'package:bowlingmanager_mobile/features/records/data/scores_repository.dart';
import 'package:bowlingmanager_mobile/features/records/domain/score_record.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

const int recordsPageLimit = 20;

final Provider<ScoresApi> scoresApiProvider = Provider<ScoresApi>(
  (Ref ref) => MobileScoresApi(ref.watch(apiClientProvider).dio),
);

final Provider<ScoresRepository> scoresRepositoryProvider =
    Provider<ScoresRepository>((Ref ref) {
      return MobileScoresRepository(ref.watch(scoresApiProvider));
    });

final recordsControllerProvider = AsyncNotifierProvider.autoDispose
    .family<RecordsController, RecordsState, String>(
      RecordsController.new,
      retry: (int retryCount, Object error) => null,
    );

class RecordsController extends AsyncNotifier<RecordsState> {
  RecordsController(this.userId);

  final String userId;
  late ScoresRepository _repository;
  RecordsFilter _filter = const RecordsFilter();

  @override
  Future<RecordsState> build() {
    _repository = ref.watch(scoresRepositoryProvider);
    return _fetchFirstPage();
  }

  Future<RecordsState> _fetchFirstPage() async {
    final ScoresPage page = await _repository.fetchScores(
      page: 1,
      limit: recordsPageLimit,
      filter: _filter,
    );
    return RecordsState(
      items: page.items,
      pagination: page.pagination,
      filter: _filter,
      availableYears: page.availableYears,
    );
  }

  Future<void> applyFilter(RecordsFilter filter) async {
    _filter = filter;
    state = const AsyncLoading<RecordsState>();
    final AsyncValue<RecordsState> nextState = await AsyncValue.guard(
      _fetchFirstPage,
    );
    if (!ref.mounted) return;
    state = nextState;
  }

  Future<void> retryInitial() async {
    state = const AsyncLoading<RecordsState>();
    final AsyncValue<RecordsState> nextState = await AsyncValue.guard(
      _fetchFirstPage,
    );
    if (!ref.mounted) return;
    state = nextState;
  }

  Future<void> refreshRecords() async {
    final RecordsState? current = state.value;
    try {
      final RecordsState refreshed = await _fetchFirstPage();
      if (!ref.mounted) return;
      state = AsyncData<RecordsState>(refreshed);
    } on Object catch (error, stackTrace) {
      if (!ref.mounted) return;
      if (current == null) {
        state = AsyncError<RecordsState>(error, stackTrace);
        return;
      }
      state = AsyncData<RecordsState>(
        current.copyWith(
          isLoadingMore: false,
          paginationErrorMessage: null,
          refreshErrorMessage: recordsErrorMessage(error),
        ),
      );
    }
  }

  Future<void> loadNextPage() async {
    final RecordsState? current = state.value;
    if (current == null || current.isLoadingMore || !current.hasNextPage) {
      return;
    }

    state = AsyncData<RecordsState>(
      current.copyWith(
        isLoadingMore: true,
        paginationErrorMessage: null,
        refreshErrorMessage: null,
      ),
    );

    try {
      final int requestedPage = current.pagination.page + 1;
      final ScoresPage nextPage = await _repository.fetchScores(
        page: requestedPage,
        limit: recordsPageLimit,
        filter: _filter,
      );
      if (!ref.mounted) return;
      if (nextPage.pagination.page != requestedPage) {
        throw ApiException.malformedResponse();
      }

      final Set<String> existingIds = current.items
          .map((GameSession item) => item.id)
          .toSet();
      final List<GameSession> uniqueItems = nextPage.items
          .where((GameSession item) => existingIds.add(item.id))
          .toList(growable: false);
      state = AsyncData<RecordsState>(
        RecordsState(
          items: List<GameSession>.unmodifiable(<GameSession>[
            ...current.items,
            ...uniqueItems,
          ]),
          pagination: nextPage.pagination,
          filter: _filter,
          availableYears: nextPage.availableYears.isEmpty
              ? current.availableYears
              : nextPage.availableYears,
        ),
      );
    } on Object catch (error) {
      if (!ref.mounted) return;
      state = AsyncData<RecordsState>(
        current.copyWith(
          isLoadingMore: false,
          paginationErrorMessage: recordsErrorMessage(error),
          refreshErrorMessage: null,
        ),
      );
    }
  }
}

String recordsErrorMessage(Object error) {
  if (error is ApiException) return error.userMessage;
  return '기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
}
