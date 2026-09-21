class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.handicap,
  });

  final String id;
  final String? email;
  final String? name;
  final String role;
  final int? handicap;

  String get displayName => name?.trim().isNotEmpty == true ? name! : '볼러님';

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    final Object? id = json['id'];
    final Object? email = json['email'];
    final Object? name = json['name'];
    final Object? role = json['role'];
    final Object? handicap = json['handicap'];

    if (id is! String ||
        id.isEmpty ||
        (email != null && email is! String) ||
        (name != null && name is! String) ||
        role is! String ||
        (handicap != null && handicap is! int)) {
      throw const FormatException('Invalid user response.');
    }

    return AuthUser(
      id: id,
      email: email as String?,
      name: name as String?,
      role: role,
      handicap: handicap as int?,
    );
  }
}
