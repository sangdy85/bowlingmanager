class ClubEventCompetitionParticipant {
  const ClubEventCompetitionParticipant({
    required this.participantId,
    required this.memberId,
    required this.name,
  });
  final String participantId;
  final String memberId;
  final String name;
  factory ClubEventCompetitionParticipant.fromJson(Map<String, dynamic> json) =>
      ClubEventCompetitionParticipant(
        participantId: _string(json['participantId']),
        memberId: _string(json['memberId']),
        name: _string(json['name']),
      );
}

class ClubEventVotingState {
  const ClubEventVotingState({
    required this.submittedCount,
    required this.pendingCount,
    required this.mySelections,
  });
  final int submittedCount;
  final int pendingCount;
  final List<String> mySelections;
  factory ClubEventVotingState.fromJson(Map<String, dynamic> json) =>
      ClubEventVotingState(
        submittedCount: _nonNegativeInt(json['submittedCount']),
        pendingCount: _nonNegativeInt(json['pendingCount']),
        mySelections: _stringList(json['mySelections']),
      );
}

class ClubEventRevealRow {
  const ClubEventRevealRow({
    required this.name,
    required this.actualScore,
    required this.voteCount,
    required this.shareScore,
    required this.voterNames,
  });
  final String name;
  final int actualScore;
  final int voteCount;
  final double? shareScore;
  final List<String> voterNames;
  factory ClubEventRevealRow.fromJson(Map<String, dynamic> json) =>
      ClubEventRevealRow(
        name: _string(json['name']),
        actualScore: _nonNegativeInt(json['actualScore']),
        voteCount: _nonNegativeInt(json['voteCount']),
        shareScore: _nullableNumber(json['shareScore']),
        voterNames: _stringList(json['voterNames']),
      );
}

class ClubEventRevealState {
  const ClubEventRevealState({
    required this.revealedCount,
    required this.totalCount,
    required this.revealed,
    required this.nextName,
  });
  final int revealedCount;
  final int totalCount;
  final List<ClubEventRevealRow> revealed;
  final String? nextName;
  factory ClubEventRevealState.fromJson(Map<String, dynamic> json) =>
      ClubEventRevealState(
        revealedCount: _nonNegativeInt(json['revealedCount']),
        totalCount: _nonNegativeInt(json['totalCount']),
        revealed: _list(
          json['revealed'] ?? const <Object>[],
          ClubEventRevealRow.fromJson,
        ),
        nextName: json['nextName'] == null ? null : _string(json['nextName']),
      );
}

class ClubEventResultSelection {
  const ClubEventResultSelection({
    required this.participantId,
    required this.name,
    required this.shareScore,
  });
  final String participantId;
  final String? name;
  final double? shareScore;
  factory ClubEventResultSelection.fromJson(Map<String, dynamic> json) =>
      ClubEventResultSelection(
        participantId: _string(json['participantId']),
        name: json['name'] == null ? null : _string(json['name']),
        shareScore: _nullableNumber(json['shareScore']),
      );
}

class ClubEventResultRow {
  const ClubEventResultRow({
    required this.rank,
    required this.name,
    required this.actualScore,
    required this.voteCount,
    required this.shareScore,
    required this.voteBonus,
    required this.finalScore,
    required this.seasonPoint,
    required this.selections,
  });
  final int? rank;
  final String name;
  final int actualScore;
  final int voteCount;
  final double? shareScore;
  final double voteBonus;
  final double finalScore;
  final int seasonPoint;
  final List<ClubEventResultSelection> selections;
  factory ClubEventResultRow.fromJson(Map<String, dynamic> json) =>
      ClubEventResultRow(
        rank: json['rank'] == null ? null : _positiveInt(json['rank']),
        name: _string(json['name']),
        actualScore: _nonNegativeInt(json['actualScore']),
        voteCount: _nonNegativeInt(json['voteCount']),
        shareScore: _nullableNumber(json['shareScore']),
        voteBonus: _number(json['voteBonus']),
        finalScore: _number(json['finalScore']),
        seasonPoint: _nonNegativeInt(json['seasonPoint']),
        selections: _list(
          json['selections'] ?? const <Object>[],
          ClubEventResultSelection.fromJson,
        ),
      );
}

class ClubEventCompetitionState {
  const ClubEventCompetitionState({
    required this.status,
    required this.canManage,
    required this.isParticipant,
    required this.myParticipantId,
    required this.voteOpenAt,
    required this.voteCloseAt,
    required this.serverNow,
    required this.gameCount,
    required this.participants,
    required this.voting,
    required this.scoreComplete,
    required this.reveal,
    required this.finalPreview,
    required this.ranking,
    required this.myResult,
  });
  final String status;
  final bool canManage;
  final bool isParticipant;
  final String? myParticipantId;
  final DateTime? voteOpenAt;
  final DateTime? voteCloseAt;
  final DateTime? serverNow;
  final int? gameCount;
  final List<ClubEventCompetitionParticipant> participants;
  final ClubEventVotingState? voting;
  final bool? scoreComplete;
  final ClubEventRevealState? reveal;
  final List<ClubEventResultRow>? finalPreview;
  final List<ClubEventResultRow>? ranking;
  final ClubEventResultRow? myResult;

  bool get polling => const <String>{
    'VOTING_OPEN',
    'REVEALING',
    'FINAL_READY',
  }.contains(status);

  factory ClubEventCompetitionState.fromJson(Map<String, dynamic> json) {
    const statuses = <String>{
      'ATTENDANCE_OPEN',
      'EVENT_READY',
      'SCHEDULED',
      'VOTING_OPEN',
      'VOTING_CLOSED',
      'REVEALING',
      'FINAL_READY',
      'PUBLISHED',
    };
    if (!statuses.contains(json['status']) ||
        json['canManage'] is! bool ||
        json['isParticipant'] is! bool ||
        (json['myParticipantId'] != null &&
            json['myParticipantId'] is! String) ||
        (json['scoreComplete'] != null && json['scoreComplete'] is! bool)) {
      throw const FormatException('Invalid event competition state.');
    }
    return ClubEventCompetitionState(
      status: json['status'] as String,
      canManage: json['canManage'] as bool,
      isParticipant: json['isParticipant'] as bool,
      myParticipantId: json['myParticipantId'] as String?,
      voteOpenAt: _date(json['voteOpenAt']),
      voteCloseAt: _date(json['voteCloseAt']),
      serverNow: _date(json['serverNow']),
      gameCount: json['gameCount'] == null
          ? null
          : _positiveInt(json['gameCount']),
      participants: _list(
        json['participants'] ?? const <Object>[],
        ClubEventCompetitionParticipant.fromJson,
      ),
      voting: json['voting'] == null
          ? null
          : ClubEventVotingState.fromJson(_map(json['voting'])),
      scoreComplete: json['scoreComplete'] as bool?,
      reveal: json['reveal'] == null
          ? null
          : ClubEventRevealState.fromJson(_map(json['reveal'])),
      finalPreview: json['finalPreview'] == null
          ? null
          : _list(json['finalPreview'], ClubEventResultRow.fromJson),
      ranking: json['ranking'] == null
          ? null
          : _list(json['ranking'], ClubEventResultRow.fromJson),
      myResult: json['myResult'] == null
          ? null
          : ClubEventResultRow.fromJson(_map(json['myResult'])),
    );
  }
}

Map<String, dynamic> _map(Object? value) {
  if (value is! Map) throw const FormatException('Invalid object.');
  return Map<String, dynamic>.from(value);
}

List<T> _list<T>(Object? value, T Function(Map<String, dynamic>) parser) {
  if (value is! List) {
    throw const FormatException('Invalid list.');
  }
  return List<T>.unmodifiable(value.map((item) => parser(_map(item))));
}

String _string(Object? value) {
  if (value is! String || value.isEmpty) {
    throw const FormatException('Invalid string.');
  }
  return value;
}

List<String> _stringList(Object? value) {
  if (value is! List || value.any((item) => item is! String || item.isEmpty)) {
    throw const FormatException('Invalid string list.');
  }
  return List<String>.unmodifiable(value.cast<String>());
}

int _nonNegativeInt(Object? value) {
  if (value is! int || value < 0) {
    throw const FormatException('Invalid integer.');
  }
  return value;
}

int _positiveInt(Object? value) {
  if (value is! int || value < 1) {
    throw const FormatException('Invalid integer.');
  }
  return value;
}

double _number(Object? value) {
  if (value is! num || !value.isFinite || value < 0) {
    throw const FormatException('Invalid number.');
  }
  return value.toDouble();
}

double? _nullableNumber(Object? value) => value == null ? null : _number(value);
DateTime? _date(Object? value) {
  if (value == null) return null;
  if (value is! String) throw const FormatException('Invalid date.');
  return DateTime.tryParse(value) ??
      (throw const FormatException('Invalid date.'));
}
