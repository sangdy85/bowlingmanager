import 'package:bowlingmanager_mobile/features/records/data/scores_api.dart';
import 'package:bowlingmanager_mobile/features/records/domain/score_record.dart';

abstract interface class ScoresRepository {
  Future<ScoresPage> fetchScores({
    required int page,
    required int limit,
    RecordsFilter filter = const RecordsFilter(),
  });
}

class MobileScoresRepository implements ScoresRepository {
  MobileScoresRepository(this._api);

  final ScoresApi _api;

  @override
  Future<ScoresPage> fetchScores({
    required int page,
    required int limit,
    RecordsFilter filter = const RecordsFilter(),
  }) {
    return _api.fetchScores(page: page, limit: limit, filter: filter);
  }
}
