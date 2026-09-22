import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:dio/dio.dart';

abstract interface class ClubApi {
  Future<List<ClubSummary>> fetchClubs();
  Future<ClubDetail> fetchClubDetail(String teamId);
  Future<List<ClubMember>> fetchClubMembers(String teamId);
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
}

Map<String, dynamic> _readData(Object? body) {
  if (body is! Map || body['success'] != true || body['data'] is! Map) {
    throw const FormatException('Invalid API response envelope.');
  }
  return Map<String, dynamic>.from(body['data'] as Map);
}
