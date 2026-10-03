import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';

class ClubEventAdminParticipant {
  const ClubEventAdminParticipant({
    required this.id,
    required this.name,
    required this.memberId,
    required this.assignmentType,
  });

  final String id;
  final String name;
  final String? memberId;
  final String? assignmentType;

  factory ClubEventAdminParticipant.fromJson(Map<String, dynamic> json) =>
      ClubEventAdminParticipant(
        id: json['participantId'] as String,
        name: json['name'] as String,
        memberId: json['memberId'] as String?,
        assignmentType: json['assignmentType'] as String?,
      );
}

class ClubEventAdminTeam {
  const ClubEventAdminTeam({
    required this.id,
    required this.name,
    required this.captainMemberId,
    required this.members,
  });

  final String id;
  final String name;
  final String captainMemberId;
  final List<ClubEventAdminParticipant> members;

  factory ClubEventAdminTeam.fromJson(Map<String, dynamic> json) =>
      ClubEventAdminTeam(
        id: json['id'] as String,
        name: json['name'] as String,
        captainMemberId: json['captainMemberId'] as String,
        members: _maps(json['members'])
            .map(ClubEventAdminParticipant.fromJson)
            .toList(growable: false),
      );
}

class ClubEventAdminVoter {
  const ClubEventAdminVoter({
    required this.id,
    required this.name,
    required this.hasBallot,
  });

  final String id;
  final String name;
  final bool hasBallot;

  factory ClubEventAdminVoter.fromJson(Map<String, dynamic> json) =>
      ClubEventAdminVoter(
        id: json['participantId'] as String,
        name: json['name'] as String,
        hasBallot: json['hasBallot'] == true,
      );
}

class ClubEventAdminAudit {
  const ClubEventAdminAudit({
    required this.id,
    required this.action,
    required this.beforeStatus,
    required this.afterStatus,
    required this.createdAt,
  });

  final String id;
  final String action;
  final String? beforeStatus;
  final String? afterStatus;
  final DateTime createdAt;

  factory ClubEventAdminAudit.fromJson(Map<String, dynamic> json) =>
      ClubEventAdminAudit(
        id: json['id'] as String,
        action: json['action'] as String,
        beforeStatus: json['beforeStatus'] as String?,
        afterStatus: json['afterStatus'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

class ClubEventAdminState {
  const ClubEventAdminState({
    required this.eventId,
    required this.title,
    required this.competitionType,
    required this.competitionStatus,
    required this.laneDrawStatus,
    required this.gameCount,
    required this.teamGamePointTables,
    required this.scoreCount,
    required this.activePublicationCount,
    required this.financeLinkCount,
    required this.generation,
    required this.teams,
    required this.unassignedParticipants,
    required this.eventParticipants,
    required this.audits,
  });

  final String eventId;
  final String title;
  final String? competitionType;
  final String? competitionStatus;
  final String laneDrawStatus;
  final int? gameCount;
  final List<ClubTeamGamePointTable> teamGamePointTables;
  final int scoreCount;
  final int activePublicationCount;
  final int financeLinkCount;
  final int generation;
  final List<ClubEventAdminTeam> teams;
  final List<ClubEventAdminParticipant> unassignedParticipants;
  final List<ClubEventAdminVoter> eventParticipants;
  final List<ClubEventAdminAudit> audits;

  bool get isPublished => competitionStatus == 'PUBLISHED';

  factory ClubEventAdminState.fromJson(Map<String, dynamic> json) =>
      ClubEventAdminState(
        eventId: json['eventId'] as String,
        title: json['title'] as String,
        competitionType: json['competitionType'] as String?,
        competitionStatus: json['competitionStatus'] as String?,
        laneDrawStatus: json['laneDrawStatus'] as String,
        gameCount: json['gameCount'] as int?,
        teamGamePointTables: _maps(json['teamGamePointTables'])
            .map(ClubTeamGamePointTable.fromJson)
            .toList(growable: false),
        scoreCount: json['scoreCount'] as int,
        activePublicationCount: json['activePublicationCount'] as int,
        financeLinkCount: json['financeLinkCount'] as int,
        generation: json['generation'] as int,
        teams: _maps(json['teams'])
            .map(ClubEventAdminTeam.fromJson)
            .toList(growable: false),
        unassignedParticipants: _maps(json['unassignedParticipants'])
            .map(ClubEventAdminParticipant.fromJson)
            .toList(growable: false),
        eventParticipants: _maps(json['eventParticipants'])
            .map(ClubEventAdminVoter.fromJson)
            .toList(growable: false),
        audits: _maps(json['audits'])
            .map(ClubEventAdminAudit.fromJson)
            .toList(growable: false),
      );
}

Iterable<Map<String, dynamic>> _maps(Object? value) sync* {
  if (value is! List) return;
  for (final item in value) {
    if (item is Map) yield Map<String, dynamic>.from(item);
  }
}
