class MobileNotificationItem {
  const MobileNotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.teamId,
    required this.eventId,
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
    if (json['id'] is! String ||
        json['type'] is! String ||
        json['title'] is! String ||
        json['body'] is! String ||
        json['teamId'] is! String ||
        (json['eventId'] != null && json['eventId'] is! String) ||
        data is! Map ||
        data['target'] is! String ||
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
      target: data['target'] as String,
      createdAt: createdAt,
      readAt: readAt,
    );
  }
}

String? mobileNotificationPath(Map<String, dynamic> data) {
  final teamId = data['teamId'];
  final eventId = data['eventId'];
  final target = data['target'];
  if (teamId is! String || teamId.isEmpty || target is! String) return null;
  if (eventId is! String || eventId.isEmpty) return '/club/$teamId';
  return switch (target) {
    'LANE_DRAW' => '/club/$teamId/events/$eventId/draw',
    'EVENT_DETAIL' => '/club/$teamId/events/$eventId',
    'INDIVIDUAL_GROUP' ||
    'TEAM_DRAFT' ||
    'TEAM_DETAIL' ||
    'EVENT_VOTING' => '/club/$teamId/events/$eventId?section=competition',
    _ => '/club/$teamId/events/$eventId',
  };
}
