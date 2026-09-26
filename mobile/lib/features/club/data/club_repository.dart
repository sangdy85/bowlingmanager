import 'package:bowlingmanager_mobile/features/club/data/club_api.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_records_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_management_models.dart';

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
  Future<ClubActivityFeedPage> fetchClubActivityFeed({
    required String teamId,
    required int year,
    required List<ClubRecordFilter> types,
    required int page,
    required int limit,
    String? targetActivityId,
  });
  Future<ClubActivityDetail> fetchClubActivity({
    required String teamId,
    required String activityId,
  });
  Future<ClubWriteResult> createScores({
    required String teamId,
    required String date,
    required String gameType,
    required String? memo,
    required List<ClubParticipantDraft> participants,
  });
  Future<ClubActivityEditEnvelope> fetchEditableActivity({
    required String teamId,
    required String activityId,
  });
  Future<ClubWriteResult> updateActivity({
    required String teamId,
    required ClubActivityEdit activity,
  });
  Future<ClubWriteResult> deleteActivity({
    required String teamId,
    required String activityId,
    required String revision,
  });
  Future<void> removeMember({required String teamId, required String memberId});
  Future<ClubRole> changeMemberRole({
    required String teamId,
    required String memberId,
    required ClubRole role,
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
  Future<ClubActivityFeedPage> fetchClubActivityFeed({
    required String teamId,
    required int year,
    required List<ClubRecordFilter> types,
    required int page,
    required int limit,
    String? targetActivityId,
  }) => _api.fetchClubActivityFeed(
    teamId: teamId,
    year: year,
    types: types,
    page: page,
    limit: limit,
    targetActivityId: targetActivityId,
  );

  @override
  Future<ClubActivityDetail> fetchClubActivity({
    required String teamId,
    required String activityId,
  }) => _api.fetchClubActivity(teamId: teamId, activityId: activityId);

  @override
  Future<ClubWriteResult> createScores({
    required String teamId,
    required String date,
    required String gameType,
    required String? memo,
    required List<ClubParticipantDraft> participants,
  }) => _api.createScores(
    teamId: teamId,
    date: date,
    gameType: gameType,
    memo: memo,
    participants: participants,
  );

  @override
  Future<ClubActivityEditEnvelope> fetchEditableActivity({
    required String teamId,
    required String activityId,
  }) => _api.fetchEditableActivity(teamId: teamId, activityId: activityId);

  @override
  Future<ClubWriteResult> updateActivity({
    required String teamId,
    required ClubActivityEdit activity,
  }) => _api.updateActivity(teamId: teamId, activity: activity);

  @override
  Future<ClubWriteResult> deleteActivity({
    required String teamId,
    required String activityId,
    required String revision,
  }) => _api.deleteActivity(
    teamId: teamId,
    activityId: activityId,
    revision: revision,
  );

  @override
  Future<void> removeMember({
    required String teamId,
    required String memberId,
  }) => _api.removeMember(teamId: teamId, memberId: memberId);

  @override
  Future<ClubRole> changeMemberRole({
    required String teamId,
    required String memberId,
    required ClubRole role,
  }) => _api.changeMemberRole(teamId: teamId, memberId: memberId, role: role);
}
