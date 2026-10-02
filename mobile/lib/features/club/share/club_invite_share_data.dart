import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';

class ClubInviteShareData {
  const ClubInviteShareData({
    required this.clubName,
    required this.memberCount,
    required this.inviteUrl,
  });

  final String clubName;
  final int memberCount;
  final String inviteUrl;

  factory ClubInviteShareData.fromClub(ClubDetail club) {
    final Uri? inviteUrl = club.inviteUrl;
    if (inviteUrl == null) {
      throw ArgumentError.value(
        inviteUrl,
        'club.inviteUrl',
        'An invite URL is required to create share data.',
      );
    }
    return ClubInviteShareData(
      clubName: club.name,
      memberCount: club.memberCount,
      inviteUrl: inviteUrl.toString(),
    );
  }

  String get shareText =>
      buildClubInviteShareTextValues(clubName: clubName, inviteUrl: inviteUrl);
}

bool isValidClubInviteUrl(String value) {
  final Uri? uri = Uri.tryParse(value);
  if (uri == null ||
      !uri.isAbsolute ||
      uri.scheme != 'https' ||
      uri.host != 'www.bowlingmanager.co.kr' ||
      uri.userInfo.isNotEmpty ||
      uri.hasPort ||
      uri.hasQuery ||
      uri.hasFragment) {
    return false;
  }
  return RegExp(
    r'^https://www\.bowlingmanager\.co\.kr/invite/team/[A-Z0-9]{6}$',
  ).hasMatch(value);
}
