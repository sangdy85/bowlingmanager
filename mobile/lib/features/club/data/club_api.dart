import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_records_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_management_models.dart';
import 'package:dio/dio.dart';

abstract interface class ClubApi {
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

class MobileClubApi implements ClubApi {
  MobileClubApi(this._dio);

  final Dio _dio;

  @override
  Future<List<ClubSummary>> fetchClubs() async {
    try {
      final Response<dynamic> response = await _dio.get<dynamic>('/teams');
      final Map<String, dynamic> data = _readData(response.data);
      final Object? teams = data['teams'];
      if (teams is! List) {
        throw const FormatException('Invalid clubs response.');
      }
      return List<ClubSummary>.unmodifiable(
        teams.map((Object? value) {
          if (value is! Map) {
            throw const FormatException('Invalid club summary response.');
          }
          return ClubSummary.fromJson(Map<String, dynamic>.from(value));
        }),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    } on TypeError {
      throw ApiException.malformedResponse();
    }
  }

  @override
  Future<ClubDetail> fetchClubDetail(String teamId) async {
    try {
      final Response<dynamic> response = await _dio.get<dynamic>(
        '/teams/${Uri.encodeComponent(teamId)}',
      );
      final Map<String, dynamic> data = _readData(response.data);
      final Object? team = data['team'];
      if (team is! Map) throw const FormatException('Invalid club response.');
      return ClubDetail.fromJson(Map<String, dynamic>.from(team));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    } on TypeError {
      throw ApiException.malformedResponse();
    }
  }

  @override
  Future<List<ClubMember>> fetchClubMembers(String teamId) async {
    try {
      final Response<dynamic> response = await _dio.get<dynamic>(
        '/teams/${Uri.encodeComponent(teamId)}/members',
      );
      final Map<String, dynamic> data = _readData(response.data);
      final Object? members = data['members'];
      if (members is! List) {
        throw const FormatException('Invalid club members response.');
      }
      return List<ClubMember>.unmodifiable(
        members.map((Object? value) {
          if (value is! Map) {
            throw const FormatException('Invalid club member response.');
          }
          return ClubMember.fromJson(Map<String, dynamic>.from(value));
        }),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    } on TypeError {
      throw ApiException.malformedResponse();
    }
  }

  @override
  Future<ClubStatistics> fetchClubStatistics({
    required String teamId,
    required int year,
    required ClubRecordFilter filter,
  }) async {
    try {
      final Response<dynamic> response = await _dio.get<dynamic>(
        '/teams/${Uri.encodeComponent(teamId)}/statistics',
        queryParameters: <String, Object>{
          'year': year,
          'type': filter.apiValue,
        },
      );
      return ClubStatistics.fromJson(_readData(response.data));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    } on TypeError {
      throw ApiException.malformedResponse();
    }
  }

  @override
  Future<ClubActivitiesPage> fetchClubActivities({
    required String teamId,
    required int year,
    required ClubRecordFilter filter,
    required int page,
    required int limit,
  }) async {
    try {
      final Response<dynamic> response = await _dio.get<dynamic>(
        '/teams/${Uri.encodeComponent(teamId)}/activities',
        queryParameters: <String, Object>{
          'year': year,
          'type': filter.apiValue,
          'page': page,
          'limit': limit,
        },
      );
      return ClubActivitiesPage.fromJson(_readData(response.data));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    } on TypeError {
      throw ApiException.malformedResponse();
    }
  }

  @override
  Future<ClubActivityDetail> fetchClubActivity({
    required String teamId,
    required String activityId,
  }) async {
    try {
      final Response<dynamic> response = await _dio.get<dynamic>(
        '/teams/${Uri.encodeComponent(teamId)}/activities/${Uri.encodeComponent(activityId)}',
      );
      final Object? activity = _readData(response.data)['activity'];
      if (activity is! Map) {
        throw const FormatException('Invalid club activity response.');
      }
      return ClubActivityDetail.fromJson(Map<String, dynamic>.from(activity));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    } on TypeError {
      throw ApiException.malformedResponse();
    }
  }

  @override
  Future<ClubWriteResult> createScores({
    required String teamId,
    required String date,
    required String gameType,
    required String? memo,
    required List<ClubParticipantDraft> participants,
  }) async {
    try {
      final Response<dynamic> response = await _dio.post<dynamic>(
        '/scores/bulk',
        data: <String, dynamic>{
          'teamId': teamId,
          'gameDate': date,
          'gameType': gameType,
          'memo': memo,
          'players': participants
              .map(
                (ClubParticipantDraft participant) => <String, dynamic>{
                  'memberId': participant.memberId,
                  'name': participant.name,
                  'scores': participant.scores
                      .map((ClubScoreDraft score) => score.value)
                      .toList(),
                },
              )
              .toList(),
        },
      );
      final Map<String, dynamic> data = _readData(response.data);
      final Object? count = data['createdCount'];
      if (count is! int || count < 0) {
        throw const FormatException('Invalid write response.');
      }
      return ClubWriteResult(changedCount: count);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    } on TypeError {
      throw ApiException.malformedResponse();
    }
  }

  @override
  Future<ClubActivityEditEnvelope> fetchEditableActivity({
    required String teamId,
    required String activityId,
  }) async {
    try {
      final response = await _dio.get<dynamic>(
        '/teams/${Uri.encodeComponent(teamId)}/activities/${Uri.encodeComponent(activityId)}/edit',
      );
      return ClubActivityEditEnvelope.fromJson(_readData(response.data));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    } on TypeError {
      throw ApiException.malformedResponse();
    }
  }

  @override
  Future<ClubWriteResult> updateActivity({
    required String teamId,
    required ClubActivityEdit activity,
  }) async {
    try {
      final response = await _dio.put<dynamic>(
        '/teams/${Uri.encodeComponent(teamId)}/activities/${Uri.encodeComponent(activity.id)}/edit',
        data: <String, dynamic>{
          'revision': activity.revision,
          'date': activity.date,
          'gameType': activity.gameType,
          'memo': activity.memo,
          'participants': activity.participants
              .map((value) => value.toMutationJson())
              .toList(),
        },
      );
      final data = _readData(response.data);
      final Object? id = data['activityId'];
      final Object? count = data['updatedCount'];
      if (id is! String || id.isEmpty || count is! int || count < 0) {
        throw const FormatException('Invalid write response.');
      }
      return ClubWriteResult(activityId: id, changedCount: count);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    } on TypeError {
      throw ApiException.malformedResponse();
    }
  }

  @override
  Future<ClubWriteResult> deleteActivity({
    required String teamId,
    required String activityId,
    required String revision,
  }) async {
    try {
      final response = await _dio.delete<dynamic>(
        '/teams/${Uri.encodeComponent(teamId)}/activities/${Uri.encodeComponent(activityId)}',
        data: <String, dynamic>{'revision': revision},
      );
      final data = _readData(response.data);
      final Object? count = data['deletedCount'];
      if (count is! int || count < 1) {
        throw const FormatException('Invalid delete response.');
      }
      return ClubWriteResult(changedCount: count);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    } on TypeError {
      throw ApiException.malformedResponse();
    }
  }

  @override
  Future<void> removeMember({
    required String teamId,
    required String memberId,
  }) async {
    try {
      _readData(
        (await _dio.delete<dynamic>(
          '/teams/${Uri.encodeComponent(teamId)}/members/${Uri.encodeComponent(memberId)}',
        )).data,
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    } on TypeError {
      throw ApiException.malformedResponse();
    }
  }

  @override
  Future<ClubRole> changeMemberRole({
    required String teamId,
    required String memberId,
    required ClubRole role,
  }) async {
    try {
      final data = _readData(
        (await _dio.patch<dynamic>(
          '/teams/${Uri.encodeComponent(teamId)}/members/${Uri.encodeComponent(memberId)}',
          data: <String, dynamic>{'role': role.apiValue},
        )).data,
      );
      return ClubRole.fromJson(data['role']);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    } on TypeError {
      throw ApiException.malformedResponse();
    }
  }
}

Map<String, dynamic> _readData(Object? body) {
  if (body is! Map || body['success'] != true || body['data'] is! Map) {
    throw const FormatException('Invalid API response envelope.');
  }
  return Map<String, dynamic>.from(body['data'] as Map);
}
