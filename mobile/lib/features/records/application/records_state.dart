import 'package:bowlingmanager_mobile/core/domain/game_session.dart';
import 'package:bowlingmanager_mobile/features/records/domain/score_record.dart';

const Object _unchanged = Object();

class RecordsState {
  const RecordsState({
    required this.items,
    required this.pagination,
    this.filter = const RecordsFilter(),
    this.availableYears = const <int>[],
    this.isLoadingMore = false,
    this.paginationErrorMessage,
    this.refreshErrorMessage,
  });

  final List<GameSession> items;
  final ScorePagination pagination;
  final RecordsFilter filter;
  final List<int> availableYears;
  final bool isLoadingMore;
  final String? paginationErrorMessage;
  final String? refreshErrorMessage;

  bool get hasNextPage => pagination.hasNextPage;

  RecordsState copyWith({
    List<GameSession>? items,
    ScorePagination? pagination,
    RecordsFilter? filter,
    List<int>? availableYears,
    bool? isLoadingMore,
    Object? paginationErrorMessage = _unchanged,
    Object? refreshErrorMessage = _unchanged,
  }) {
    return RecordsState(
      items: items ?? this.items,
      pagination: pagination ?? this.pagination,
      filter: filter ?? this.filter,
      availableYears: availableYears ?? this.availableYears,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      paginationErrorMessage: identical(paginationErrorMessage, _unchanged)
          ? this.paginationErrorMessage
          : paginationErrorMessage as String?,
      refreshErrorMessage: identical(refreshErrorMessage, _unchanged)
          ? this.refreshErrorMessage
          : refreshErrorMessage as String?,
    );
  }
}
