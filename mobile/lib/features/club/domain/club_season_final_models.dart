Map<String, dynamic> _map(Object? value) {
  if (value is! Map) {
    throw const FormatException('Invalid season final response.');
  }
  return Map<String, dynamic>.from(value);
}

List<T> _list<T>(Object? value, T Function(Map<String, dynamic>) decode) {
  if (value is! List) throw const FormatException('Invalid season final list.');
  return value.map((item) => decode(_map(item))).toList(growable: false);
}

class ClubSeasonFinalSummary {
  const ClubSeasonFinalSummary({
    required this.id,
    required this.seasonId,
    required this.name,
    required this.status,
    required this.competitionMode,
  });
  final String id;
  final String seasonId;
  final String name;
  final String status;
  final String competitionMode;
  factory ClubSeasonFinalSummary.fromJson(Map<String, dynamic> json) {
    if (json case {
      'id': final String id,
      'seasonId': final String seasonId,
      'name': final String name,
      'status': final String status,
      'competitionMode': final String competitionMode,
    }) {
      return ClubSeasonFinalSummary(
        id: id,
        seasonId: seasonId,
        name: name,
        status: status,
        competitionMode: competitionMode,
      );
    }
    throw const FormatException('Invalid season final summary.');
  }
}

class ClubSeasonFinals {
  const ClubSeasonFinals({
    required this.canManage,
    required this.canLock,
    required this.items,
  });
  final bool canManage;
  final bool canLock;
  final List<ClubSeasonFinalSummary> items;
  factory ClubSeasonFinals.fromJson(Map<String, dynamic> json) {
    if (json['canManage'] is! bool || json['canLock'] is! bool) {
      throw const FormatException('Invalid season final permissions.');
    }
    return ClubSeasonFinals(
      canManage: json['canManage'] as bool,
      canLock: json['canLock'] as bool,
      items: _list(json['items'], ClubSeasonFinalSummary.fromJson),
    );
  }
}

class ClubSeasonFinalParticipant {
  const ClubSeasonFinalParticipant({
    required this.id,
    required this.name,
    required this.seed,
    required this.points,
    required this.placement,
  });
  final String id;
  final String name;
  final int seed;
  final int points;
  final int? placement;
  factory ClubSeasonFinalParticipant.fromJson(Map<String, dynamic> json) {
    if (json['id'] is! String ||
        json['displayNameSnapshot'] is! String ||
        json['seed'] is! int ||
        json['seasonPointsSnapshot'] is! int ||
        (json['finalPlacement'] != null && json['finalPlacement'] is! int)) {
      throw const FormatException('Invalid season final participant.');
    }
    return ClubSeasonFinalParticipant(
      id: json['id'] as String,
      name: json['displayNameSnapshot'] as String,
      seed: json['seed'] as int,
      points: json['seasonPointsSnapshot'] as int,
      placement: json['finalPlacement'] as int?,
    );
  }
}

class ClubSeasonFinalNode {
  const ClubSeasonFinalNode({
    required this.id,
    required this.name,
    required this.type,
    required this.status,
    required this.gameCount,
    required this.entries,
    required this.results,
  });
  final String id;
  final String name;
  final String type;
  final String status;
  final int gameCount;
  final List<ClubSeasonFinalParticipant> entries;
  final List<({String participantId, int rank, int totalPins, double average})>
  results;
  factory ClubSeasonFinalNode.fromJson(Map<String, dynamic> json) {
    if (json['id'] is! String ||
        json['name'] is! String ||
        json['type'] is! String ||
        json['status'] is! String ||
        json['gameCount'] is! int ||
        json['entries'] is! List ||
        json['results'] is! List) {
      throw const FormatException('Invalid season final node.');
    }
    final entries = (json['entries'] as List)
        .map(
          (value) => ClubSeasonFinalParticipant.fromJson(
            _map(_map(value)['participant']),
          ),
        )
        .toList(growable: false);
    final results = (json['results'] as List)
        .map((value) {
          final item = _map(value);
          if (item['participantId'] is! String ||
              item['rank'] is! int ||
              item['totalPins'] is! int ||
              item['average'] is! num) {
            throw const FormatException('Invalid season final result.');
          }
          return (
            participantId: item['participantId'] as String,
            rank: item['rank'] as int,
            totalPins: item['totalPins'] as int,
            average: (item['average'] as num).toDouble(),
          );
        })
        .toList(growable: false);
    return ClubSeasonFinalNode(
      id: json['id'] as String,
      name: json['name'] as String,
      type: json['type'] as String,
      status: json['status'] as String,
      gameCount: json['gameCount'] as int,
      entries: entries,
      results: results,
    );
  }
}

class ClubSeasonFinalDetail {
  const ClubSeasonFinalDetail({
    required this.id,
    required this.name,
    required this.status,
    required this.competitionMode,
    required this.seasonName,
    required this.canManage,
    required this.canLock,
    required this.participants,
    required this.nodes,
  });
  final String id;
  final String name;
  final String status;
  final String competitionMode;
  final String seasonName;
  final bool canManage;
  final bool canLock;
  final List<ClubSeasonFinalParticipant> participants;
  final List<ClubSeasonFinalNode> nodes;
  factory ClubSeasonFinalDetail.fromJson(Map<String, dynamic> json) {
    final season = _map(json['season']);
    if (json['id'] is! String ||
        json['name'] is! String ||
        json['status'] is! String ||
        json['competitionMode'] is! String ||
        season['name'] is! String ||
        json['canManage'] is! bool ||
        json['canLock'] is! bool) {
      throw const FormatException('Invalid season final detail.');
    }
    return ClubSeasonFinalDetail(
      id: json['id'] as String,
      name: json['name'] as String,
      status: json['status'] as String,
      competitionMode: json['competitionMode'] as String,
      seasonName: season['name'] as String,
      canManage: json['canManage'] as bool,
      canLock: json['canLock'] as bool,
      participants: _list(
        json['participants'],
        ClubSeasonFinalParticipant.fromJson,
      ),
      nodes: _list(json['nodes'], ClubSeasonFinalNode.fromJson),
    );
  }
}
