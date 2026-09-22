import 'package:bowlingmanager_mobile/core/domain/game_session.dart';

class ScorePagination {
  const ScorePagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;

  bool get hasNextPage => page < totalPages;

  factory ScorePagination.fromJson(Map<String, dynamic> json) {
    final Object? page = json['page'];
    final Object? limit = json['limit'];
    final Object? total = json['total'];
    final Object? totalPages = json['totalPages'];

    if (page is! int ||
        page < 1 ||
        limit is! int ||
        limit < 1 ||
        limit > 100 ||
        total is! int ||
        total < 0 ||
        totalPages is! int ||
        totalPages < 0 ||
        totalPages != (total / limit).ceil()) {
      throw const FormatException('Invalid score pagination response.');
    }
    return ScorePagination(
      page: page,
      limit: limit,
      total: total,
      totalPages: totalPages,
    );
  }
}

class ScoresPage {
  const ScoresPage({required this.items, required this.pagination});

  final List<GameSession> items;
  final ScorePagination pagination;

  factory ScoresPage.fromJson(Map<String, dynamic> json) {
    final Object? items = json['items'];
    final Object? pagination = json['pagination'];
    if (items is! List || pagination is! Map) {
      throw const FormatException('Invalid scores response.');
    }

    final ScorePagination parsedPagination = ScorePagination.fromJson(
      Map<String, dynamic>.from(pagination),
    );
    final List<GameSession> parsedItems = items
        .map((Object? item) {
          if (item is! Map) {
            throw const FormatException('Invalid game session response.');
          }
          return GameSession.fromJson(
            Map<String, dynamic>.from(item),
            enforceScoreRange: true,
          );
        })
        .toList(growable: false);

    if (parsedItems.length > parsedPagination.limit) {
      throw const FormatException('Invalid scores response.');
    }
    return ScoresPage(
      items: List<GameSession>.unmodifiable(parsedItems),
      pagination: parsedPagination,
    );
  }
}
