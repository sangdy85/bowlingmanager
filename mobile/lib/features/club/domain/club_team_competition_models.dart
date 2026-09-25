class ClubTeamCompetitionParticipant {
  const ClubTeamCompetitionParticipant({
    required this.participantId,
    required this.participantKind,
    required this.memberId,
    required this.guestId,
    required this.name,
    required this.assignmentType,
    required this.assignmentOrder,
    required this.laneSlot,
  });
  final String participantId;
  final String participantKind;
  final String? memberId;
  final String? guestId;
  final String name;
  final String? assignmentType;
  final int? assignmentOrder;
  final String? laneSlot;

  factory ClubTeamCompetitionParticipant.fromJson(Map<String, dynamic> json) {
    const Set<String> assignmentTypes = <String>{
      'CAPTAIN',
      'DRAFT',
      'RANDOM',
      'LUCKY_DRAW',
    };
    final String? memberId = json['memberId'] as String?;
    final String? guestId = json['guestId'] as String?;
    final String kind =
        (json['participantKind'] ?? (guestId == null ? 'MEMBER' : 'GUEST'))
            as String;
    if ((memberId == null) == (guestId == null) ||
        !const <String>{'MEMBER', 'GUEST'}.contains(kind) ||
        json['name'] is! String ||
        (json['assignmentType'] != null &&
            !assignmentTypes.contains(json['assignmentType'])) ||
        (json['assignmentOrder'] != null && json['assignmentOrder'] is! int) ||
        (json['laneSlot'] != null && json['laneSlot'] is! String)) {
      throw const FormatException('Invalid team competition participant.');
    }
    return ClubTeamCompetitionParticipant(
      participantId: _string(json['participantId'] ?? memberId ?? guestId),
      participantKind: kind,
      memberId: memberId,
      guestId: guestId,
      name: json['name'] as String,
      assignmentType: json['assignmentType'] as String?,
      assignmentOrder: json['assignmentOrder'] as int?,
      laneSlot: json['laneSlot'] as String?,
    );
  }
}

class ClubCompetitionTeam {
  const ClubCompetitionTeam({
    required this.id,
    required this.name,
    required this.draftOrder,
    required this.lanePriority,
    required this.teamHandicap,
    required this.captainMemberId,
    required this.captainName,
    required this.members,
  });
  final String id;
  final String name;
  final int draftOrder;
  final int? lanePriority;
  final int teamHandicap;
  final String captainMemberId;
  final String captainName;
  final List<ClubTeamCompetitionParticipant> members;

  factory ClubCompetitionTeam.fromJson(Map<String, dynamic> json) =>
      ClubCompetitionTeam(
        id: _string(json['id']),
        name: _string(json['name']),
        draftOrder: _positiveInt(json['draftOrder']),
        lanePriority: json['lanePriority'] == null
            ? null
            : _positiveInt(json['lanePriority']),
        teamHandicap: _nonNegativeInt(json['teamHandicap']),
        captainMemberId: _string(json['captainMemberId']),
        captainName: _string(json['captainName']),
        members: _list(
          json['members'],
          ClubTeamCompetitionParticipant.fromJson,
        ),
      );
}

class ClubDraftTurn {
  const ClubDraftTurn({
    required this.pickNumber,
    required this.roundNumber,
    required this.direction,
    required this.competitionTeamId,
    required this.captainName,
  });
  final int pickNumber;
  final int roundNumber;
  final String direction;
  final String competitionTeamId;
  final String captainName;
  factory ClubDraftTurn.fromJson(Map<String, dynamic> json) => ClubDraftTurn(
    pickNumber: _positiveInt(json['pickNumber']),
    roundNumber: _positiveInt(json['roundNumber']),
    direction: _enumString(json['direction'], const <String>{
      'FORWARD',
      'REVERSE',
    }),
    competitionTeamId: _string(json['competitionTeamId']),
    captainName: _string(json['captainName']),
  );
}

class ClubDraftHistoryItem {
  const ClubDraftHistoryItem({
    required this.id,
    required this.pickNumber,
    required this.roundNumber,
    required this.pickType,
    required this.teamName,
    required this.selectedDisplayName,
  });
  final String id;
  final int pickNumber;
  final int roundNumber;
  final String pickType;
  final String teamName;
  final String selectedDisplayName;
  bool get automatic => pickType == 'AUTO_REMAINDER';
  factory ClubDraftHistoryItem.fromJson(Map<String, dynamic> json) =>
      ClubDraftHistoryItem(
        id: _string(json['id']),
        pickNumber: _positiveInt(json['pickNumber']),
        roundNumber: json['roundNumber'] is int
            ? json['roundNumber'] as int
            : throw const FormatException('Invalid round.'),
        pickType: _enumString(json['pickType'], const <String>{
          'CAPTAIN_PICK',
          'RANDOM_REMAINDER',
          'MANUAL_PICK',
          'LUCKY_DRAW_WIN',
          'LUCKY_DRAW_MISS',
          'AUTO_REMAINDER',
        }),
        teamName: _string(json['teamName']),
        selectedDisplayName: _string(json['selectedDisplayName']),
      );
}

class ClubTeamResult {
  const ClubTeamResult({
    required this.competitionTeamId,
    required this.name,
    required this.finalRank,
    required this.totalPoints,
    required this.rawPins,
    required this.effectivePins,
    required this.memberCount,
    required this.teamHandicap,
    required this.appliedPins,
    this.seasonPoint,
  });
  final String competitionTeamId;
  final String name;
  final int? finalRank;
  final int totalPoints;
  final int rawPins;
  final int effectivePins;
  final int memberCount;
  final int teamHandicap;
  final int appliedPins;
  final int? seasonPoint;
  factory ClubTeamResult.fromJson(Map<String, dynamic> json) => ClubTeamResult(
    competitionTeamId: _string(json['competitionTeamId']),
    name: _string(json['name']),
    finalRank: (json['finalRank'] ?? json['finalRankPreview']) == null
        ? null
        : _positiveInt(json['finalRank'] ?? json['finalRankPreview']),
    totalPoints: _nonNegativeInt(json['totalPoints']),
    rawPins: _nonNegativeInt(json['rawPins']),
    effectivePins: _nonNegativeInt(json['effectivePins']),
    memberCount: _positiveInt(json['memberCount']),
    teamHandicap: _nonNegativeInt(json['teamHandicap']),
    appliedPins: _nonNegativeInt(json['appliedPins'] ?? json['effectivePins']),
    seasonPoint: _nullableNonNegativeInt(
      json['seasonPoint'] ?? json['seasonPointPreview'],
    ),
  );
}

class ClubTeamIndividualResult {
  const ClubTeamIndividualResult({
    required this.rank,
    required this.memberId,
    required this.guestId,
    required this.name,
    required this.competitionTeamId,
    required this.scores,
    required this.total,
    required this.average,
  });
  final int rank;
  final String? memberId;
  final String? guestId;
  final String name;
  final String competitionTeamId;
  final List<int> scores;
  final int total;
  final double? average;

  factory ClubTeamIndividualResult.fromJson(Map<String, dynamic> json) {
    final Object? rawScores = json['scores'];
    final Object? average = json['average'];
    if (rawScores is! List ||
        rawScores.any((score) => score is! int || score < 0 || score > 300) ||
        (average != null && average is! num)) {
      throw const FormatException('Invalid individual team result.');
    }
    return ClubTeamIndividualResult(
      rank: _positiveInt(json['rank']),
      memberId: json['memberId'] as String?,
      guestId: json['guestId'] as String?,
      name: _string(json['name']),
      competitionTeamId: _string(json['competitionTeamId']),
      scores: List<int>.unmodifiable(rawScores.cast<int>()),
      total: _nonNegativeInt(json['total']),
      average: average == null ? null : (average as num).toDouble(),
    );
  }
}

class ClubTeamGameResult {
  const ClubTeamGameResult({
    required this.competitionTeamId,
    required this.teamName,
    required this.complete,
    required this.rawTeamTotal,
    required this.excludedScores,
    required this.normalizedTeamTotal,
    required this.teamHandicap,
    required this.handicapAppliedTotal,
    required this.rank,
    required this.points,
  });
  final String competitionTeamId;
  final String teamName;
  final bool complete;
  final int? rawTeamTotal;
  final List<int> excludedScores;
  final int? normalizedTeamTotal;
  final int? teamHandicap;
  final int? handicapAppliedTotal;
  final int? rank;
  final int? points;

  factory ClubTeamGameResult.fromJson(Map<String, dynamic> json) {
    final Object? excluded = json['excludedScores'];
    if (json['complete'] is! bool ||
        excluded is! List ||
        excluded.any((score) => score is! int || score < 0 || score > 300)) {
      throw const FormatException('Invalid game team result.');
    }
    return ClubTeamGameResult(
      competitionTeamId: _string(json['teamId']),
      teamName: _string(json['teamName']),
      complete: json['complete'] as bool,
      rawTeamTotal: _nullableNonNegativeInt(json['rawTeamTotal']),
      excludedScores: List<int>.unmodifiable(excluded.cast<int>()),
      normalizedTeamTotal: _nullableNonNegativeInt(json['normalizedTeamTotal']),
      teamHandicap: _nullableNonNegativeInt(json['teamHandicap']),
      handicapAppliedTotal: _nullableNonNegativeInt(
        json['handicapAppliedTotal'],
      ),
      rank: _nullablePositiveInt(json['rank']),
      points: _nullableNonNegativeInt(json['points']),
    );
  }
}

class ClubTeamGame {
  const ClubTeamGame({
    required this.gameNumber,
    required this.complete,
    required this.teams,
  });
  final int gameNumber;
  final bool complete;
  final List<ClubTeamGameResult> teams;

  factory ClubTeamGame.fromJson(Map<String, dynamic> json) {
    if (json['complete'] is! bool) {
      throw const FormatException('Invalid team game.');
    }
    return ClubTeamGame(
      gameNumber: _positiveInt(json['gameNumber']),
      complete: json['complete'] as bool,
      teams: _list(json['teams'], ClubTeamGameResult.fromJson),
    );
  }
}

class ClubTeamCompetitionResults {
  const ClubTeamCompetitionResults({
    required this.complete,
    required this.requiresPinTieBreakPolicy,
    required this.effectivePlayerCount,
    required this.individual,
    required this.games,
    required this.teams,
  });
  final bool complete;
  final bool requiresPinTieBreakPolicy;
  final int? effectivePlayerCount;
  final List<ClubTeamIndividualResult> individual;
  final List<ClubTeamGame> games;
  final List<ClubTeamResult> teams;
  factory ClubTeamCompetitionResults.fromJson(Map<String, dynamic> json) {
    if (json['complete'] is! bool ||
        json['requiresPinTieBreakPolicy'] is! bool) {
      throw const FormatException('Invalid team results.');
    }
    return ClubTeamCompetitionResults(
      complete: json['complete'] as bool,
      requiresPinTieBreakPolicy: json['requiresPinTieBreakPolicy'] as bool,
      effectivePlayerCount: _nullablePositiveInt(json['effectivePlayerCount']),
      individual: _list(
        json['individual'] ?? const <Object>[],
        ClubTeamIndividualResult.fromJson,
      ),
      games: _list(json['games'] ?? const <Object>[], ClubTeamGame.fromJson),
      teams: _list(json['teams'], ClubTeamResult.fromJson),
    );
  }
}

class ClubTeamCompetitionState {
  const ClubTeamCompetitionState({
    required this.generation,
    required this.status,
    required this.canManage,
    required this.isCurrentCaptain,
    required this.currentTurn,
    required this.teams,
    required this.remainingParticipants,
    required this.history,
    required this.myTeam,
    required this.results,
  });
  final int generation;
  final String status;
  final bool canManage;
  final bool isCurrentCaptain;
  final ClubDraftTurn? currentTurn;
  final List<ClubCompetitionTeam> teams;
  final List<ClubTeamCompetitionParticipant> remainingParticipants;
  final List<ClubDraftHistoryItem> history;
  final String? myTeam;
  final ClubTeamCompetitionResults results;

  bool get polling => status == 'DRAFT_IN_PROGRESS' || status == 'LUCKY_DRAW';

  factory ClubTeamCompetitionState.fromJson(Map<String, dynamic> json) {
    const Set<String> statuses = <String>{
      'ATTENDANCE_OPEN',
      'ATTENDANCE_LOCKED',
      'DRAFT_READY',
      'DRAFT_IN_PROGRESS',
      'LUCKY_DRAW',
      'TEAMS_FINALIZED',
      'LANES_ASSIGNED',
      'PUBLISHED',
    };
    if (json['generation'] is! int ||
        (json['generation'] as int) < 1 ||
        !statuses.contains(json['status']) ||
        json['canManage'] is! bool ||
        json['isCurrentCaptain'] is! bool ||
        (json['myTeam'] != null && json['myTeam'] is! String)) {
      throw const FormatException('Invalid team competition state.');
    }
    return ClubTeamCompetitionState(
      generation: json['generation'] as int,
      status: json['status'] as String,
      canManage: json['canManage'] as bool,
      isCurrentCaptain: json['isCurrentCaptain'] as bool,
      currentTurn: json['currentTurn'] == null
          ? null
          : ClubDraftTurn.fromJson(_map(json['currentTurn'])),
      teams: _list(json['teams'], ClubCompetitionTeam.fromJson),
      remainingParticipants: _list(
        json['remainingParticipants'],
        ClubTeamCompetitionParticipant.fromJson,
      ),
      history: _list(json['history'], ClubDraftHistoryItem.fromJson),
      myTeam: json['myTeam'] as String?,
      results: ClubTeamCompetitionResults.fromJson(_map(json['results'])),
    );
  }
}

Map<String, dynamic> _map(Object? value) {
  if (value is! Map) throw const FormatException('Invalid object.');
  return Map<String, dynamic>.from(value);
}

List<T> _list<T>(Object? value, T Function(Map<String, dynamic>) parse) {
  if (value is! List) throw const FormatException('Invalid list.');
  return List<T>.unmodifiable(value.map((Object? item) => parse(_map(item))));
}

String _string(Object? value) {
  if (value is! String || value.isEmpty) {
    throw const FormatException('Invalid string.');
  }
  return value;
}

String _enumString(Object? value, Set<String> allowed) {
  final String result = _string(value);
  if (!allowed.contains(result)) {
    throw const FormatException('Invalid enum value.');
  }
  return result;
}

int _positiveInt(Object? value) {
  if (value is! int || value < 1) {
    throw const FormatException('Invalid integer.');
  }
  return value;
}

int _nonNegativeInt(Object? value) {
  if (value is! int || value < 0) {
    throw const FormatException('Invalid integer.');
  }
  return value;
}

int? _nullablePositiveInt(Object? value) {
  if (value == null) return null;
  return _positiveInt(value);
}

int? _nullableNonNegativeInt(Object? value) {
  if (value == null) return null;
  return _nonNegativeInt(value);
}
