class ClubLegacyImportRow {
  const ClubLegacyImportRow({
    required this.memberId,
    required this.points,
    this.eventDate,
    this.competitionType,
    this.placement,
    this.note,
  });

  final String memberId;
  final int points;
  final String? eventDate;
  final String? competitionType;
  final int? placement;
  final String? note;

  Map<String, Object?> toJson() => <String, Object?>{
    'memberId': memberId,
    'points': points,
    'eventDate': eventDate,
    'competitionType': competitionType,
    'placement': placement,
    'note': note,
  };
}

class ClubLegacyMemberChange {
  const ClubLegacyMemberChange({
    required this.memberId,
    required this.memberName,
    required this.previousPoints,
    required this.importedPoints,
    required this.totalPoints,
  });
  final String memberId;
  final String memberName;
  final int previousPoints;
  final int importedPoints;
  final int totalPoints;

  factory ClubLegacyMemberChange.fromJson(Map<String, dynamic> json) {
    if (json['memberId'] is! String ||
        json['memberName'] is! String ||
        json['previousPoints'] is! int ||
        json['importedPoints'] is! int ||
        json['totalPoints'] is! int) {
      throw const FormatException('Invalid legacy member change.');
    }
    return ClubLegacyMemberChange(
      memberId: json['memberId'] as String,
      memberName: json['memberName'] as String,
      previousPoints: json['previousPoints'] as int,
      importedPoints: json['importedPoints'] as int,
      totalPoints: json['totalPoints'] as int,
    );
  }
}

class ClubLegacyImportPreview {
  const ClubLegacyImportPreview({
    required this.mode,
    required this.importHash,
    required this.totalRows,
    required this.totalPoints,
    required this.memberChanges,
  });
  final String mode;
  final String importHash;
  final int totalRows;
  final int totalPoints;
  final List<ClubLegacyMemberChange> memberChanges;

  factory ClubLegacyImportPreview.fromJson(Map<String, dynamic> json) {
    final summary = _map(json['summary']);
    final changes = json['memberChanges'];
    if (!const <String>{'DETAILED', 'OPENING_BALANCE'}.contains(json['mode']) ||
        json['importHash'] is! String ||
        summary['totalRows'] is! int ||
        summary['totalPoints'] is! int ||
        changes is! List) {
      throw const FormatException('Invalid legacy import preview.');
    }
    return ClubLegacyImportPreview(
      mode: json['mode'] as String,
      importHash: json['importHash'] as String,
      totalRows: summary['totalRows'] as int,
      totalPoints: summary['totalPoints'] as int,
      memberChanges: List<ClubLegacyMemberChange>.unmodifiable(
        changes.map((item) => ClubLegacyMemberChange.fromJson(_map(item))),
      ),
    );
  }
}

class ClubLegacyImportBatch {
  const ClubLegacyImportBatch({
    required this.id,
    required this.mode,
    required this.rowCount,
    required this.totalPoints,
    required this.enteredByName,
    required this.createdAt,
    required this.reversedAt,
    this.note,
    this.reversalReason,
  });
  final String id;
  final String mode;
  final int rowCount;
  final int totalPoints;
  final String enteredByName;
  final DateTime createdAt;
  final DateTime? reversedAt;
  final String? note;
  final String? reversalReason;

  factory ClubLegacyImportBatch.fromJson(Map<String, dynamic> json) {
    final created = DateTime.tryParse(json['createdAt'] as String? ?? '');
    final reversed = json['reversedAt'] == null
        ? null
        : DateTime.tryParse(json['reversedAt'] as String? ?? '');
    if (json['id'] is! String ||
        !const <String>{'DETAILED', 'OPENING_BALANCE'}.contains(json['mode']) ||
        json['rowCount'] is! int ||
        json['totalPoints'] is! int ||
        json['enteredByName'] is! String ||
        created == null ||
        (json['reversedAt'] != null && reversed == null) ||
        (json['note'] != null && json['note'] is! String) ||
        (json['reversalReason'] != null && json['reversalReason'] is! String)) {
      throw const FormatException('Invalid legacy import batch.');
    }
    return ClubLegacyImportBatch(
      id: json['id'] as String,
      mode: json['mode'] as String,
      rowCount: json['rowCount'] as int,
      totalPoints: json['totalPoints'] as int,
      enteredByName: json['enteredByName'] as String,
      createdAt: created,
      reversedAt: reversed,
      note: json['note'] as String?,
      reversalReason: json['reversalReason'] as String?,
    );
  }
}

Map<String, dynamic> _map(Object? value) {
  if (value is! Map) throw const FormatException('Invalid response.');
  return Map<String, dynamic>.from(value);
}
