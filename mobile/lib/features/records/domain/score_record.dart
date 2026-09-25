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
  const ScoresPage({
    required this.items,
    required this.pagination,
    this.availableYears = const <int>[],
  });

  final List<GameSession> items;
  final ScorePagination pagination;
  final List<int> availableYears;

  factory ScoresPage.fromJson(Map<String, dynamic> json) {
    final Object? items = json['items'];
    final Object? pagination = json['pagination'];
    final Object? availableYears = json['availableYears'] ?? <Object>[];
    if (items is! List ||
        pagination is! Map ||
        availableYears is! List ||
        availableYears.any(
          (year) => year is! int || year < 1900 || year > 2100,
        )) {
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
          return GameSession.fromJson(Map<String, dynamic>.from(item));
        })
        .toList(growable: false);

    if (parsedItems.length > parsedPagination.limit) {
      throw const FormatException('Invalid scores response.');
    }
    return ScoresPage(
      items: List<GameSession>.unmodifiable(parsedItems),
      pagination: parsedPagination,
      availableYears: List<int>.unmodifiable(availableYears.cast<int>()),
    );
  }
}

enum RecordCategory {
  all('ALL', '전체'),
  regular('REGULAR', '정기전'),
  meetup('MEETUP', '벙개'),
  exchange('EXCHANGE', '교류전'),
  official('OFFICIAL', '볼링장 공식'),
  other('OTHER', '기타');

  const RecordCategory(this.apiValue, this.label);
  final String apiValue;
  final String label;
}

enum OfficialRecordCategory {
  all('ALL', '전체'),
  standingLeague('STANDING_LEAGUE', '상주리그'),
  championship('CHAMPIONSHIP', '챔프전'),
  event('EVENT', '이벤트전');

  const OfficialRecordCategory(this.apiValue, this.label);
  final String apiValue;
  final String label;
}

class RecordsFilter {
  const RecordsFilter({
    this.year,
    this.category = RecordCategory.all,
    this.officialCategory = OfficialRecordCategory.all,
    this.minAverage,
    this.maxAverage,
  });

  final int? year;
  final RecordCategory category;
  final OfficialRecordCategory officialCategory;
  final double? minAverage;
  final double? maxAverage;

  Map<String, Object> toQuery() => <String, Object>{
    'year': ?year,
    'category': category.apiValue,
    if (category == RecordCategory.official)
      'officialType': officialCategory.apiValue,
    'minAverage': ?minAverage,
    'maxAverage': ?maxAverage,
  };

  RecordsFilter copyWith({
    int? year,
    bool clearYear = false,
    RecordCategory? category,
    OfficialRecordCategory? officialCategory,
    double? minAverage,
    bool clearMinAverage = false,
    double? maxAverage,
    bool clearMaxAverage = false,
  }) => RecordsFilter(
    year: clearYear ? null : year ?? this.year,
    category: category ?? this.category,
    officialCategory: category != null && category != RecordCategory.official
        ? OfficialRecordCategory.all
        : officialCategory ?? this.officialCategory,
    minAverage: clearMinAverage ? null : minAverage ?? this.minAverage,
    maxAverage: clearMaxAverage ? null : maxAverage ?? this.maxAverage,
  );
}
