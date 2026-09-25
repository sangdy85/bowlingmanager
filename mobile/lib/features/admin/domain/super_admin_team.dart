class SuperAdminTeam {
  const SuperAdminTeam({
    required this.id,
    required this.name,
    required this.code,
    required this.bowlerHiddenEnabled,
    required this.seasonRankingEnabled,
  });

  final String id;
  final String name;
  final String code;
  final bool bowlerHiddenEnabled;
  final bool seasonRankingEnabled;

  factory SuperAdminTeam.fromJson(Map<String, dynamic> json) {
    final Object? id = json['id'];
    final Object? name = json['name'];
    final Object? code = json['code'];
    final Object? bowlerHiddenEnabled = json['bowlerHiddenEnabled'];
    final Object? seasonRankingEnabled = json['seasonRankingEnabled'];
    if (id is! String ||
        id.isEmpty ||
        name is! String ||
        name.isEmpty ||
        code is! String ||
        code.isEmpty ||
        bowlerHiddenEnabled is! bool ||
        seasonRankingEnabled is! bool) {
      throw const FormatException('Invalid super admin team response.');
    }
    return SuperAdminTeam(
      id: id,
      name: name,
      code: code,
      bowlerHiddenEnabled: bowlerHiddenEnabled,
      seasonRankingEnabled: seasonRankingEnabled,
    );
  }
}
