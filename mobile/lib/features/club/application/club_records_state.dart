import 'package:bowlingmanager_mobile/features/club/domain/club_records_models.dart';

const Object _unchanged = Object();

class ClubActivitiesState {
  const ClubActivitiesState({
    required this.items,
    required this.page,
    required this.totalPages,
    this.isLoadingMore = false,
    this.paginationErrorMessage,
    this.refreshErrorMessage,
  });

  final List<ClubActivity> items;
  final int page;
  final int totalPages;
  final bool isLoadingMore;
  final String? paginationErrorMessage;
  final String? refreshErrorMessage;

  bool get hasNextPage => page < totalPages;

  ClubActivitiesState copyWith({
    List<ClubActivity>? items,
    int? page,
    int? totalPages,
    bool? isLoadingMore,
    Object? paginationErrorMessage = _unchanged,
    Object? refreshErrorMessage = _unchanged,
  }) {
    return ClubActivitiesState(
      items: items ?? this.items,
      page: page ?? this.page,
      totalPages: totalPages ?? this.totalPages,
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
