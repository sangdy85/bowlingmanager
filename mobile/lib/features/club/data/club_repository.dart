import 'package:bowlingmanager_mobile/features/club/data/club_api.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_records_models.dart';

abstract interface class ClubRepository {
  Future<List<ClubSummary>> fetchClubs();
  Future<ClubDetail> fetchClubDetail(String teamId);
  Future<List<ClubMember>> fetchClubMembers(String teamId);
  Future<ClubStatistics> fetchClubStatistics({
    required String teamId,
    required int year,
    required ClubRecordFilter filter,
  });
  Future<ClubActivitiesPage> fetchClubActivities({
    required String teamId,
    required int year,
    required ClubRecordFilter filter,
    required int page,
    required int limit,
  });
  Future<ClubActivityDetail> fetchClubActivity({
    required String teamId,
    required String activityId,
  });
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

  @override
  Future<ClubStatistics> fetchClubStatistics({
    required String teamId,
    required int year,
    required ClubRecordFilter filter,
  }) => _api.fetchClubStatistics(teamId: teamId, year: year, filter: filter);

  @override
  Future<ClubActivitiesPage> fetchClubActivities({
    required String teamId,
    required int year,
    required ClubRecordFilter filter,
    required int page,
    required int limit,
  }) => _api.fetchClubActivities(
    teamId: teamId,
    year: year,
    filter: filter,
    page: page,
    limit: limit,
  );

  @override
  Future<ClubActivityDetail> fetchClubActivity({
    required String teamId,
    required String activityId,
  }) => _api.fetchClubActivity(teamId: teamId, activityId: activityId);
}
