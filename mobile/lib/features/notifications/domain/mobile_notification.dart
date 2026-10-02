class MobileNotificationItem {
  const MobileNotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.teamId,
    required this.eventId,
    required this.chargeId,
    required this.target,
    required this.createdAt,
    required this.readAt,
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final String teamId;
  final String? eventId;
  final String? chargeId;
  final String target;
  final DateTime createdAt;
  final DateTime? readAt;

  bool get isUnread => readAt == null;

  factory MobileNotificationItem.fromJson(Map<String, dynamic> json) {
    final data = json['data'];
    final createdAt = DateTime.tryParse(json['createdAt'] as String? ?? '');
    final readAt = json['readAt'] == null
        ? null
        : DateTime.tryParse(json['readAt'] as String? ?? '');
    final Object? rawChargeId = data is Map ? data['chargeId'] : null;
    if (json['id'] is! String ||
        json['type'] is! String ||
        json['title'] is! String ||
        json['body'] is! String ||
        json['teamId'] is! String ||
        (json['eventId'] != null && json['eventId'] is! String) ||
        data is! Map ||
        data['target'] is! String ||
        (rawChargeId != null && rawChargeId is! String) ||
        createdAt == null ||
        (json['readAt'] != null && readAt == null)) {
      throw const FormatException('Invalid notification response.');
    }
    return MobileNotificationItem(
      id: json['id'] as String,
      type: json['type'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      teamId: json['teamId'] as String,
      eventId: json['eventId'] as String?,
      chargeId: rawChargeId is String && rawChargeId.trim().isNotEmpty
          ? rawChargeId.trim()
          : null,
      target: data['target'] as String,
      createdAt: createdAt,
      readAt: readAt,
    );
  }
}

String? mobileNotificationPath(Map<String, dynamic> data) {
  final teamId = data['teamId'];
  final eventId = data['eventId'];
  final chargeId = data['chargeId'];
  final target = data['target'];
  if (teamId is! String || teamId.isEmpty || target is! String) return null;
  final String encodedTeamId = Uri.encodeComponent(teamId);
  if (target == 'FINANCE_CHARGE') {
    if (chargeId is! String || chargeId.trim().isEmpty) {
      return '/club/$encodedTeamId/finance';
    }
    return '/club/$encodedTeamId/finance/${Uri.encodeComponent(chargeId.trim())}';
  }
  if (eventId is! String || eventId.isEmpty) return '/club/$encodedTeamId';
  final String encodedEventId = Uri.encodeComponent(eventId);
  return switch (target) {
    'LANE_DRAW' => '/club/$encodedTeamId/events/$encodedEventId/draw',
    'EVENT_DETAIL' => '/club/$encodedTeamId/events/$encodedEventId',
    'INDIVIDUAL_GROUP' || 'TEAM_DRAFT' || 'TEAM_DETAIL' || 'EVENT_VOTING' =>
      '/club/$encodedTeamId/events/$encodedEventId?section=competition',
    _ => '/club/$encodedTeamId/events/$encodedEventId',
  };
}
