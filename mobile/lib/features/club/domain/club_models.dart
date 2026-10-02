enum ClubRole {
  owner('OWNER', '팀장'),
  manager('MANAGER', '매니저'),
  member('MEMBER', '회원');

  const ClubRole(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static ClubRole fromJson(Object? value) {
    for (final ClubRole role in ClubRole.values) {
      if (role.apiValue == value) return role;
    }
    throw const FormatException('Invalid club role response.');
  }
}

class ClubSummary {
  const ClubSummary({
    required this.id,
    required this.name,
    required this.myRole,
    required this.memberCount,
    this.bowlerHiddenEnabled = false,
  });

  final String id;
  final String name;
  final ClubRole myRole;
  final int memberCount;
  final bool bowlerHiddenEnabled;

  factory ClubSummary.fromJson(Map<String, dynamic> json) {
    final Object? id = json['id'];
    final Object? name = json['name'];
    final Object? memberCount = json['memberCount'];
    final Object? bowlerHiddenEnabled = json['bowlerHiddenEnabled'] ?? false;
    if (id is! String ||
        id.isEmpty ||
        name is! String ||
        name.isEmpty ||
        memberCount is! int ||
        memberCount < 0 ||
        bowlerHiddenEnabled is! bool) {
      throw const FormatException('Invalid club summary response.');
    }
    return ClubSummary(
      id: id,
      name: name,
      myRole: ClubRole.fromJson(json['myRole']),
      memberCount: memberCount,
      bowlerHiddenEnabled: bowlerHiddenEnabled,
    );
  }
}

class ClubDetail {
  const ClubDetail({
    required this.id,
    required this.name,
    required this.myRole,
    required this.memberCount,
    this.inviteUrl,
    this.bowlerHiddenEnabled = false,
  });

  final String id;
  final String name;
  final ClubRole myRole;
  final int memberCount;
  final Uri? inviteUrl;
  final bool bowlerHiddenEnabled;

  factory ClubDetail.fromJson(Map<String, dynamic> json) {
    final ClubSummary summary = ClubSummary.fromJson(json);
    final Object? inviteUrl = json['inviteUrl'];
    final Uri? parsedInviteUrl = inviteUrl is String
        ? Uri.tryParse(inviteUrl)
        : null;
    if (parsedInviteUrl == null ||
        parsedInviteUrl.scheme != 'https' ||
        parsedInviteUrl.host.isEmpty) {
      throw const FormatException('Invalid club invite URL response.');
    }
    return ClubDetail(
      id: summary.id,
      name: summary.name,
      myRole: summary.myRole,
      memberCount: summary.memberCount,
      inviteUrl: parsedInviteUrl,
      bowlerHiddenEnabled: summary.bowlerHiddenEnabled,
    );
  }
}

class ClubJoinResult {
  const ClubJoinResult({
    required this.team,
    required this.joined,
    required this.alreadyMember,
  });

  final ClubSummary team;
  final bool joined;
  final bool alreadyMember;

  factory ClubJoinResult.fromJson(Map<String, dynamic> json) {
    final Object? team = json['team'];
    final Object? joined = json['joined'];
    final Object? alreadyMember = json['alreadyMember'];
    if (team is! Map ||
        joined is! bool ||
        alreadyMember is! bool ||
        joined == alreadyMember) {
      throw const FormatException('Invalid club join response.');
    }
    return ClubJoinResult(
      team: ClubSummary.fromJson(Map<String, dynamic>.from(team)),
      joined: joined,
      alreadyMember: alreadyMember,
    );
  }
}

String buildClubInviteShareText(ClubDetail club) =>
    '${club.name} 동호회에 초대합니다 🎳\n\n'
    'BowlingManager에서 일정, 정모 기록과 시즌 순위를 함께 확인하세요.\n\n'
    '${club.inviteUrl ?? ''}';

class ClubMember {
  const ClubMember({
    required this.id,
    required this.name,
    required this.role,
    required this.handicap,
    this.blindAt,
  });

  final String id;
  final String name;
  final ClubRole role;
  final int? handicap;
  final DateTime? blindAt;
  bool get isBlinded => blindAt != null;

  factory ClubMember.fromJson(Map<String, dynamic> json) {
    final Object? id = json['id'];
    final Object? name = json['name'];
    final Object? handicap = json['handicap'];
    final Object? blindAt = json['blindAt'];
    if (id is! String ||
        id.isEmpty ||
        name is! String ||
        name.isEmpty ||
        (handicap != null && handicap is! int) ||
        (blindAt != null && blindAt is! String)) {
      throw const FormatException('Invalid club member response.');
    }
    final DateTime? parsedBlindAt = blindAt == null
        ? null
        : DateTime.tryParse(blindAt as String);
    if (blindAt != null && parsedBlindAt == null) {
      throw const FormatException('Invalid club member response.');
    }
    return ClubMember(
      id: id,
      name: name,
      role: ClubRole.fromJson(json['role']),
      handicap: handicap as int?,
      blindAt: parsedBlindAt,
    );
  }
}
