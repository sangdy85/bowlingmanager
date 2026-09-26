class GameSession {
  const GameSession({
    required this.id,
    required this.source,
    required this.gameDate,
    required this.gameType,
    required this.team,
    required this.scores,
    required this.total,
    required this.average,
    required this.gameCount,
    this.rank,
    this.activityId,
  });

  final String id;
  final GameSessionSource source;
  final DateTime gameDate;
  final String? gameType;
  final GameSessionTeam? team;
  final List<GameSessionScore> scores;
  final int total;
  final double average;
  final int gameCount;
  final GameSessionRank? rank;
  final String? activityId;

  factory GameSession.fromJson(
    Map<String, dynamic> json, {
    bool enforceScoreRange = false,
  }) {
    final Object? id = json['id'];
    final GameSessionSource source = GameSessionSource.fromJson(json['source']);
    final Object? gameDate = json['gameDate'];
    final Object? gameType = json['gameType'];
    final Object? team = json['team'];
    final Object? scores = json['scores'];
    final Object? total = json['total'];
    final Object? average = json['average'];
    final Object? gameCount = json['gameCount'];
    final Object? rank = json['rank'];
    final Object? activityId = json['activityId'];
    final DateTime? parsedDate = gameDate is String
        ? DateTime.tryParse(gameDate)
        : null;

    if (id is! String ||
        id.isEmpty ||
        parsedDate == null ||
        (gameType != null && gameType is! String) ||
        (team != null && team is! Map) ||
        scores is! List ||
        scores.isEmpty ||
        total is! int ||
        average is! num ||
        !average.isFinite ||
        gameCount is! int ||
        gameCount != scores.length ||
        (rank != null && rank is! Map) ||
        (activityId != null && (activityId is! String || activityId.isEmpty))) {
      throw const FormatException('Invalid game session response.');
    }

    final List<GameSessionScore> parsedScores = scores
        .map((Object? value) {
          if (value is! Map) {
            throw const FormatException('Invalid game session score response.');
          }
          return GameSessionScore.fromJson(
            Map<String, dynamic>.from(value),
            enforceScoreRange: enforceScoreRange,
          );
        })
        .toList(growable: false);
    final int calculatedTotal = parsedScores.fold<int>(
      0,
      (int sum, GameSessionScore item) => sum + item.score,
    );
    final double calculatedAverage = double.parse(
      (calculatedTotal / parsedScores.length).toStringAsFixed(1),
    );
    if (total != calculatedTotal || average.toDouble() != calculatedAverage) {
      throw const FormatException('Invalid game session summary.');
    }

    return GameSession(
      id: id,
      source: source,
      gameDate: parsedDate,
      gameType: gameType as String?,
      team: team == null
          ? null
          : GameSessionTeam.fromJson(Map<String, dynamic>.from(team as Map)),
      scores: List<GameSessionScore>.unmodifiable(parsedScores),
      total: total,
      average: average.toDouble(),
      gameCount: gameCount,
      rank: rank == null
          ? null
          : GameSessionRank.fromJson(Map<String, dynamic>.from(rank as Map)),
      activityId: activityId as String?,
    );
  }
}

class GameSessionRank {
  const GameSessionRank({
    required this.position,
    required this.participantCount,
  });

  final int position;
  final int participantCount;

  factory GameSessionRank.fromJson(Map<String, dynamic> json) {
    final Object? position = json['position'];
    final Object? participantCount = json['participantCount'];
    if (position is! int ||
        position < 1 ||
        participantCount is! int ||
        participantCount < 1 ||
        position > participantCount) {
      throw const FormatException('Invalid game session rank response.');
    }
    return GameSessionRank(
      position: position,
      participantCount: participantCount,
    );
  }
}

class GameSessionScore {
  const GameSessionScore({
    required this.id,
    required this.score,
    required this.memo,
  });

  final String id;
  final int score;
  final String? memo;

  factory GameSessionScore.fromJson(
    Map<String, dynamic> json, {
    bool enforceScoreRange = false,
  }) {
    final Object? id = json['id'];
    final Object? score = json['score'];
    final Object? memo = json['memo'];
    if (id is! String ||
        id.isEmpty ||
        score is! int ||
        score < 0 ||
        (enforceScoreRange && score > 300) ||
        (memo != null && memo is! String)) {
      throw const FormatException('Invalid game session score response.');
    }
    return GameSessionScore(id: id, score: score, memo: memo as String?);
  }
}

class GameSessionTeam {
  const GameSessionTeam({required this.id, required this.name});

  final String id;
  final String name;

  factory GameSessionTeam.fromJson(Map<String, dynamic> json) {
    final Object? id = json['id'];
    final Object? name = json['name'];
    if (id is! String || id.isEmpty || name is! String) {
      throw const FormatException('Invalid game session team response.');
    }
    return GameSessionTeam(id: id, name: name);
  }
}

enum GameSessionSource {
  personal('PERSONAL', '개인'),
  league('LEAGUE', '리그'),
  tournament('TOURNAMENT', '대회');

  const GameSessionSource(this.apiValue, this.label);
  final String apiValue;
  final String label;

  static GameSessionSource fromJson(Object? value) {
    for (final GameSessionSource source in values) {
      if (value == source.apiValue) return source;
    }
    throw const FormatException('Invalid game session source.');
  }
}

String? clubActivityRouteForSession(GameSession session) {
  final team = session.team;
  final activityId = session.activityId;
  if (team == null || activityId == null) return null;
  final match = RegExp(r'^(\d{4})-\d{2}-\d{2}~([A-Z]+)$')
      .firstMatch(activityId);
  if (match == null) return null;
  return Uri(
    path: '/club/${Uri.encodeComponent(team.id)}/records',
    queryParameters: <String, String>{
      'section': 'activities',
      'year': match.group(1)!,
      'type': match.group(2)!,
      'target': activityId,
    },
  ).toString();
}
