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
    this.regularAverage = 0,
    this.officialAverage = 0,
    int? totalGameCount,
    this.profileRadar = DashboardRadar.empty,
    this.medals = DashboardMedals.empty,
    this.personalStats = DashboardPersonalStats.empty,
    this.teamSummaries = const <DashboardTeamSummary>[],
    this.clubAchievements = const <DashboardClubAchievement>[],
  }) : totalGameCount = totalGameCount ?? gameCount;

  final int year;
  final double average;
  final int highScore;
  final int gameCount;
  final List<DashboardScore> recentScores;
  final List<GameSession> recentSessions;
  final double recentAverage;
  final double regularAverage;
  final double officialAverage;
  final int totalGameCount;
  final DashboardRadar profileRadar;
  final DashboardMedals medals;
  final DashboardPersonalStats personalStats;
  final List<DashboardTeamSummary> teamSummaries;
  final List<DashboardClubAchievement> clubAchievements;

  factory Dashboard.fromJson(Map<String, dynamic> json) {
    final Object? year = json['year'];
    final Object? average = json['average'];
    final Object? highScore = json['highScore'];
    final Object? gameCount = json['gameCount'];
    final Object? recentScores = json['recentScores'];
    final Object? recentSessions = json['recentSessions'];
    final Object? recentAverage = json['recentAverage'];
    final Object? regularAverage = json['regularAverage'];
    final Object? officialAverage = json['officialAverage'];
    final Object? totalGameCount = json['totalGameCount'];

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
        !_isValidAverage(recentAverage) ||
        (regularAverage != null && !_isValidAverage(regularAverage)) ||
        (officialAverage != null && !_isValidAverage(officialAverage)) ||
        (totalGameCount != null &&
            (totalGameCount is! int || totalGameCount < 0))) {
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
      regularAverage: (regularAverage as num?)?.toDouble() ?? 0,
      officialAverage: (officialAverage as num?)?.toDouble() ?? 0,
      totalGameCount: totalGameCount as int? ?? gameCount,
      profileRadar: _optionalSection(
        json['profileRadar'],
        DashboardRadar.fromJson,
        DashboardRadar.empty,
      ),
      medals: _optionalSection(
        json['medals'],
        DashboardMedals.fromJson,
        DashboardMedals.empty,
      ),
      personalStats: _optionalSection(
        json['personalStats'],
        DashboardPersonalStats.fromJson,
        DashboardPersonalStats.empty,
      ),
      teamSummaries: _optionalList(
        json['teamSummaries'],
        DashboardTeamSummary.fromJson,
      ),
      clubAchievements: _optionalList(
        json['clubAchievements'],
        DashboardClubAchievement.fromJson,
      ),
    );
  }

  static bool _isValidAverage(Object? value) {
    return value is num && value.isFinite;
  }

  static T _optionalSection<T>(
    Object? value,
    T Function(Map<String, dynamic>) parse,
    T fallback,
  ) {
    if (value is! Map) return fallback;
    try {
      return parse(Map<String, dynamic>.from(value));
    } on FormatException {
      return fallback;
    }
  }

  static List<T> _optionalList<T>(
    Object? value,
    T Function(Map<String, dynamic>) parse,
  ) {
    if (value is! List) return <T>[];
    try {
      return List<T>.unmodifiable(
        value.map((Object? item) {
          if (item is! Map) {
            throw const FormatException('Invalid optional list.');
          }
          return parse(Map<String, dynamic>.from(item));
        }),
      );
    } on FormatException {
      return <T>[];
    }
  }
}

class DashboardRadar {
  const DashboardRadar({required this.axes, required this.series});

  static const DashboardRadar empty = DashboardRadar(
    axes: <DashboardRadarAxis>[],
    series: <DashboardRadarSeries>[],
  );

  final List<DashboardRadarAxis> axes;
  final List<DashboardRadarSeries> series;

  factory DashboardRadar.fromJson(Map<String, dynamic> json) {
    final Object? axes = json['axes'];
    final Object? series = json['series'];
    if (axes is! List || axes.length != 5 || series is! List) {
      throw const FormatException('Invalid dashboard radar response.');
    }
    final parsedAxes = axes
        .map((Object? item) {
          if (item is! Map) throw const FormatException('Invalid radar axis.');
          return DashboardRadarAxis.fromJson(Map<String, dynamic>.from(item));
        })
        .toList(growable: false);
    final parsedSeries = series
        .map((Object? item) {
          if (item is! Map) {
            throw const FormatException('Invalid radar series.');
          }
          return DashboardRadarSeries.fromJson(
            Map<String, dynamic>.from(item),
            parsedAxes.length,
          );
        })
        .toList(growable: false);
    return DashboardRadar(
      axes: List<DashboardRadarAxis>.unmodifiable(parsedAxes),
      series: List<DashboardRadarSeries>.unmodifiable(parsedSeries),
    );
  }
}

class DashboardRadarAxis {
  const DashboardRadarAxis({required this.key, required this.label});
  final String key;
  final String label;

  factory DashboardRadarAxis.fromJson(Map<String, dynamic> json) {
    final Object? key = json['key'];
    final Object? label = json['label'];
    if (key is! String || key.isEmpty || label is! String || label.isEmpty) {
      throw const FormatException('Invalid radar axis.');
    }
    return DashboardRadarAxis(key: key, label: label);
  }
}

class DashboardRadarSeries {
  const DashboardRadarSeries({
    required this.key,
    required this.label,
    required this.color,
    required this.values,
  });
  final String key;
  final String label;
  final String color;
  final List<double> values;

  factory DashboardRadarSeries.fromJson(
    Map<String, dynamic> json,
    int axisCount,
  ) {
    final Object? key = json['key'];
    final Object? label = json['label'];
    final Object? color = json['color'];
    final Object? values = json['values'];
    if (key is! String ||
        key.isEmpty ||
        label is! String ||
        label.isEmpty ||
        color is! String ||
        !RegExp(r'^#[0-9A-Fa-f]{6}$').hasMatch(color) ||
        values is! List ||
        values.length != axisCount ||
        values.any(
          (Object? value) =>
              value is! num || !value.isFinite || value < 0 || value > 10,
        )) {
      throw const FormatException('Invalid radar series.');
    }
    return DashboardRadarSeries(
      key: key,
      label: label,
      color: color,
      values: List<double>.unmodifiable(
        values.map((Object? value) => (value as num).toDouble()),
      ),
    );
  }
}

class DashboardMedals {
  const DashboardMedals({
    required this.goldCount,
    required this.silverCount,
    required this.bronzeCount,
  });
  static const DashboardMedals empty = DashboardMedals(
    goldCount: 0,
    silverCount: 0,
    bronzeCount: 0,
  );
  final int goldCount;
  final int silverCount;
  final int bronzeCount;

  factory DashboardMedals.fromJson(Map<String, dynamic> json) {
    final values = <Object?>[
      json['goldCount'],
      json['silverCount'],
      json['bronzeCount'],
    ];
    if (values.any((value) => value is! int || value < 0)) {
      throw const FormatException('Invalid dashboard medals response.');
    }
    return DashboardMedals(
      goldCount: values[0]! as int,
      silverCount: values[1]! as int,
      bronzeCount: values[2]! as int,
    );
  }
}

class DashboardPersonalStats {
  const DashboardPersonalStats({required this.regular, required this.official});
  static const DashboardPersonalStats empty = DashboardPersonalStats(
    regular: DashboardCategoryStats.empty,
    official: DashboardCategoryStats.empty,
  );
  final DashboardCategoryStats regular;
  final DashboardCategoryStats official;

  factory DashboardPersonalStats.fromJson(Map<String, dynamic> json) {
    if (json['regular'] is! Map || json['official'] is! Map) {
      throw const FormatException('Invalid personal statistics response.');
    }
    return DashboardPersonalStats(
      regular: DashboardCategoryStats.fromJson(
        Map<String, dynamic>.from(json['regular'] as Map),
      ),
      official: DashboardCategoryStats.fromJson(
        Map<String, dynamic>.from(json['official'] as Map),
      ),
    );
  }
}

class DashboardCategoryStats {
  const DashboardCategoryStats({
    required this.average,
    required this.highScore,
    required this.lowScore,
    required this.gameCount,
  });
  static const DashboardCategoryStats empty = DashboardCategoryStats(
    average: 0,
    highScore: 0,
    lowScore: 0,
    gameCount: 0,
  );
  final double average;
  final int highScore;
  final int lowScore;
  final int gameCount;

  factory DashboardCategoryStats.fromJson(Map<String, dynamic> json) {
    final Object? average = json['average'];
    final Object? highScore = json['highScore'];
    final Object? lowScore = json['lowScore'];
    final Object? gameCount = json['gameCount'];
    if (average is! num ||
        !average.isFinite ||
        highScore is! int ||
        lowScore is! int ||
        gameCount is! int ||
        gameCount < 0) {
      throw const FormatException('Invalid category statistics response.');
    }
    return DashboardCategoryStats(
      average: average.toDouble(),
      highScore: highScore,
      lowScore: lowScore,
      gameCount: gameCount,
    );
  }
}

class DashboardClubAchievement {
  const DashboardClubAchievement({
    required this.teamId,
    required this.teamName,
    required this.enabled,
    required this.bowlerHiddenEnabled,
    required this.seasonName,
    required this.rank,
    required this.points,
    required this.gold,
    required this.silver,
    required this.bronze,
    required this.individualPoints,
    required this.teamPoints,
    required this.eventPoints,
  });

  final String teamId;
  final String teamName;
  final bool enabled;
  final bool bowlerHiddenEnabled;
  final String? seasonName;
  final int? rank;
  final int points;
  final int gold;
  final int silver;
  final int bronze;
  final int? individualPoints;
  final int? teamPoints;
  final int? eventPoints;

  factory DashboardClubAchievement.fromJson(Map<String, dynamic> json) {
    final Object? teamId = json['teamId'];
    final Object? teamName = json['teamName'];
    final Object? enabled = json['enabled'];
    final Object? hidden = json['bowlerHiddenEnabled'];
    final Object? seasonName = json['seasonName'];
    final Object? rank = json['rank'];
    final numeric = <Object?>[
      json['points'],
      json['gold'],
      json['silver'],
      json['bronze'],
    ];
    final optional = <Object?>[
      json['individualPoints'],
      json['teamPoints'],
      json['eventPoints'],
    ];
    if (teamId is! String ||
        teamId.isEmpty ||
        teamName is! String ||
        teamName.isEmpty ||
        enabled is! bool ||
        hidden is! bool ||
        (seasonName != null && seasonName is! String) ||
        (rank != null && (rank is! int || rank < 1)) ||
        numeric.any((value) => value is! int || value < 0) ||
        optional.any(
          (value) => value != null && (value is! int || value < 0),
        )) {
      throw const FormatException('Invalid club achievement response.');
    }
    return DashboardClubAchievement(
      teamId: teamId,
      teamName: teamName,
      enabled: enabled,
      bowlerHiddenEnabled: hidden,
      seasonName: seasonName as String?,
      rank: rank as int?,
      points: numeric[0]! as int,
      gold: numeric[1]! as int,
      silver: numeric[2]! as int,
      bronze: numeric[3]! as int,
      individualPoints: optional[0] as int?,
      teamPoints: optional[1] as int?,
      eventPoints: optional[2] as int?,
    );
  }
}

class DashboardTeamSummary {
  const DashboardTeamSummary({
    required this.id,
    required this.name,
    required this.myRole,
    required this.attended,
    required this.activityCount,
    required this.attendanceRate,
    required this.gameCount,
    required this.average,
  });
  final String id;
  final String name;
  final DashboardTeamRole myRole;
  final int attended;
  final int activityCount;
  final double attendanceRate;
  final int gameCount;
  final double average;

  factory DashboardTeamSummary.fromJson(Map<String, dynamic> json) {
    final Object? id = json['id'];
    final Object? name = json['name'];
    final Object? attended = json['attended'];
    final Object? activityCount = json['activityCount'];
    final Object? attendanceRate = json['attendanceRate'];
    final Object? gameCount = json['gameCount'];
    final Object? average = json['average'];
    if (id is! String ||
        id.isEmpty ||
        name is! String ||
        name.isEmpty ||
        attended is! int ||
        attended < 0 ||
        activityCount is! int ||
        activityCount < attended ||
        attendanceRate is! num ||
        !attendanceRate.isFinite ||
        attendanceRate < 0 ||
        attendanceRate > 100 ||
        gameCount is! int ||
        gameCount < 0 ||
        average is! num ||
        !average.isFinite) {
      throw const FormatException('Invalid team summary response.');
    }
    return DashboardTeamSummary(
      id: id,
      name: name,
      myRole: DashboardTeamRole.fromJson(json['myRole']),
      attended: attended,
      activityCount: activityCount,
      attendanceRate: attendanceRate.toDouble(),
      gameCount: gameCount,
      average: average.toDouble(),
    );
  }
}

enum DashboardTeamRole {
  owner('OWNER', '팀장'),
  manager('MANAGER', '매니저'),
  member('MEMBER', '회원');

  const DashboardTeamRole(this.apiValue, this.label);
  final String apiValue;
  final String label;

  static DashboardTeamRole fromJson(Object? value) {
    for (final role in values) {
      if (role.apiValue == value) return role;
    }
    throw const FormatException('Invalid dashboard team role.');
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
