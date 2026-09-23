import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_season_final_models.dart';
import 'package:dio/dio.dart';

class ClubExpansionApi {
  ClubExpansionApi(this._dio);
  final Dio _dio;

  Future<ClubSeasonFinals> fetchSeasonFinals(String teamId) async =>
      _guard(() async {
        final response = await _dio.get<dynamic>(
          '/teams/${Uri.encodeComponent(teamId)}/season-finals',
        );
        return ClubSeasonFinals.fromJson(_data(response.data));
      });
  Future<ClubSeasonFinalDetail> fetchSeasonFinal(
    String teamId,
    String finalId,
  ) async => _guard(() async {
    final response = await _dio.get<dynamic>(
      '/teams/${Uri.encodeComponent(teamId)}/season-finals/${Uri.encodeComponent(finalId)}',
    );
    return ClubSeasonFinalDetail.fromJson(_data(response.data));
  });
  Future<String> createSeasonFinal(
    String teamId,
    String seasonId,
    String name,
    String competitionMode,
  ) async => _guard(() async {
    final response = await _dio.post<dynamic>(
      '/teams/${Uri.encodeComponent(teamId)}/season-finals',
      data: <String, String>{
        'seasonId': seasonId,
        'name': name,
        'competitionMode': competitionMode,
      },
    );
    final data = _data(response.data);
    if (data['tournamentId'] is! String) {
      throw const FormatException('Invalid tournament id.');
    }
    return data['tournamentId'] as String;
  });

  Future<ClubMemberProfile> fetchMember(
    String teamId,
    String memberId,
    int year,
  ) async => _guard(() async {
    final response = await _dio.get<dynamic>(
      '/teams/${Uri.encodeComponent(teamId)}/members/${Uri.encodeComponent(memberId)}',
      queryParameters: <String, Object>{'year': year},
    );
    return ClubMemberProfile.fromJson(_map(_data(response.data)['member']));
  });
  Future<ClubTeamProfile> fetchProfile(String teamId) async => _guard(() async {
    final response = await _dio.get<dynamic>(
      '/teams/${Uri.encodeComponent(teamId)}/profile',
    );
    return ClubTeamProfile.fromJson(_map(_data(response.data)['profile']));
  });
  Future<ClubTeamProfile> updateProfile(
    String teamId,
    Map<String, dynamic> body,
  ) async => _guard(() async {
    final response = await _dio.patch<dynamic>(
      '/teams/${Uri.encodeComponent(teamId)}/profile',
      data: body,
    );
    return ClubTeamProfile.fromJson(_map(_data(response.data)['profile']));
  });
  Future<ClubSeasonRanking> fetchSeasonRanking(
    String teamId, {
    String? seasonId,
    String competitionType = 'ALL',
  }) async => _guard(() async {
    final response = await _dio.get<dynamic>(
      '/teams/${Uri.encodeComponent(teamId)}/season-ranking',
      queryParameters: _seasonQuery(seasonId, competitionType),
    );
    return ClubSeasonRanking.fromJson(_data(response.data));
  });
  Future<ClubSeasonRankingRow> fetchSeasonMember(
    String teamId,
    String memberId, {
    String? seasonId,
    String competitionType = 'ALL',
  }) async => _guard(() async {
    final response = await _dio.get<dynamic>(
      '/teams/${Uri.encodeComponent(teamId)}/season-ranking/members/${Uri.encodeComponent(memberId)}',
      queryParameters: _seasonQuery(seasonId, competitionType),
    );
    return ClubSeasonRankingRow.fromJson(_map(_data(response.data)['member']));
  });
  Future<ClubPostsPage> fetchPosts(String teamId, int page) async =>
      _guard(() async {
        final response = await _dio.get<dynamic>(
          '/teams/${Uri.encodeComponent(teamId)}/posts',
          queryParameters: <String, Object>{'page': page, 'limit': 20},
        );
        return ClubPostsPage.fromJson(_data(response.data));
      });
  Future<ClubPostDetail> fetchPost(
    String teamId,
    String postId,
  ) async => _guard(() async {
    final response = await _dio.get<dynamic>(
      '/teams/${Uri.encodeComponent(teamId)}/posts/${Uri.encodeComponent(postId)}',
    );
    return ClubPostDetail.fromJson(_map(_data(response.data)['post']));
  });
  Future<String> savePost(
    String teamId, {
    String? postId,
    required String title,
    required String content,
  }) async => _guard(() async {
    final path =
        '/teams/${Uri.encodeComponent(teamId)}/posts${postId == null ? '' : '/${Uri.encodeComponent(postId)}'}';
    final response = postId == null
        ? await _dio.post<dynamic>(
            path,
            data: <String, String>{'title': title, 'content': content},
          )
        : await _dio.patch<dynamic>(
            path,
            data: <String, String>{'title': title, 'content': content},
          );
    return _data(response.data)['postId'] as String;
  });
  Future<void> deletePost(
    String teamId,
    String postId,
  ) async => _guard(() async {
    await _dio.delete<dynamic>(
      '/teams/${Uri.encodeComponent(teamId)}/posts/${Uri.encodeComponent(postId)}',
    );
  });

  Future<T> _guard<T>(Future<T> Function() operation) async {
    try {
      return await operation();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    } on TypeError {
      throw ApiException.malformedResponse();
    }
  }

  Map<String, dynamic> _data(Object? value) {
    final envelope = _map(value);
    if (envelope['success'] != true) {
      throw const FormatException('Invalid envelope.');
    }
    return _map(envelope['data']);
  }

  Map<String, dynamic> _map(Object? value) {
    if (value is! Map) throw const FormatException('Invalid response.');
    return Map<String, dynamic>.from(value);
  }

  Map<String, Object> _seasonQuery(String? seasonId, String competitionType) {
    final query = <String, Object>{'type': competitionType};
    if (seasonId != null) query['seasonId'] = seasonId;
    return query;
  }
}
