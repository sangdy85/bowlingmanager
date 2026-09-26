import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';

Map<String, dynamic> _map(Object? value, String message) {
  if (value is! Map) throw FormatException(message);
  return Map<String, dynamic>.from(value);
}

class ClubMemberProfile {
  const ClubMemberProfile({
    required this.id,
    required this.name,
    required this.alias,
    required this.role,
    required this.handicap,
    required this.joinedAt,
    required this.activityStartDate,
    required this.year,
    required this.attendanceRate,
    required this.attended,
    required this.activityCount,
    required this.gameCount,
    required this.total,
    required this.average,
    required this.monthlyAverages,
    required this.gold,
    required this.silver,
    required this.bronze,
    required this.recentScores,
  });
  final String id;
  final String name;
  final String? alias;
  final ClubRole role;
  final int? handicap;
  final DateTime joinedAt;
  final DateTime? activityStartDate;
  final int year;
  final double attendanceRate;
  final int attended;
  final int activityCount;
  final int gameCount;
  final int total;
  final double average;
  final List<int?> monthlyAverages;
  final int gold;
  final int silver;
  final int bronze;
  final List<ClubRecentRegularScore> recentScores;

  factory ClubMemberProfile.fromJson(Map<String, dynamic> json) {
    final joinedAt = DateTime.tryParse(json['joinedAt'] as String? ?? '');
    final start = json['activityStartDate'];
    final monthly = json['monthlyAverages'];
    final medals = _map(json['medals'], 'Invalid medals.');
    final recent = json['recentRegularScores'];
    if (json['id'] is! String ||
        json['name'] is! String ||
        (json['alias'] != null && json['alias'] is! String) ||
        (json['handicap'] != null && json['handicap'] is! int) ||
        joinedAt == null ||
        (start != null &&
            (start is! String || DateTime.tryParse(start) == null)) ||
        json['year'] is! int ||
        json['attendanceRate'] is! num ||
        json['attended'] is! int ||
        json['activityCount'] is! int ||
        json['gameCount'] is! int ||
        json['total'] is! int ||
        json['average'] is! num ||
        monthly is! List ||
        monthly.length != 12 ||
        recent is! List ||
        medals['gold'] is! int ||
        medals['silver'] is! int ||
        medals['bronze'] is! int) {
      throw const FormatException('Invalid member profile.');
    }
    return ClubMemberProfile(
      id: json['id'] as String,
      name: json['name'] as String,
      alias: json['alias'] as String?,
      role: ClubRole.fromJson(json['role']),
      handicap: json['handicap'] as int?,
      joinedAt: joinedAt,
      activityStartDate: start == null ? null : DateTime.parse(start as String),
      year: json['year'] as int,
      attendanceRate: (json['attendanceRate'] as num).toDouble(),
      attended: json['attended'] as int,
      activityCount: json['activityCount'] as int,
      gameCount: json['gameCount'] as int,
      total: json['total'] as int,
      average: (json['average'] as num).toDouble(),
      monthlyAverages: List<int?>.unmodifiable(
        monthly.map((value) {
          if (value != null && value is! int) {
            throw const FormatException('Invalid monthly average.');
          }
          return value as int?;
        }),
      ),
      gold: medals['gold'] as int,
      silver: medals['silver'] as int,
      bronze: medals['bronze'] as int,
      recentScores: List<ClubRecentRegularScore>.unmodifiable(
        recent.map(
          (value) => ClubRecentRegularScore.fromJson(
            _map(value, 'Invalid recent score.'),
          ),
        ),
      ),
    );
  }
}

class ClubRecentRegularScore {
  const ClubRecentRegularScore({
    required this.id,
    required this.date,
    required this.score,
  });
  final String id;
  final DateTime date;
  final int score;
  factory ClubRecentRegularScore.fromJson(Map<String, dynamic> json) {
    final date = DateTime.tryParse(json['date'] as String? ?? '');
    if (json['id'] is! String || date == null || json['score'] is! int) {
      throw const FormatException('Invalid recent score.');
    }
    return ClubRecentRegularScore(
      id: json['id'] as String,
      date: date,
      score: json['score'] as int,
    );
  }
}

class ClubSeason {
  const ClubSeason({
    required this.id,
    required this.name,
    required this.startDate,
    required this.endDate,
    required this.scoringMode,
    required this.points,
    this.status = 'ACTIVE',
    this.individualPoints = const <ClubSeasonRankPoint>[],
    this.teamPoints = const <ClubSeasonRankPoint>[],
    this.eventPoints = const <ClubSeasonRankPoint>[],
  });
  final String id;
  final String name;
  final DateTime startDate;
  final DateTime endDate;
  final String scoringMode;
  final List<int> points;
  final String status;
  final List<ClubSeasonRankPoint> individualPoints;
  final List<ClubSeasonRankPoint> teamPoints;
  final List<ClubSeasonRankPoint> eventPoints;
  factory ClubSeason.fromJson(Map<String, dynamic> json) {
    final start = DateTime.tryParse(json['startDate'] as String? ?? '');
    final end = DateTime.tryParse(json['endDate'] as String? ?? '');
    final points = json['points'];
    final status = json['status'] ?? 'ACTIVE';
    final tables = json['pointTables'];
    if (json['id'] is! String ||
        json['name'] is! String ||
        start == null ||
        end == null ||
        (json['scoringMode'] != 'FULL_RANK' &&
            json['scoringMode'] != 'PODIUM') ||
        points is! List ||
        points.any((value) => value is! int) ||
        status is! String ||
        !const <String>{'DRAFT', 'ACTIVE', 'COMPLETED'}.contains(status) ||
        (tables != null && tables is! Map)) {
      throw const FormatException('Invalid season.');
    }
    final pointTables = tables == null
        ? <String, dynamic>{}
        : Map<String, dynamic>.from(tables as Map);
    List<ClubSeasonRankPoint> table(String key) {
      final raw = pointTables[key];
      if (raw == null) {
        return List<ClubSeasonRankPoint>.unmodifiable(
          points.indexed.map(
            (item) =>
                ClubSeasonRankPoint(rank: item.$1 + 1, points: item.$2 as int),
          ),
        );
      }
      if (raw is! List) throw const FormatException('Invalid point table.');
      return List<ClubSeasonRankPoint>.unmodifiable(
        raw.map(
          (value) => ClubSeasonRankPoint.fromJson(
            _map(value, 'Invalid point table entry.'),
          ),
        ),
      );
    }

    return ClubSeason(
      id: json['id'] as String,
      name: json['name'] as String,
      startDate: start,
      endDate: end,
      scoringMode: json['scoringMode'] as String,
      points: List<int>.unmodifiable(points.cast<int>()),
      status: status,
      individualPoints: table('individual'),
      teamPoints: table('team'),
      eventPoints: table('event'),
    );
  }
}

class ClubSeasonRankPoint {
  const ClubSeasonRankPoint({required this.rank, required this.points});
  final int rank;
  final int points;

  factory ClubSeasonRankPoint.fromJson(Map<String, dynamic> json) {
    if (json['rank'] is! int ||
        (json['rank'] as int) < 1 ||
        json['points'] is! int ||
        (json['points'] as int) < 0) {
      throw const FormatException('Invalid season point.');
    }
    return ClubSeasonRankPoint(
      rank: json['rank'] as int,
      points: json['points'] as int,
    );
  }
}

class ClubSeasonPointEntry {
  const ClubSeasonPointEntry({
    required this.id,
    required this.eventId,
    required this.competitionType,
    required this.competitionDate,
    required this.competitionTitle,
    required this.finalRank,
    required this.points,
    required this.month,
    this.participationStatus = 'PARTICIPATED',
    this.sourceType = 'AUTOMATIC',
    this.reason,
  });
  final String id;
  final String? eventId;
  final String competitionType;
  final DateTime competitionDate;
  final String competitionTitle;
  final int? finalRank;
  final int points;
  final int month;
  final String participationStatus;
  final String sourceType;
  final String? reason;

  factory ClubSeasonPointEntry.fromJson(Map<String, dynamic> json) {
    final date = DateTime.tryParse(json['competitionDate'] as String? ?? '');
    if (json['id'] is! String ||
        (json['eventId'] != null && json['eventId'] is! String) ||
        !const <String>{
          'INDIVIDUAL',
          'TEAM',
          'EVENT',
          'MANUAL_ADJUSTMENT',
        }.contains(json['competitionType']) ||
        date == null ||
        json['competitionTitle'] is! String ||
        (json['finalRank'] != null && json['finalRank'] is! int) ||
        json['points'] is! int ||
        json['month'] is! int ||
        (json['month'] as int) < 1 ||
        (json['month'] as int) > 12 ||
        !const <String>{
          'PARTICIPATED',
          'ABSENT',
        }.contains(json['participationStatus'] ?? 'PARTICIPATED') ||
        !const <String>{
          'AUTOMATIC',
          'MANUAL_ADJUSTMENT',
        }.contains(json['sourceType'] ?? 'AUTOMATIC') ||
        (json['reason'] != null && json['reason'] is! String)) {
      throw const FormatException('Invalid season point entry.');
    }
    return ClubSeasonPointEntry(
      id: json['id'] as String,
      eventId: json['eventId'] as String?,
      competitionType: json['competitionType'] as String,
      competitionDate: date,
      competitionTitle: json['competitionTitle'] as String,
      finalRank: json['finalRank'] as int?,
      points: json['points'] as int,
      month: json['month'] as int,
      participationStatus:
          (json['participationStatus'] ?? 'PARTICIPATED') as String,
      sourceType: (json['sourceType'] ?? 'AUTOMATIC') as String,
      reason: json['reason'] as String?,
    );
  }
}

class ClubTeamProfile {
  const ClubTeamProfile({
    required this.id,
    required this.name,
    required this.description,
    required this.notice,
    required this.myRole,
    required this.seasonRankingEnabled,
    required this.bowlerHiddenEnabled,
    required this.activeSeason,
  });
  final String id;
  final String name;
  final String? description;
  final String? notice;
  final ClubRole myRole;
  final bool seasonRankingEnabled;
  final bool bowlerHiddenEnabled;
  final ClubSeason? activeSeason;
  factory ClubTeamProfile.fromJson(Map<String, dynamic> json) {
    if (json['id'] is! String ||
        json['name'] is! String ||
        (json['description'] != null && json['description'] is! String) ||
        (json['notice'] != null && json['notice'] is! String) ||
        json['seasonRankingEnabled'] is! bool ||
        json['bowlerHiddenEnabled'] is! bool) {
      throw const FormatException('Invalid team profile.');
    }
    return ClubTeamProfile(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      notice: json['notice'] as String?,
      myRole: ClubRole.fromJson(json['myRole']),
      seasonRankingEnabled: json['seasonRankingEnabled'] as bool,
      bowlerHiddenEnabled: json['bowlerHiddenEnabled'] as bool,
      activeSeason: json['activeSeason'] == null
          ? null
          : ClubSeason.fromJson(_map(json['activeSeason'], 'Invalid season.')),
    );
  }
}

class ClubSeasonRankingRow {
  const ClubSeasonRankingRow({
    required this.rank,
    required this.id,
    required this.name,
    required this.points,
    required this.attended,
    required this.games,
    required this.average,
    required this.gold,
    required this.silver,
    required this.bronze,
    this.individualPoints = 0,
    this.teamPoints = 0,
    this.eventPoints = 0,
    this.adjustmentPoints = 0,
    this.competitionsPlayed = 0,
    this.individualWins = 0,
    this.teamWins = 0,
    this.eventWins = 0,
    this.entries = const <ClubSeasonPointEntry>[],
    this.monthlyHistory = const <List<ClubSeasonPointEntry>>[],
  });
  final int rank;
  final String id;
  final String name;
  final int points;
  final int attended;
  final int games;
  final double average;
  final int gold;
  final int silver;
  final int bronze;
  final int individualPoints;
  final int teamPoints;
  final int eventPoints;
  final int adjustmentPoints;
  final int competitionsPlayed;
  final int individualWins;
  final int teamWins;
  final int eventWins;
  final List<ClubSeasonPointEntry> entries;
  final List<List<ClubSeasonPointEntry>> monthlyHistory;
  factory ClubSeasonRankingRow.fromJson(Map<String, dynamic> json) {
    final entries = json['entries'] ?? const <Object>[];
    final monthly =
        json['monthlyHistory'] ?? List<Object>.filled(12, const <Object>[]);
    if (json['rank'] is! int ||
        json['id'] is! String ||
        json['name'] is! String ||
        json['points'] is! int ||
        json['attended'] is! int ||
        json['games'] is! int ||
        json['average'] is! num ||
        json['gold'] is! int ||
        json['silver'] is! int ||
        json['bronze'] is! int ||
        (json['individualPoints'] ?? 0) is! int ||
        (json['teamPoints'] ?? 0) is! int ||
        (json['eventPoints'] ?? 0) is! int ||
        (json['adjustmentPoints'] ?? 0) is! int ||
        (json['competitionsPlayed'] ?? json['attended']) is! int ||
        (json['individualWins'] ?? 0) is! int ||
        (json['teamWins'] ?? 0) is! int ||
        (json['eventWins'] ?? 0) is! int ||
        entries is! List ||
        monthly is! List ||
        monthly.length != 12 ||
        monthly.any((value) => value is! List)) {
      throw const FormatException('Invalid season row.');
    }
    ClubSeasonPointEntry parseEntry(Object? value) =>
        ClubSeasonPointEntry.fromJson(_map(value, 'Invalid season entry.'));
    return ClubSeasonRankingRow(
      rank: json['rank'] as int,
      id: json['id'] as String,
      name: json['name'] as String,
      points: json['points'] as int,
      attended: json['attended'] as int,
      games: json['games'] as int,
      average: (json['average'] as num).toDouble(),
      gold: json['gold'] as int,
      silver: json['silver'] as int,
      bronze: json['bronze'] as int,
      individualPoints: (json['individualPoints'] ?? 0) as int,
      teamPoints: (json['teamPoints'] ?? 0) as int,
      eventPoints: (json['eventPoints'] ?? 0) as int,
      adjustmentPoints: (json['adjustmentPoints'] ?? 0) as int,
      competitionsPlayed:
          (json['competitionsPlayed'] ?? json['attended']) as int,
      individualWins: (json['individualWins'] ?? 0) as int,
      teamWins: (json['teamWins'] ?? 0) as int,
      eventWins: (json['eventWins'] ?? 0) as int,
      entries: List<ClubSeasonPointEntry>.unmodifiable(entries.map(parseEntry)),
      monthlyHistory: List<List<ClubSeasonPointEntry>>.unmodifiable(
        monthly.map(
          (value) => List<ClubSeasonPointEntry>.unmodifiable(
            (value as List).map(parseEntry),
          ),
        ),
      ),
    );
  }
}

class ClubSeasonRanking {
  const ClubSeasonRanking({
    required this.enabled,
    required this.season,
    required this.rows,
    required this.bowlerHiddenEnabled,
    this.seasons = const <ClubSeason>[],
    this.competitionType = 'ALL',
    this.myCompetitionHistory = const <ClubSeasonPointEntry>[],
  });
  final bool enabled;
  final ClubSeason? season;
  final List<ClubSeasonRankingRow> rows;
  final bool bowlerHiddenEnabled;
  final List<ClubSeason> seasons;
  final String competitionType;
  final List<ClubSeasonPointEntry> myCompetitionHistory;
  factory ClubSeasonRanking.fromJson(Map<String, dynamic> json) {
    final rows = json['rankings'];
    final seasons = json['seasons'] ?? const <Object>[];
    final competitionType = json['competitionType'] ?? 'ALL';
    final history = json['myCompetitionHistory'] ?? const <Object>[];
    if (json['enabled'] is! bool ||
        json['bowlerHiddenEnabled'] is! bool ||
        rows is! List ||
        seasons is! List ||
        history is! List ||
        !const <String>{
          'ALL',
          'INDIVIDUAL',
          'TEAM',
          'EVENT',
        }.contains(competitionType)) {
      throw const FormatException('Invalid ranking.');
    }
    return ClubSeasonRanking(
      enabled: json['enabled'] as bool,
      bowlerHiddenEnabled: json['bowlerHiddenEnabled'] as bool,
      season: json['season'] == null
          ? null
          : ClubSeason.fromJson(_map(json['season'], 'Invalid season.')),
      rows: List<ClubSeasonRankingRow>.unmodifiable(
        rows.map(
          (value) =>
              ClubSeasonRankingRow.fromJson(_map(value, 'Invalid season row.')),
        ),
      ),
      seasons: List<ClubSeason>.unmodifiable(
        seasons.map(
          (value) => ClubSeason.fromJson(_map(value, 'Invalid season.')),
        ),
      ),
      competitionType: competitionType as String,
      myCompetitionHistory: List<ClubSeasonPointEntry>.unmodifiable(
        history.map(
          (value) => ClubSeasonPointEntry.fromJson(
            _map(value, 'Invalid competition history.'),
          ),
        ),
      ),
    );
  }
}

class ClubPostSummary {
  const ClubPostSummary({
    required this.id,
    required this.title,
    required this.authorName,
    required this.createdAt,
    required this.imageCount,
  });
  final String id;
  final String title;
  final String authorName;
  final DateTime createdAt;
  final int imageCount;
  factory ClubPostSummary.fromJson(Map<String, dynamic> json) {
    final date = DateTime.tryParse(json['createdAt'] as String? ?? '');
    if (json['id'] is! String ||
        json['title'] is! String ||
        json['authorName'] is! String ||
        date == null ||
        json['imageCount'] is! int) {
      throw const FormatException('Invalid post.');
    }
    return ClubPostSummary(
      id: json['id'] as String,
      title: json['title'] as String,
      authorName: json['authorName'] as String,
      createdAt: date,
      imageCount: json['imageCount'] as int,
    );
  }
}

class ClubPostsPage {
  const ClubPostsPage({
    required this.items,
    required this.page,
    required this.totalPages,
  });
  final List<ClubPostSummary> items;
  final int page;
  final int totalPages;
  factory ClubPostsPage.fromJson(Map<String, dynamic> json) {
    final items = json['items'];
    final pagination = _map(json['pagination'], 'Invalid pagination.');
    if (items is! List ||
        pagination['page'] is! int ||
        pagination['totalPages'] is! int) {
      throw const FormatException('Invalid posts page.');
    }
    return ClubPostsPage(
      items: List<ClubPostSummary>.unmodifiable(
        items.map(
          (value) => ClubPostSummary.fromJson(_map(value, 'Invalid post.')),
        ),
      ),
      page: pagination['page'] as int,
      totalPages: pagination['totalPages'] as int,
    );
  }
}

class ClubPostImage {
  const ClubPostImage({required this.id});
  final String id;

  factory ClubPostImage.fromJson(Map<String, dynamic> json) {
    if (json['id'] is! String || (json['id'] as String).isEmpty) {
      throw const FormatException('Invalid post image.');
    }
    return ClubPostImage(id: json['id'] as String);
  }
}

class ClubPostDetail {
  const ClubPostDetail({
    required this.id,
    required this.title,
    required this.content,
    required this.authorName,
    required this.createdAt,
    required this.canEdit,
    required this.images,
  });
  final String id;
  final String title;
  final String content;
  final String authorName;
  final DateTime createdAt;
  final bool canEdit;
  final List<ClubPostImage> images;
  factory ClubPostDetail.fromJson(Map<String, dynamic> json) {
    final date = DateTime.tryParse(json['createdAt'] as String? ?? '');
    if (json['id'] is! String ||
        json['title'] is! String ||
        json['content'] is! String ||
        json['authorName'] is! String ||
        date == null ||
        json['canEdit'] is! bool ||
        json['images'] is! List) {
      throw const FormatException('Invalid post detail.');
    }
    return ClubPostDetail(
      id: json['id'] as String,
      title: json['title'] as String,
      content: json['content'] as String,
      authorName: json['authorName'] as String,
      createdAt: date,
      canEdit: json['canEdit'] as bool,
      images: List<ClubPostImage>.unmodifiable(
        (json['images'] as List).map(
          (value) => ClubPostImage.fromJson(_map(value, 'Invalid post image.')),
        ),
      ),
    );
  }
}
