import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/admin/domain/super_admin_team.dart';
import 'package:dio/dio.dart';

abstract interface class SuperAdminRepository {
  Future<List<SuperAdminTeam>> fetchTeams();

  Future<SuperAdminTeam> setBowlerHiddenEnabled({
    required String teamId,
    required bool enabled,
  });
}

class MobileSuperAdminRepository implements SuperAdminRepository {
  MobileSuperAdminRepository(this._dio);

  final Dio _dio;

  @override
  Future<List<SuperAdminTeam>> fetchTeams() async {
    try {
      final Response<dynamic> response = await _dio.get<dynamic>(
        '/admin/teams',
      );
      final Map<String, dynamic> data = _readData(response.data);
      final Object? teams = data['teams'];
      if (teams is! List) {
        throw const FormatException('Invalid super admin teams response.');
      }
      return List<SuperAdminTeam>.unmodifiable(
        teams.map((Object? value) {
          if (value is! Map) {
            throw const FormatException('Invalid super admin team response.');
          }
          return SuperAdminTeam.fromJson(Map<String, dynamic>.from(value));
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
  Future<SuperAdminTeam> setBowlerHiddenEnabled({
    required String teamId,
    required bool enabled,
  }) async {
    try {
      final Response<dynamic> response = await _dio.patch<dynamic>(
        '/admin/teams/${Uri.encodeComponent(teamId)}/bowler-hidden',
        data: <String, dynamic>{'enabled': enabled},
      );
      final Object? team = _readData(response.data)['team'];
      if (team is! Map) {
        throw const FormatException('Invalid super admin team response.');
      }
      return SuperAdminTeam.fromJson(Map<String, dynamic>.from(team));
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
    throw const FormatException('Invalid mobile API response.');
  }
  return Map<String, dynamic>.from(body['data'] as Map);
}
