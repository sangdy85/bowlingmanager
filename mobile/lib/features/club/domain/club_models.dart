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
    this.bowlerHiddenEnabled = false,
  });

  final String id;
  final String name;
  final ClubRole myRole;
  final int memberCount;
  final bool bowlerHiddenEnabled;

  factory ClubDetail.fromJson(Map<String, dynamic> json) {
    final ClubSummary summary = ClubSummary.fromJson(json);
    return ClubDetail(
      id: summary.id,
      name: summary.name,
      myRole: summary.myRole,
      memberCount: summary.memberCount,
      bowlerHiddenEnabled: summary.bowlerHiddenEnabled,
    );
  }
}

class ClubMember {
  const ClubMember({
    required this.id,
    required this.name,
    required this.role,
    required this.handicap,
  });

  final String id;
  final String name;
  final ClubRole role;
  final int? handicap;

  factory ClubMember.fromJson(Map<String, dynamic> json) {
    final Object? id = json['id'];
    final Object? name = json['name'];
    final Object? handicap = json['handicap'];
    if (id is! String ||
        id.isEmpty ||
        name is! String ||
        name.isEmpty ||
        (handicap != null && handicap is! int)) {
      throw const FormatException('Invalid club member response.');
    }
    return ClubMember(
      id: id,
      name: name,
      role: ClubRole.fromJson(json['role']),
      handicap: handicap as int?,
    );
  }
}
