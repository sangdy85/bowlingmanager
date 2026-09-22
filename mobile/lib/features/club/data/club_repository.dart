import 'package:bowlingmanager_mobile/features/club/data/club_api.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';

abstract interface class ClubRepository {
  Future<List<ClubSummary>> fetchClubs();
  Future<ClubDetail> fetchClubDetail(String teamId);
  Future<List<ClubMember>> fetchClubMembers(String teamId);
}

class MobileClubRepository implements ClubRepository {
  MobileClubRepository(this._api);

  final ClubApi _api;

  @override
  Future<List<ClubSummary>> fetchClubs() => _api.fetchClubs();

  @override
  Future<ClubDetail> fetchClubDetail(String teamId) =>
      _api.fetchClubDetail(teamId);

  @override
  Future<List<ClubMember>> fetchClubMembers(String teamId) =>
      _api.fetchClubMembers(teamId);
}
