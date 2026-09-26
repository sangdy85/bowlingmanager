import 'dart:convert';
import 'dart:typed_data';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';
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
    int? year,
    String competitionType = 'ALL',
  }) async => _guard(() async {
    final response = await _dio.get<dynamic>(
      '/teams/${Uri.encodeComponent(teamId)}/season-ranking',
      queryParameters: <String, Object>{
        ..._seasonQuery(seasonId, competitionType),
        'year': ?year,
      },
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
  Future<int> createSeasonPointAdjustment(
    String teamId,
    String seasonId, {
    required String memberId,
    required int delta,
    required String reason,
  }) async => _guard(() async {
    final response = await _dio.post<dynamic>(
      '/teams/${Uri.encodeComponent(teamId)}/seasons/${Uri.encodeComponent(seasonId)}/point-adjustments',
      data: <String, Object>{
        'memberId': memberId,
        'delta': delta,
        'reason': reason,
      },
    );
    final data = _data(response.data);
    if (data['totalPoints'] is! int) {
      throw const FormatException('Invalid season adjustment.');
    }
    return data['totalPoints'] as int;
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
    List<ClubPostImage> existingImages = const <ClubPostImage>[],
    List<CaptureImageData> newImages = const <CaptureImageData>[],
  }) async => _guard(() async {
    final path =
        '/teams/${Uri.encodeComponent(teamId)}/posts${postId == null ? '' : '/${Uri.encodeComponent(postId)}'}';
    final form = FormData.fromMap(<String, dynamic>{
      'title': title,
      'content': content,
      'existingImageIds': jsonEncode(
        existingImages.map((image) => image.id).toList(growable: false),
      ),
      'images': newImages
          .map(
            (image) => MultipartFile.fromBytes(
              image.bytes,
              filename: image.fileName,
              contentType: DioMediaType.parse(image.mimeType),
            ),
          )
          .toList(growable: false),
    });
    final response = postId == null
        ? await _dio.post<dynamic>(path, data: form)
        : await _dio.patch<dynamic>(path, data: form);
    return _data(response.data)['postId'] as String;
  });
  Future<Uint8List> fetchPostImage(
    String teamId,
    String imageId,
  ) async => _guard(() async {
    final response = await _dio.get<List<int>>(
      '/teams/${Uri.encodeComponent(teamId)}/posts/images/${Uri.encodeComponent(imageId)}',
      options: Options(responseType: ResponseType.bytes),
    );
    final bytes = response.data;
    if (bytes == null) throw const FormatException('Invalid image.');
    return Uint8List.fromList(bytes);
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
