import 'package:bowlingmanager_mobile/core/domain/game_session.dart';

class Dashboard {
  const Dashboard({
    required this.year,
    required this.average,
    required this.highScore,
    required this.gameCount,
    required this.recentScores,
    required this.recentSessions,
    required this.recentAverage,
  });

  final int year;
  final double average;
  final int highScore;
  final int gameCount;
  final List<DashboardScore> recentScores;
  final List<GameSession> recentSessions;
  final double recentAverage;

  factory Dashboard.fromJson(Map<String, dynamic> json) {
    final Object? year = json['year'];
    final Object? average = json['average'];
    final Object? highScore = json['highScore'];
    final Object? gameCount = json['gameCount'];
    final Object? recentScores = json['recentScores'];
    final Object? recentSessions = json['recentSessions'];
    final Object? recentAverage = json['recentAverage'];

    if (year is! int ||
        year < 1900 ||
        year > 2100 ||
        !_isValidAverage(average) ||
        highScore is! int ||
        gameCount is! int ||
        gameCount < 0 ||
        recentScores is! List ||
        recentScores.length > 10 ||
        recentSessions is! List ||
        recentSessions.length > 7 ||
        !_isValidAverage(recentAverage)) {
      throw const FormatException('Invalid dashboard response.');
    }

    final List<DashboardScore> scores = recentScores
        .map((Object? item) {
          if (item is! Map) {
            throw const FormatException('Invalid dashboard score response.');
          }
          return DashboardScore.fromJson(Map<String, dynamic>.from(item));
        })
        .toList(growable: false);
    final List<GameSession> sessions = recentSessions
        .map((Object? item) {
          if (item is! Map) {
            throw const FormatException('Invalid dashboard session response.');
          }
          return GameSession.fromJson(Map<String, dynamic>.from(item));
        })
        .toList(growable: false);

    return Dashboard(
      year: year,
      average: (average as num).toDouble(),
      highScore: highScore,
      gameCount: gameCount,
      recentScores: List<DashboardScore>.unmodifiable(scores),
      recentSessions: List<GameSession>.unmodifiable(sessions),
      recentAverage: (recentAverage as num).toDouble(),
    );
  }

  static bool _isValidAverage(Object? value) {
    return value is num && value.isFinite;
  }
}

class DashboardScore {
  const DashboardScore({
    required this.source,
    required this.id,
    required this.score,
    required this.gameDate,
    required this.gameType,
    required this.memo,
    required this.team,
  });

  final DashboardScoreSource source;
  final String id;
  final int score;
  final DateTime gameDate;
  final String? gameType;
  final String? memo;
  final DashboardTeam? team;

  factory DashboardScore.fromJson(Map<String, dynamic> json) {
    final Object? id = json['id'];
    final DashboardScoreSource source = DashboardScoreSource.fromJson(
      json['source'],
    );
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
        parsedGameDate == null ||
        (gameType != null && gameType is! String) ||
        (memo != null && memo is! String) ||
        (team != null && team is! Map)) {
      throw const FormatException('Invalid dashboard score response.');
    }

    return DashboardScore(
      source: source,
      id: id,
      score: score,
      gameDate: parsedGameDate,
      gameType: gameType as String?,
      memo: memo as String?,
      team: team == null
          ? null
          : DashboardTeam.fromJson(Map<String, dynamic>.from(team as Map)),
    );
  }
}

class DashboardTeam {
  const DashboardTeam({required this.id, required this.name});

  final String id;
  final String name;

  factory DashboardTeam.fromJson(Map<String, dynamic> json) {
    final Object? id = json['id'];
    final Object? name = json['name'];
    if (id is! String || id.isEmpty || name is! String) {
      throw const FormatException('Invalid dashboard team response.');
    }
    return DashboardTeam(id: id, name: name);
  }
}

// Unknown sources are rejected as malformed rather than mislabeled as personal.
enum DashboardScoreSource {
  personal('PERSONAL', '개인'),
  league('LEAGUE', '리그'),
  tournament('TOURNAMENT', '대회');

  const DashboardScoreSource(this.apiValue, this.label);
  final String apiValue;
  final String label;

  static DashboardScoreSource fromJson(Object? value) {
    for (final source in values) {
      if (value == source.apiValue) return source;
    }
    throw const FormatException('Invalid dashboard score source.');
  }
}
