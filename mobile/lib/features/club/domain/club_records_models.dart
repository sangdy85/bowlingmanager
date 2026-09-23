enum ClubRecordFilter {
  all('ALL', '전체'),
  regular('REGULAR', '정기전'),
  casual('CASUAL', '벙개'),
  house('HOUSE', '상주'),
  interclub('INTERCLUB', '교류전'),
  other('OTHER', '기타');

  const ClubRecordFilter(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static ClubRecordFilter fromJson(Object? value) {
    for (final ClubRecordFilter filter in values) {
      if (filter.apiValue == value) return filter;
    }
    throw const FormatException('Invalid club record filter.');
  }
}

class ClubStatistics {
  const ClubStatistics({
    required this.year,
    required this.filter,
    required this.availableYears,
    required this.summary,
    required this.members,
  });

  final int year;
  final ClubRecordFilter filter;
  final List<int> availableYears;
  final ClubStatisticsSummary summary;
  final List<ClubMemberStatistics> members;

  factory ClubStatistics.fromJson(Map<String, dynamic> json) {
    final Object? year = json['year'];
    final Object? years = json['availableYears'];
    final Object? summary = json['summary'];
    final Object? members = json['members'];
    if (year is! int || years is! List || summary is! Map || members is! List) {
      throw const FormatException('Invalid club statistics response.');
    }
    final List<int> parsedYears = years
        .map((Object? value) {
          if (value is! int) {
            throw const FormatException('Invalid club statistics year.');
          }
          return value;
        })
        .toList(growable: false);
    return ClubStatistics(
      year: year,
      filter: ClubRecordFilter.fromJson(json['filter']),
      availableYears: List<int>.unmodifiable(parsedYears),
      summary: ClubStatisticsSummary.fromJson(
        Map<String, dynamic>.from(summary),
      ),
      members: List<ClubMemberStatistics>.unmodifiable(
        members.map((Object? value) {
          if (value is! Map) {
            throw const FormatException('Invalid club member statistics.');
          }
          return ClubMemberStatistics.fromJson(
            Map<String, dynamic>.from(value),
          );
        }),
      ),
    );
  }
}

class ClubStatisticsSummary {
  const ClubStatisticsSummary({
    required this.activityCount,
    required this.memberCount,
    required this.attendanceRate,
    required this.gameCount,
    required this.monthlyAverages,
    required this.total,
    required this.average,
  });

  final int activityCount;
  final int memberCount;
  final double attendanceRate;
  final int gameCount;
  final List<int?> monthlyAverages;
  final int total;
  final double average;

  factory ClubStatisticsSummary.fromJson(Map<String, dynamic> json) {
    final Object? activityCount = json['activityCount'];
    final Object? memberCount = json['memberCount'];
    final Object? attendanceRate = json['attendanceRate'];
    final Object? gameCount = json['gameCount'];
    final Object? monthly = json['monthlyAverages'];
    final Object? total = json['total'];
    final Object? average = json['average'];
    if (activityCount is! int ||
        memberCount is! int ||
        attendanceRate is! num ||
        gameCount is! int ||
        monthly is! List ||
        monthly.length != 12 ||
        total is! int ||
        average is! num) {
      throw const FormatException('Invalid club statistics summary.');
    }
    return ClubStatisticsSummary(
      activityCount: activityCount,
      memberCount: memberCount,
      attendanceRate: attendanceRate.toDouble(),
      gameCount: gameCount,
      monthlyAverages: List<int?>.unmodifiable(
        monthly.map((Object? value) {
          if (value != null && value is! int) {
            throw const FormatException('Invalid monthly average.');
          }
          return value as int?;
        }),
      ),
      total: total,
      average: average.toDouble(),
    );
  }
}

class ClubMemberStatistics {
  const ClubMemberStatistics({
    required this.id,
    required this.name,
    required this.attendanceRate,
    required this.attended,
    required this.activityCount,
    required this.gameCount,
    required this.monthlyAverages,
    required this.total,
    required this.average,
  });

  final String id;
  final String name;
  final double attendanceRate;
  final int attended;
  final int activityCount;
  final int gameCount;
  final List<int?> monthlyAverages;
  final int total;
  final double average;

  factory ClubMemberStatistics.fromJson(Map<String, dynamic> json) {
    final Object? id = json['id'];
    final Object? name = json['name'];
    final Object? attendanceRate = json['attendanceRate'];
    final Object? attended = json['attended'];
    final Object? activityCount = json['activityCount'];
    final Object? gameCount = json['gameCount'];
    final Object? monthly = json['monthlyAverages'];
    final Object? total = json['total'];
    final Object? average = json['average'];
    if (id is! String ||
        id.isEmpty ||
        name is! String ||
        name.isEmpty ||
        attendanceRate is! num ||
        attended is! int ||
        activityCount is! int ||
        gameCount is! int ||
        monthly is! List ||
        monthly.length != 12 ||
        total is! int ||
        average is! num) {
      throw const FormatException('Invalid club member statistics.');
    }
    return ClubMemberStatistics(
      id: id,
      name: name,
      attendanceRate: attendanceRate.toDouble(),
      attended: attended,
      activityCount: activityCount,
      gameCount: gameCount,
      monthlyAverages: List<int?>.unmodifiable(
        monthly.map((Object? value) {
          if (value != null && value is! int) {
            throw const FormatException('Invalid monthly average.');
          }
          return value as int?;
        }),
      ),
      total: total,
      average: average.toDouble(),
    );
  }
}

class ClubActivity {
  const ClubActivity({
    required this.id,
    required this.date,
    required this.gameType,
    required this.participantCount,
    required this.gameCount,
    required this.dailyAverage,
  });

  final String id;
  final DateTime date;
  final String? gameType;
  final int participantCount;
  final int gameCount;
  final double dailyAverage;

  factory ClubActivity.fromJson(Map<String, dynamic> json) {
    final Object? id = json['id'];
    final Object? date = json['date'];
    final Object? gameType = json['gameType'];
    final Object? participantCount = json['participantCount'];
    final Object? gameCount = json['gameCount'];
    final Object? dailyAverage = json['dailyAverage'];
    final DateTime? parsedDate = date is String
        ? DateTime.tryParse(date)
        : null;
    if (id is! String ||
        id.isEmpty ||
        parsedDate == null ||
        (gameType != null && gameType is! String) ||
        participantCount is! int ||
        gameCount is! int ||
        dailyAverage is! num) {
      throw const FormatException('Invalid club activity response.');
    }
    return ClubActivity(
      id: id,
      date: parsedDate,
      gameType: gameType as String?,
      participantCount: participantCount,
      gameCount: gameCount,
      dailyAverage: dailyAverage.toDouble(),
    );
  }
}

class ClubActivitiesPage {
  const ClubActivitiesPage({
    required this.year,
    required this.filter,
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final int year;
  final ClubRecordFilter filter;
  final List<ClubActivity> items;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  bool get hasNextPage => page < totalPages;

  factory ClubActivitiesPage.fromJson(Map<String, dynamic> json) {
    final Object? year = json['year'];
    final Object? items = json['items'];
    final Object? pagination = json['pagination'];
    if (year is! int || items is! List || pagination is! Map) {
      throw const FormatException('Invalid club activities response.');
    }
    final Map<String, dynamic> pageData = Map<String, dynamic>.from(pagination);
    final Object? page = pageData['page'];
    final Object? limit = pageData['limit'];
    final Object? total = pageData['total'];
    final Object? totalPages = pageData['totalPages'];
    if (page is! int || limit is! int || total is! int || totalPages is! int) {
      throw const FormatException('Invalid club activities pagination.');
    }
    return ClubActivitiesPage(
      year: year,
      filter: ClubRecordFilter.fromJson(json['filter']),
      items: List<ClubActivity>.unmodifiable(
        items.map((Object? value) {
          if (value is! Map) {
            throw const FormatException('Invalid club activity response.');
          }
          return ClubActivity.fromJson(Map<String, dynamic>.from(value));
        }),
      ),
      page: page,
      limit: limit,
      total: total,
      totalPages: totalPages,
    );
  }
}

class ClubActivityDetail extends ClubActivity {
  const ClubActivityDetail({
    required super.id,
    required super.date,
    required super.gameType,
    required super.participantCount,
    required super.gameCount,
    required super.dailyAverage,
    required this.participants,
  });

  final List<ClubActivityParticipant> participants;

  factory ClubActivityDetail.fromJson(Map<String, dynamic> json) {
    final ClubActivity activity = ClubActivity.fromJson(json);
    final Object? participants = json['participants'];
    if (participants is! List) {
      throw const FormatException('Invalid club activity participants.');
    }
    return ClubActivityDetail(
      id: activity.id,
      date: activity.date,
      gameType: activity.gameType,
      participantCount: activity.participantCount,
      gameCount: activity.gameCount,
      dailyAverage: activity.dailyAverage,
      participants: List<ClubActivityParticipant>.unmodifiable(
        participants.map((Object? value) {
          if (value is! Map) {
            throw const FormatException('Invalid club activity participant.');
          }
          return ClubActivityParticipant.fromJson(
            Map<String, dynamic>.from(value),
          );
        }),
      ),
    );
  }
}

class ClubActivityFeedItem extends ClubActivityDetail {
  const ClubActivityFeedItem({
    required super.id,
    required super.date,
    required super.gameType,
    required super.participantCount,
    required super.gameCount,
    required super.dailyAverage,
    required super.participants,
    required this.canManage,
  });

  final bool canManage;

  factory ClubActivityFeedItem.fromJson(Map<String, dynamic> json) {
    final ClubActivityDetail activity = ClubActivityDetail.fromJson(json);
    final Object? canManage = json['canManage'];
    if (canManage is! bool) {
      throw const FormatException('Invalid club activity permissions.');
    }
    return ClubActivityFeedItem(
      id: activity.id,
      date: activity.date,
      gameType: activity.gameType,
      participantCount: activity.participantCount,
      gameCount: activity.gameCount,
      dailyAverage: activity.dailyAverage,
      participants: activity.participants,
      canManage: canManage,
    );
  }
}

class ClubActivityFeedPage {
  const ClubActivityFeedPage({
    required this.year,
    required this.types,
    required this.currentMemberId,
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final int year;
  final List<ClubRecordFilter> types;
  final String? currentMemberId;
  final List<ClubActivityFeedItem> items;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  bool get hasNextPage => page < totalPages;

  factory ClubActivityFeedPage.fromJson(Map<String, dynamic> json) {
    final Object? year = json['year'];
    final Object? types = json['types'];
    final Object? currentMemberId = json['currentMemberId'];
    final Object? items = json['items'];
    final Object? pagination = json['pagination'];
    if (year is! int ||
        types is! List ||
        (currentMemberId != null && currentMemberId is! String) ||
        items is! List ||
        pagination is! Map) {
      throw const FormatException('Invalid club activity feed response.');
    }
    final Map<String, dynamic> pageData = Map<String, dynamic>.from(pagination);
    final Object? page = pageData['page'];
    final Object? limit = pageData['limit'];
    final Object? total = pageData['total'];
    final Object? totalPages = pageData['totalPages'];
    if (page is! int || limit is! int || total is! int || totalPages is! int) {
      throw const FormatException('Invalid club activity feed pagination.');
    }
    final List<ClubRecordFilter> parsedTypes = types
        .map(ClubRecordFilter.fromJson)
        .toList(growable: false);
    if (parsedTypes.contains(ClubRecordFilter.all)) {
      throw const FormatException('Invalid club activity feed filters.');
    }
    return ClubActivityFeedPage(
      year: year,
      types: List<ClubRecordFilter>.unmodifiable(parsedTypes),
      currentMemberId: currentMemberId as String?,
      items: List<ClubActivityFeedItem>.unmodifiable(
        items.map((Object? value) {
          if (value is! Map) {
            throw const FormatException('Invalid club activity feed item.');
          }
          return ClubActivityFeedItem.fromJson(
            Map<String, dynamic>.from(value),
          );
        }),
      ),
      page: page,
      limit: limit,
      total: total,
      totalPages: totalPages,
    );
  }
}

class ClubActivityParticipant {
  const ClubActivityParticipant({
    required this.rank,
    required this.id,
    required this.name,
    required this.scores,
    required this.total,
    required this.average,
  });

  final int rank;
  final String id;
  final String name;
  final List<int> scores;
  final int total;
  final double average;

  factory ClubActivityParticipant.fromJson(Map<String, dynamic> json) {
    final Object? rank = json['rank'];
    final Object? id = json['id'];
    final Object? name = json['name'];
    final Object? scores = json['scores'];
    final Object? total = json['total'];
    final Object? average = json['average'];
    if (rank is! int ||
        rank < 1 ||
        id is! String ||
        id.isEmpty ||
        name is! String ||
        name.isEmpty ||
        scores is! List ||
        total is! int ||
        average is! num) {
      throw const FormatException('Invalid club activity participant.');
    }
    return ClubActivityParticipant(
      rank: rank,
      id: id,
      name: name,
      scores: List<int>.unmodifiable(
        scores.map((Object? value) {
          if (value is! int || value < 0 || value > 300) {
            throw const FormatException('Invalid participant score.');
          }
          return value;
        }),
      ),
      total: total,
      average: average.toDouble(),
    );
  }
}
