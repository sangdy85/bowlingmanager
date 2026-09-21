import 'package:bowlingmanager_mobile/features/records/domain/score_record.dart';

const Object _unchanged = Object();

class RecordsState {
  const RecordsState({
    required this.items,
    required this.pagination,
    this.isLoadingMore = false,
    this.paginationErrorMessage,
    this.refreshErrorMessage,
  });

  final List<ScoreRecord> items;
  final ScorePagination pagination;
  final bool isLoadingMore;
  final String? paginationErrorMessage;
  final String? refreshErrorMessage;

  bool get hasNextPage => pagination.hasNextPage;

  RecordsState copyWith({
    List<ScoreRecord>? items,
    ScorePagination? pagination,
    bool? isLoadingMore,
    Object? paginationErrorMessage = _unchanged,
    Object? refreshErrorMessage = _unchanged,
  }) {
    return RecordsState(
      items: items ?? this.items,
      pagination: pagination ?? this.pagination,
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
