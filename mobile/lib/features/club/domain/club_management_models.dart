import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';

const List<String> clubGameTypes = <String>['정기전', '벙개', '상주', '교류전', '기타'];

class ClubScoreDraft {
  const ClubScoreDraft({this.id, required this.value});

  final String? id;
  final int value;

  factory ClubScoreDraft.fromJson(Map<String, dynamic> json) {
    final Object? id = json['id'];
    final Object? score = json['score'];
    if (id is! String ||
        id.isEmpty ||
        score is! int ||
        score < 0 ||
        score > 300) {
      throw const FormatException('Invalid editable score response.');
    }
    return ClubScoreDraft(id: id, value: score);
  }
}

class ClubParticipantDraft {
  const ClubParticipantDraft({
    required this.memberId,
    required this.name,
    required this.scores,
  });

  final String? memberId;
  final String name;
  final List<ClubScoreDraft> scores;

  factory ClubParticipantDraft.fromJson(Map<String, dynamic> json) {
    final Object? memberId = json['memberId'];
    final Object? name = json['name'];
    final Object? scores = json['scores'];
    if ((memberId != null && memberId is! String) ||
        name is! String ||
        name.isEmpty ||
        scores is! List ||
        scores.isEmpty) {
      throw const FormatException('Invalid editable participant response.');
    }
    return ClubParticipantDraft(
      memberId: memberId as String?,
      name: name,
      scores: List<ClubScoreDraft>.unmodifiable(
        scores.map((Object? value) {
          if (value is! Map) {
            throw const FormatException('Invalid editable score response.');
          }
          return ClubScoreDraft.fromJson(Map<String, dynamic>.from(value));
        }),
      ),
    );
  }

  Map<String, dynamic> toMutationJson() => <String, dynamic>{
    'memberId': memberId,
    'name': name,
    'scores': scores.map((ClubScoreDraft score) => score.value).toList(),
  };
}

class ClubActivityEdit {
  const ClubActivityEdit({
    required this.id,
    required this.revision,
    required this.date,
    required this.gameType,
    required this.memo,
    required this.scoreCount,
    required this.participants,
  });

  final String id;
  final String revision;
  final String date;
  final String gameType;
  final String? memo;
  final int scoreCount;
  final List<ClubParticipantDraft> participants;

  factory ClubActivityEdit.fromJson(Map<String, dynamic> json) {
    final Object? id = json['id'];
    final Object? revision = json['revision'];
    final Object? date = json['date'];
    final Object? gameType = json['gameType'];
    final Object? memo = json['memo'];
    final Object? scoreCount = json['scoreCount'];
    final Object? participants = json['participants'];
    if (id is! String ||
        id.isEmpty ||
        revision is! String ||
        revision.isEmpty ||
        date is! String ||
        date.isEmpty ||
        gameType is! String ||
        !clubGameTypes.contains(gameType) ||
        (memo != null && memo is! String) ||
        scoreCount is! int ||
        scoreCount < 1 ||
        participants is! List ||
        participants.isEmpty) {
      throw const FormatException('Invalid editable activity response.');
    }
    return ClubActivityEdit(
      id: id,
      revision: revision,
      date: date,
      gameType: gameType,
      memo: memo as String?,
      scoreCount: scoreCount,
      participants: List<ClubParticipantDraft>.unmodifiable(
        participants.map((Object? value) {
          if (value is! Map) {
            throw const FormatException(
              'Invalid editable participant response.',
            );
          }
          return ClubParticipantDraft.fromJson(
            Map<String, dynamic>.from(value),
          );
        }),
      ),
    );
  }
}

class ClubActivityEditEnvelope {
  const ClubActivityEditEnvelope({required this.role, required this.activity});

  final ClubRole role;
  final ClubActivityEdit activity;

  factory ClubActivityEditEnvelope.fromJson(Map<String, dynamic> json) {
    final Object? activity = json['activity'];
    if (activity is! Map) {
      throw const FormatException('Invalid editable activity response.');
    }
    return ClubActivityEditEnvelope(
      role: ClubRole.fromJson(json['role']),
      activity: ClubActivityEdit.fromJson(Map<String, dynamic>.from(activity)),
    );
  }
}

class ClubWriteResult {
  const ClubWriteResult({this.activityId, this.changedCount});

  final String? activityId;
  final int? changedCount;
}

class ManualParticipantDraft {
  ManualParticipantDraft({required this.member, List<String>? scores})
    : scores = scores ?? <String>[''];

  final ClubMember? member;
  final List<String> scores;
  String guestName = '';

  String get name => member?.name ?? guestName.trim();
  String? get memberId => member?.id;
}
