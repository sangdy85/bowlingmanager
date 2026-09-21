import 'package:bowlingmanager_mobile/features/capture/data/capture_api.dart';
import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';

abstract interface class CaptureRepository {
  Future<CaptureOptions> fetchOptions();
  Future<List<OcrPlayer>> analyze(String teamId, CaptureImageData image);
  Future<BulkSaveResult> save({
    required String teamId,
    required String gameDate,
    required String gameType,
    required String? memo,
    required List<CapturePlayerDraft> players,
  });
}

class MobileCaptureRepository implements CaptureRepository {
  MobileCaptureRepository(this._api);

  final CaptureApi _api;

  @override
  Future<CaptureOptions> fetchOptions() => _api.fetchOptions();

  @override
  Future<List<OcrPlayer>> analyze(String teamId, CaptureImageData image) =>
      _api.analyze(teamId: teamId, image: image);

  @override
  Future<BulkSaveResult> save({
    required String teamId,
    required String gameDate,
    required String gameType,
    required String? memo,
    required List<CapturePlayerDraft> players,
  }) => _api.save(
    teamId: teamId,
    gameDate: gameDate,
    gameType: gameType,
    memo: memo,
    players: players,
  );
}
