import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';
import 'package:dio/dio.dart';

abstract interface class CaptureApi {
  Future<CaptureOptions> fetchOptions();

  Future<List<OcrPlayer>> analyze({
    required String teamId,
    required CaptureImageData image,
  });

  Future<BulkSaveResult> save({
    required String teamId,
    required String gameDate,
    required String gameType,
    required String? memo,
    required List<CapturePlayerDraft> players,
  });
}

class MobileCaptureApi implements CaptureApi {
  MobileCaptureApi(this._dio);

  final Dio _dio;

  static const Duration _scoreboardReceiveTimeout = Duration(seconds: 90);

  @override
  Future<CaptureOptions> fetchOptions() async {
    try {
      final Response<dynamic> response = await _dio.get<dynamic>(
        '/scores/bulk/options',
      );
      return CaptureOptions.fromJson(_readData(response.data));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on FormatException {
      throw ApiException.malformedResponse();
    } on TypeError {
      throw ApiException.malformedResponse();
    }
  }

  @override
  Future<List<OcrPlayer>> analyze({
    required String teamId,
    required CaptureImageData image,
  }) async {
    try {
      final FormData formData = FormData.fromMap(<String, Object>{
        'teamId': teamId,
        'image': MultipartFile.fromBytes(
          image.bytes,
          filename: image.fileName,
          contentType: DioMediaType.parse(image.mimeType),
        ),
      });
      final Response<dynamic> response = await _dio.post<dynamic>(
        '/ocr/scoreboard',
        data: formData,
        options: Options(receiveTimeout: _scoreboardReceiveTimeout),
      );
      final Map<String, dynamic> data = _readData(response.data);
      final Object? players = data['players'];
      if (players is! List || players.isEmpty) {
        throw const FormatException('Invalid OCR result.');
      }
      return List<OcrPlayer>.unmodifiable(
        players.map(
          (Object? value) =>
              OcrPlayer.fromJson(Map<String, dynamic>.from(value as Map)),
        ),
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
  Future<BulkSaveResult> save({
    required String teamId,
    required String gameDate,
    required String gameType,
    required String? memo,
    required List<CapturePlayerDraft> players,
  }) async {
    try {
      final Response<dynamic> response = await _dio.post<dynamic>(
        '/scores/bulk',
        data: <String, Object?>{
          'teamId': teamId,
          'gameDate': gameDate,
          'gameType': gameType,
          'memo': memo,
          'players': players
              .map(
                (CapturePlayerDraft player) => <String, Object?>{
                  'name': player.name.trim(),
                  'memberId': player.memberId,
                  'scores': player.validatedScores(),
                },
              )
              .toList(growable: false),
        },
      );
      return BulkSaveResult.fromJson(_readData(response.data));
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
