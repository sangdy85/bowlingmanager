class ScoreRecord {
  const ScoreRecord({
    required this.id,
    required this.score,
    required this.gameDate,
    required this.gameType,
    required this.memo,
    required this.team,
  });

  final String id;
  final int score;
  final DateTime gameDate;
  final String? gameType;
  final String? memo;
  final ScoreTeam? team;

  factory ScoreRecord.fromJson(Map<String, dynamic> json) {
    final Object? id = json['id'];
    final Object? score = json['score'];
    final Object? gameDate = json['gameDate'];
    final Object? gameType = json['gameType'];
    final Object? memo = json['memo'];
    final Object? team = json['team'];
    final DateTime? parsedGameDate = gameDate is String
        ? DateTime.tryParse(gameDate)
        : null;

    if (id is! String ||
        id.isEmpty ||
        score is! int ||
        score < 0 ||
        score > 300 ||
        parsedGameDate == null ||
        (gameType != null && gameType is! String) ||
        (memo != null && memo is! String) ||
        (team != null && team is! Map)) {
      throw const FormatException('Invalid score record response.');
    }

    return ScoreRecord(
      id: id,
      score: score,
      gameDate: parsedGameDate,
      gameType: gameType as String?,
      memo: memo as String?,
      team: team == null
          ? null
          : ScoreTeam.fromJson(Map<String, dynamic>.from(team as Map)),
    );
  }
}

class ScoreTeam {
  const ScoreTeam({required this.id, required this.name});

  final String id;
  final String name;

  factory ScoreTeam.fromJson(Map<String, dynamic> json) {
    final Object? id = json['id'];
    final Object? name = json['name'];
    if (id is! String || id.isEmpty || name is! String) {
      throw const FormatException('Invalid score team response.');
    }
    return ScoreTeam(id: id, name: name);
  }
}

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

  final List<ScoreRecord> items;
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
    final List<ScoreRecord> parsedItems = items
        .map((Object? item) {
          if (item is! Map) {
            throw const FormatException('Invalid score record response.');
          }
          return ScoreRecord.fromJson(Map<String, dynamic>.from(item));
        })
        .toList(growable: false);

    if (parsedItems.length > parsedPagination.limit) {
      throw const FormatException('Invalid scores response.');
    }

    return ScoresPage(
      items: List<ScoreRecord>.unmodifiable(parsedItems),
      pagination: parsedPagination,
    );
  }
}
