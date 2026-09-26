import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';

enum ClubEventAttendance {
  unanswered('UNANSWERED', '미응답'),
  attending('ATTENDING', '참석'),
  notAttending('NOT_ATTENDING', '불참');

  const ClubEventAttendance(this.apiValue, this.label);
  final String apiValue;
  final String label;

  static ClubEventAttendance fromJson(Object? value) => values.firstWhere(
    (ClubEventAttendance item) => item.apiValue == value,
    orElse: () => throw const FormatException('Invalid attendance response.'),
  );
}

enum ClubEventDrawMode {
  bulk('BULK', '일괄 추첨'),
  individual('INDIVIDUAL', '개별 추첨');

  const ClubEventDrawMode(this.apiValue, this.label);
  final String apiValue;
  final String label;

  static ClubEventDrawMode fromJson(Object? value) => values.firstWhere(
    (ClubEventDrawMode item) => item.apiValue == value,
    orElse: () => throw const FormatException('Invalid draw mode response.'),
  );
}

enum ClubEventDrawStatus {
  notStarted('NOT_STARTED', '준비'),
  open('OPEN', '추첨 중'),
  completed('COMPLETED', '추첨 완료');

  const ClubEventDrawStatus(this.apiValue, this.label);
  final String apiValue;
  final String label;

  static ClubEventDrawStatus fromJson(Object? value) => values.firstWhere(
    (ClubEventDrawStatus item) => item.apiValue == value,
    orElse: () => throw const FormatException('Invalid draw status response.'),
  );
}

enum ClubCompetitionType {
  individual('INDIVIDUAL', '개인전'),
  team('TEAM', '팀전'),
  event('EVENT', '이벤트전');

  const ClubCompetitionType(this.apiValue, this.label);
  final String apiValue;
  final String label;

  static ClubCompetitionType fromJson(Object? value) => values.firstWhere(
    (ClubCompetitionType item) => item.apiValue == value,
    orElse: () => throw const FormatException('Invalid competition type.'),
  );
}

enum ClubCompetitionMode {
  official('OFFICIAL', '본경기'),
  mini('MINI', 'MINI');

  const ClubCompetitionMode(this.apiValue, this.label);
  final String apiValue;
  final String label;
  static ClubCompetitionMode fromJson(Object? value) => values.firstWhere(
    (item) => item.apiValue == value,
    orElse: () => throw const FormatException('Invalid competition mode.'),
  );
}

class ClubRankPoint {
  const ClubRankPoint({required this.rank, required this.points});
  final int rank;
  final int points;

  factory ClubRankPoint.fromJson(Map<String, dynamic> json) {
    final Object? rank = json['rank'];
    final Object? points = json['points'];
    if (rank is! int || rank < 1 || points is! int || points < 0) {
      throw const FormatException('Invalid rank point.');
    }
    return ClubRankPoint(rank: rank, points: points);
  }

  Map<String, int> toJson() => <String, int>{'rank': rank, 'points': points};
}

class ClubCompetitionConfig {
  const ClubCompetitionConfig({
    required this.type,
    required this.mode,
    required this.status,
    required this.rankPoints,
    required this.competitionStartAt,
    required this.voteCloseAt,
    required this.votingDurationMinutes,
    required this.gameCount,
  });
  final ClubCompetitionType type;
  final ClubCompetitionMode? mode;
  final String status;
  final List<ClubRankPoint> rankPoints;
  final DateTime? competitionStartAt;
  final DateTime? voteCloseAt;
  final int? votingDurationMinutes;
  final int? gameCount;

  factory ClubCompetitionConfig.fromJson(Map<String, dynamic> json) {
    final Object? enabled = json['enabled'];
    final Object? status = json['status'];
    if (enabled != true || status is! String || status.isEmpty) {
      throw const FormatException('Invalid competition config.');
    }
    return ClubCompetitionConfig(
      type: ClubCompetitionType.fromJson(json['type']),
      mode: json['mode'] == null
          ? null
          : ClubCompetitionMode.fromJson(json['mode']),
      status: status,
      rankPoints: _list(json['rankPoints'], ClubRankPoint.fromJson),
      competitionStartAt: _nullableDateTime(json['competitionStartAt']),
      voteCloseAt: _nullableDateTime(json['voteCloseAt']),
      votingDurationMinutes: _nullablePositiveInt(
        json['votingDurationMinutes'],
      ),
      gameCount: _nullablePositiveInt(json['gameCount']),
    );
  }
}

class ClubCompetitionRankingRow {
  const ClubCompetitionRankingRow({
    required this.rank,
    required this.memberId,
    required this.participantId,
    required this.guestId,
    required this.name,
    required this.scores,
    required this.total,
    required this.average,
    required this.points,
  });
  final int rank;
  final String? memberId;
  final String participantId;
  final String? guestId;
  final String name;
  final List<int> scores;
  final int total;
  final num average;
  final int points;

  factory ClubCompetitionRankingRow.fromJson(Map<String, dynamic> json) {
    final Object? scores = json['scores'];
    final Object? average = json['average'];
    if (json['rank'] is! int ||
        json['rank'] < 1 ||
        scores is! List ||
        scores.any(
          (Object? value) => value is! int || value < 0 || value > 300,
        ) ||
        json['total'] is! int ||
        average is! num ||
        json['points'] is! int) {
      throw const FormatException('Invalid competition ranking.');
    }
    return ClubCompetitionRankingRow(
      rank: json['rank'] as int,
      memberId: json['memberId'] as String?,
      participantId: _requiredString(json['participantId'] ?? json['memberId']),
      guestId: json['guestId'] as String?,
      name: _requiredString(json['name']),
      scores: List<int>.unmodifiable(scores.cast<int>()),
      total: json['total'] as int,
      average: average,
      points: json['points'] as int,
    );
  }
}

class ClubCompetitionPreview {
  const ClubCompetitionPreview({
    required this.participantKind,
    required this.participantId,
    required this.memberId,
    required this.guestId,
    required this.name,
    required this.gameSampleCount,
    required this.recent50Average,
    required this.recent12Average,
    required this.regularExpectedScore,
    required this.manualGroupingScore,
    required this.autoGroupingScore,
    required this.autoGroup,
    required this.manualGroup,
    required this.effectiveGroup,
    required this.groupingScore,
    required this.groupingSource,
    required this.ratingStatus,
    required this.baseTier,
    required this.finalGroup,
  });
  final String participantKind;
  final String participantId;
  final String? memberId;
  final String? guestId;
  final String name;
  final int gameSampleCount;
  final num? recent50Average;
  final num? recent12Average;
  final num? regularExpectedScore;
  final int? manualGroupingScore;
  final num? autoGroupingScore;
  final String? autoGroup;
  final String? manualGroup;
  final String? effectiveGroup;
  final num? groupingScore;
  final String groupingSource;
  final String ratingStatus;
  final String? baseTier;
  final String? finalGroup;

  factory ClubCompetitionPreview.fromJson(Map<String, dynamic> json) {
    final Object? count = json['gameSampleCount'];
    final Object? recent50 = json['recent50Average'];
    final Object? recent12 = json['recent12Average'];
    final Object? expected =
        json['regularExpectedScore'] ?? json['expectedScore'];
    final Object? manual = json['manualGroupingScore'];
    final Object? grouping = json['groupingScore'];
    final Object? autoGrouping = json['autoGroupingScore'] ?? grouping;
    final Object? autoGroup = json['autoGroup'] ?? json['baseTier'];
    final Object? manualGroup = json['manualGroup'];
    final Object? effectiveGroup =
        json['effectiveGroup'] ??
        (const <String>{'A', 'B', 'C', 'D', 'E'}.contains(json['finalGroup'])
            ? json['finalGroup']
            : null);
    final Object? status = json['ratingStatus'];
    final String kind = (json['participantKind'] ?? 'MEMBER') as String;
    final String source =
        (json['groupingSource'] ??
                (status == 'DATA_INSUFFICIENT' ? 'MANUAL_REQUIRED' : 'AUTO'))
            as String;
    if (count is! int ||
        count < 0 ||
        (recent50 != null && recent50 is! num) ||
        (recent12 != null && recent12 is! num) ||
        (expected != null && expected is! num) ||
        (manual != null && (manual is! int || manual < 0)) ||
        (grouping != null && grouping is! num) ||
        (autoGrouping != null && autoGrouping is! num) ||
        !const <String>{'MEMBER', 'GUEST'}.contains(kind) ||
        !const <String>{
          'AUTO',
          'MANUAL',
          'MANUAL_REQUIRED',
          'MANUAL_OVERRIDE',
          'LEGACY_MANUAL_SCORE',
        }.contains(source) ||
        status is! String ||
        (json['baseTier'] != null &&
            !const <String>{
              'A',
              'B',
              'C',
              'D',
              'E',
            }.contains(json['baseTier'])) ||
        (json['finalGroup'] != null && json['finalGroup'] is! String) ||
        (autoGroup != null &&
            !const <String>{'A', 'B', 'C', 'D', 'E'}.contains(autoGroup)) ||
        (manualGroup != null &&
            !const <String>{'A', 'B', 'C', 'D', 'E'}.contains(manualGroup)) ||
        (effectiveGroup != null &&
            !const <String>{
              'A',
              'B',
              'C',
              'D',
              'E',
            }.contains(effectiveGroup))) {
      throw const FormatException('Invalid competition preview.');
    }
    final String? memberId = json['memberId'] as String?;
    final String? guestId = json['guestId'] as String?;
    return ClubCompetitionPreview(
      participantKind: kind,
      participantId: _requiredString(
        json['participantId'] ?? memberId ?? guestId,
      ),
      memberId: memberId,
      guestId: guestId,
      name: _requiredString(json['name']),
      gameSampleCount: count,
      recent50Average: recent50 as num?,
      recent12Average: recent12 as num?,
      regularExpectedScore: expected as num?,
      manualGroupingScore: manual as int?,
      autoGroupingScore: autoGrouping as num?,
      autoGroup: autoGroup as String?,
      manualGroup: manualGroup as String?,
      effectiveGroup: effectiveGroup as String?,
      groupingScore: grouping as num?,
      groupingSource: source,
      ratingStatus: status,
      baseTier: json['baseTier'] as String?,
      finalGroup: json['finalGroup'] as String?,
    );
  }
}

class ClubCompetitionResult {
  const ClubCompetitionResult({
    required this.status,
    required this.overall,
    required this.participantPreview,
    required this.groupAssignments,
    required this.myPreview,
    required this.missingGroupCount,
    required this.groupAssignmentComplete,
  });
  final String status;
  final List<ClubCompetitionRankingRow> overall;
  final List<ClubCompetitionPreview>? participantPreview;
  final List<ClubGroupAssignment>? groupAssignments;
  final ClubCompetitionPreview? myPreview;
  final int missingGroupCount;
  final bool groupAssignmentComplete;

  factory ClubCompetitionResult.fromJson(Map<String, dynamic> json) {
    final Object? status = json['status'];
    if (json['enabled'] != true ||
        status is! String ||
        (json['groupingPolicy'] != 'PENDING_PRODUCT_DECISION' &&
            json['groupingPolicy'] != 'WEIGHTED_30_40_30_MANUAL_FALLBACK' &&
            json['groupingPolicy'] !=
                'WEIGHTED_30_40_30_WITH_EXPLICIT_GROUP_OVERRIDE' &&
            json['groupingPolicy'] != 'PUBLISHED_IMMUTABLE_SNAPSHOT')) {
      throw const FormatException('Invalid competition result.');
    }
    return ClubCompetitionResult(
      status: status,
      overall: _list(json['overall'], ClubCompetitionRankingRow.fromJson),
      participantPreview: json['participantPreview'] == null
          ? null
          : _list(json['participantPreview'], ClubCompetitionPreview.fromJson),
      groupAssignments: json['groupAssignments'] == null
          ? null
          : _list(json['groupAssignments'], ClubGroupAssignment.fromJson),
      myPreview: json['myPreview'] == null
          ? null
          : ClubCompetitionPreview.fromJson(_map(json['myPreview'])),
      missingGroupCount: json['missingGroupCount'] is int
          ? json['missingGroupCount'] as int
          : 0,
      groupAssignmentComplete: json['groupAssignmentComplete'] is bool
          ? json['groupAssignmentComplete'] as bool
          : true,
    );
  }
}

class ClubGroupAssignment {
  const ClubGroupAssignment({
    required this.participantId,
    required this.name,
    required this.effectiveGroup,
  });
  final String participantId;
  final String name;
  final String? effectiveGroup;

  factory ClubGroupAssignment.fromJson(Map<String, dynamic> json) {
    final Object? group = json['effectiveGroup'];
    if (group != null &&
        !const <String>{'A', 'B', 'C', 'D', 'E'}.contains(group)) {
      throw const FormatException('Invalid group assignment.');
    }
    return ClubGroupAssignment(
      participantId: _requiredString(json['participantId']),
      name: _requiredString(json['name']),
      effectiveGroup: group as String?,
    );
  }
}

class ClubEventCounts {
  const ClubEventCounts({
    required this.attending,
    required this.notAttending,
    required this.unanswered,
    required this.guests,
  });

  final int attending;
  final int notAttending;
  final int unanswered;
  final int guests;

  factory ClubEventCounts.fromJson(Map<String, dynamic> json) {
    final values = <Object?>[
      json['attending'],
      json['notAttending'],
      json['unanswered'],
      json['guests'],
    ];
    if (values.any((Object? value) => value is! int || value < 0)) {
      throw const FormatException('Invalid event counts response.');
    }
    return ClubEventCounts(
      attending: json['attending'] as int,
      notAttending: json['notAttending'] as int,
      unanswered: json['unanswered'] as int,
      guests: json['guests'] as int,
    );
  }
}

class ClubEventGuest {
  const ClubEventGuest({required this.id, required this.name});
  final String id;
  final String name;
  factory ClubEventGuest.fromJson(Map<String, dynamic> json) => ClubEventGuest(
    id: _requiredString(json['id']),
    name: _requiredString(json['name']),
  );
}

class ClubEventLaneSlot {
  const ClubEventLaneSlot({
    required this.id,
    required this.laneNumber,
    required this.position,
  });
  final String id;
  final int laneNumber;
  final int position;

  factory ClubEventLaneSlot.fromJson(Map<String, dynamic> json) {
    final Object? lane = json['laneNumber'];
    final Object? position = json['position'];
    if (lane is! int || position is! int || lane < 1 || position < 1) {
      throw const FormatException('Invalid lane slot response.');
    }
    return ClubEventLaneSlot(
      id: _requiredString(json['id']),
      laneNumber: lane,
      position: position,
    );
  }
}

class ClubEventLaneAssignment {
  const ClubEventLaneAssignment({
    required this.id,
    required this.memberId,
    required this.guestId,
    required this.name,
    required this.laneNumber,
    required this.position,
    required this.label,
  });
  final String id;
  final String? memberId;
  final String? guestId;
  final String name;
  final int laneNumber;
  final int position;
  final String label;

  factory ClubEventLaneAssignment.fromJson(Map<String, dynamic> json) {
    final Object? memberId = json['memberId'];
    final Object? guestId = json['guestId'];
    final Object? lane = json['laneNumber'];
    final Object? position = json['position'];
    if ((memberId != null && memberId is! String) ||
        (guestId != null && guestId is! String) ||
        lane is! int ||
        position is! int ||
        ((memberId == null) == (guestId == null))) {
      throw const FormatException('Invalid lane assignment response.');
    }
    return ClubEventLaneAssignment(
      id: _requiredString(json['id']),
      memberId: memberId as String?,
      guestId: guestId as String?,
      name: _requiredString(json['name']),
      laneNumber: lane,
      position: position,
      label: _requiredString(json['label']),
    );
  }
}

class ClubEventAttendanceItem {
  const ClubEventAttendanceItem({
    required this.memberId,
    required this.name,
    required this.status,
  });
  final String memberId;
  final String name;
  final ClubEventAttendance status;
  factory ClubEventAttendanceItem.fromJson(Map<String, dynamic> json) =>
      ClubEventAttendanceItem(
        memberId: _requiredString(json['memberId']),
        name: _requiredString(json['name']),
        status: ClubEventAttendance.fromJson(json['status']),
      );
}

class ClubEvent {
  const ClubEvent({
    required this.id,
    required this.teamId,
    required this.title,
    required this.date,
    required this.time,
    required this.location,
    required this.gameType,
    required this.attendanceEnabled,
    required this.laneDrawEnabled,
    required this.laneDrawMode,
    required this.laneDrawStatus,
    required this.myRole,
    required this.myAttendance,
    required this.counts,
    required this.guests,
    required this.slots,
    required this.assignments,
    required this.myAssignment,
    required this.attendance,
    this.bowlerHiddenEnabled = false,
    this.competition,
  });

  final String id;
  final String teamId;
  final String title;
  final String date;
  final String time;
  final String location;
  final String? gameType;
  final bool attendanceEnabled;
  final bool laneDrawEnabled;
  final ClubEventDrawMode laneDrawMode;
  final ClubEventDrawStatus laneDrawStatus;
  final ClubRole myRole;
  final ClubEventAttendance myAttendance;
  final ClubEventCounts counts;
  final List<ClubEventGuest> guests;
  final List<ClubEventLaneSlot> slots;
  final List<ClubEventLaneAssignment> assignments;
  final ClubEventLaneAssignment? myAssignment;
  final List<ClubEventAttendanceItem>? attendance;
  final bool bowlerHiddenEnabled;
  final ClubCompetitionConfig? competition;

  bool get canManage => myRole == ClubRole.owner || myRole == ClubRole.manager;
  bool get isLocked => laneDrawStatus != ClubEventDrawStatus.notStarted;

  factory ClubEvent.fromJson(Map<String, dynamic> json) {
    final Object? gameType = json['gameType'];
    final Object? attendanceEnabled = json['attendanceEnabled'];
    final Object? laneDrawEnabled = json['laneDrawEnabled'];
    final Object? bowlerHiddenEnabled = json['bowlerHiddenEnabled'] ?? false;
    if ((gameType != null && gameType is! String) ||
        attendanceEnabled is! bool ||
        laneDrawEnabled is! bool ||
        bowlerHiddenEnabled is! bool) {
      throw const FormatException('Invalid event response.');
    }
    return ClubEvent(
      id: _requiredString(json['id']),
      teamId: _requiredString(json['teamId']),
      title: _requiredString(json['title']),
      date: _dateString(json['date']),
      time: _timeString(json['time']),
      location: _requiredString(json['location']),
      gameType: gameType as String?,
      attendanceEnabled: attendanceEnabled,
      laneDrawEnabled: laneDrawEnabled,
      laneDrawMode: ClubEventDrawMode.fromJson(json['laneDrawMode']),
      laneDrawStatus: ClubEventDrawStatus.fromJson(json['laneDrawStatus']),
      myRole: ClubRole.fromJson(json['myRole']),
      myAttendance: ClubEventAttendance.fromJson(json['myAttendance']),
      counts: ClubEventCounts.fromJson(_map(json['counts'])),
      guests: _list(json['guests'], ClubEventGuest.fromJson),
      slots: _list(json['slots'], ClubEventLaneSlot.fromJson),
      assignments: _list(json['assignments'], ClubEventLaneAssignment.fromJson),
      myAssignment: json['myAssignment'] == null
          ? null
          : ClubEventLaneAssignment.fromJson(_map(json['myAssignment'])),
      attendance: json['attendance'] == null
          ? null
          : _list(json['attendance'], ClubEventAttendanceItem.fromJson),
      bowlerHiddenEnabled: bowlerHiddenEnabled,
      competition: json['competition'] == null
          ? null
          : ClubCompetitionConfig.fromJson(_map(json['competition'])),
    );
  }
}

class ClubEventsEnvelope {
  const ClubEventsEnvelope({required this.role, required this.events});
  final ClubRole role;
  final List<ClubEvent> events;
  factory ClubEventsEnvelope.fromJson(Map<String, dynamic> json) =>
      ClubEventsEnvelope(
        role: ClubRole.fromJson(json['role']),
        events: _list(json['events'], ClubEvent.fromJson),
      );
}

class ClubEventDraft {
  const ClubEventDraft({
    required this.title,
    required this.date,
    required this.time,
    required this.location,
    required this.gameType,
    required this.attendanceEnabled,
    required this.laneDrawEnabled,
    required this.laneDrawMode,
    this.competitionEnabled = false,
    this.competitionType,
    this.competitionMode,
    this.rankPoints = const <ClubRankPoint>[],
    this.competitionGameCount,
  });
  final String title;
  final String date;
  final String time;
  final String location;
  final String? gameType;
  final bool attendanceEnabled;
  final bool laneDrawEnabled;
  final ClubEventDrawMode laneDrawMode;
  final bool competitionEnabled;
  final ClubCompetitionType? competitionType;
  final ClubCompetitionMode? competitionMode;
  final List<ClubRankPoint> rankPoints;
  final int? competitionGameCount;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'title': title,
    'date': date,
    'time': time,
    'location': location,
    'gameType': gameType,
    'attendanceEnabled': attendanceEnabled,
    'laneDrawEnabled': laneDrawEnabled,
    'laneDrawMode': laneDrawMode.apiValue,
    'competitionEnabled': competitionEnabled,
    'competitionType': competitionEnabled ? competitionType?.apiValue : null,
    'competitionMode': competitionEnabled ? competitionMode?.apiValue : null,
    'rankPoints': rankPoints
        .map((ClubRankPoint item) => item.toJson())
        .toList(),
    'competitionGameCount': competitionEnabled ? competitionGameCount : null,
  };
}

DateTime? _nullableDateTime(Object? value) {
  if (value == null) return null;
  if (value is! String) throw const FormatException('Invalid date response.');
  return DateTime.tryParse(value) ??
      (throw const FormatException('Invalid date response.'));
}

int? _nullablePositiveInt(Object? value) {
  if (value == null) return null;
  if (value is! int || value < 1) {
    throw const FormatException('Invalid integer response.');
  }
  return value;
}

Map<String, dynamic> _map(Object? value) {
  if (value is! Map) throw const FormatException('Invalid object response.');
  return Map<String, dynamic>.from(value);
}

List<T> _list<T>(Object? value, T Function(Map<String, dynamic>) parse) {
  if (value is! List) throw const FormatException('Invalid list response.');
  return List<T>.unmodifiable(value.map((Object? item) => parse(_map(item))));
}

String _requiredString(Object? value) {
  if (value is! String || value.trim().isEmpty) {
    throw const FormatException('Invalid string response.');
  }
  return value;
}

String _dateString(Object? value) {
  final String result = _requiredString(value);
  if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(result)) {
    throw const FormatException('Invalid date response.');
  }
  return result;
}

String _timeString(Object? value) {
  final String result = _requiredString(value);
  if (!RegExp(r'^(?:[01]\d|2[0-3]):[0-5]\d$').hasMatch(result)) {
    throw const FormatException('Invalid time response.');
  }
  return result;
}
