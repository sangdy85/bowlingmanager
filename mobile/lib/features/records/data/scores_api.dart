import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/records/domain/score_record.dart';
import 'package:dio/dio.dart';

abstract interface class ScoresApi {
  Future<ScoresPage> fetchScores({
    required int page,
    required int limit,
    RecordsFilter filter = const RecordsFilter(),
  });
}

class MobileScoresApi implements ScoresApi {
  MobileScoresApi(this._dio);

  final Dio _dio;

  @override
  Future<ScoresPage> fetchScores({
    required int page,
    required int limit,
    RecordsFilter filter = const RecordsFilter(),
  }) async {
    try {
      final Response<dynamic> response = await _dio.get<dynamic>(
        '/scores/groups',
        queryParameters: <String, Object>{
          'page': page,
          'limit': limit,
          ...filter.toQuery(),
        },
      );
      final Object? body = response.data;
      if (body is! Map || body['success'] != true || body['data'] is! Map) {
        throw const FormatException('Invalid API response envelope.');
      }
      return ScoresPage.fromJson(
        Map<String, dynamic>.from(body['data'] as Map),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    }
  }
}
