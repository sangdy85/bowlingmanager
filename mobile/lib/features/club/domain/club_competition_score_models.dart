class ClubCompetitionScoreParticipant {
  const ClubCompetitionScoreParticipant({
    required this.participantId,
    required this.participantKind,
    required this.memberId,
    required this.guestId,
    required this.name,
    required this.group,
    required this.competitionTeamName,
    required this.scores,
  });

  final String participantId;
  final String participantKind;
  final String? memberId;
  final String? guestId;
  final String name;
  final String? group;
  final String? competitionTeamName;
  final List<int> scores;

  factory ClubCompetitionScoreParticipant.fromJson(Map<String, dynamic> json) {
    final Object? scores = json['scores'];
    if (json['participantId'] is! String ||
        !const <String>{'MEMBER', 'GUEST'}.contains(json['participantKind']) ||
        json['name'] is! String ||
        scores is! List ||
        scores.any((value) => value is! int || value < 0 || value > 300)) {
      throw const FormatException('Invalid competition score participant.');
    }
    return ClubCompetitionScoreParticipant(
      participantId: json['participantId'] as String,
      participantKind: json['participantKind'] as String,
      memberId: json['memberId'] as String?,
      guestId: json['guestId'] as String?,
      name: json['name'] as String,
      group: json['group'] as String?,
      competitionTeamName: json['competitionTeamName'] as String?,
      scores: List<int>.unmodifiable(scores.cast<int>()),
    );
  }
}

class ClubCompetitionScoreEntry {
  const ClubCompetitionScoreEntry({
    required this.eventId,
    required this.teamName,
    required this.title,
    required this.date,
    required this.gameType,
    required this.competitionType,
    required this.competitionMode,
    required this.status,
    required this.gameCount,
    required this.readOnly,
    required this.participants,
  });

  final String eventId;
  final String teamName;
  final String title;
  final String date;
  final String? gameType;
  final String competitionType;
  final String? competitionMode;
  final String status;
  final int gameCount;
  final bool readOnly;
  final List<ClubCompetitionScoreParticipant> participants;

  factory ClubCompetitionScoreEntry.fromJson(Map<String, dynamic> json) {
    final Object? event = json['event'];
    final Object? participants = json['participants'];
    if (event is! Map ||
        participants is! List ||
        json['gameCount'] is! int ||
        (json['gameCount'] as int) < 1 ||
        json['readOnly'] is! bool) {
      throw const FormatException('Invalid competition score entry.');
    }
    final Map<String, dynamic> eventJson = Map<String, dynamic>.from(event);
    if (eventJson['id'] is! String ||
        eventJson['teamName'] is! String ||
        eventJson['title'] is! String ||
        eventJson['date'] is! String ||
        eventJson['competitionType'] is! String ||
        eventJson['status'] is! String) {
      throw const FormatException('Invalid competition score event.');
    }
    return ClubCompetitionScoreEntry(
      eventId: eventJson['id'] as String,
      teamName: eventJson['teamName'] as String,
      title: eventJson['title'] as String,
      date: eventJson['date'] as String,
      gameType: eventJson['gameType'] as String?,
      competitionType: eventJson['competitionType'] as String,
      competitionMode: eventJson['competitionMode'] as String?,
      status: eventJson['status'] as String,
      gameCount: json['gameCount'] as int,
      readOnly: json['readOnly'] as bool,
      participants: List<ClubCompetitionScoreParticipant>.unmodifiable(
        participants.map(
          (value) => ClubCompetitionScoreParticipant.fromJson(
            Map<String, dynamic>.from(value as Map),
          ),
        ),
      ),
    );
  }
}
