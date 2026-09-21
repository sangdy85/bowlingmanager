import 'dart:async';
import 'dart:typed_data';

import 'package:bowlingmanager_mobile/features/capture/data/capture_image_picker.dart';
import 'package:bowlingmanager_mobile/features/capture/data/capture_repository.dart';
import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';

const CaptureOptions testCaptureOptions = CaptureOptions(
  gameTypes: <String>['정기전', '기타'],
  teams: <CaptureTeam>[
    CaptureTeam(
      id: 'team-1',
      name: '테스트 팀',
      members: <CaptureMember>[CaptureMember(id: 'member-1', name: '회원')],
    ),
  ],
);

final CaptureImageData testCaptureImage = CaptureImageData(
  bytes: Uint8List.fromList(<int>[1, 2, 3]),
  fileName: 'synthetic.jpg',
  mimeType: 'image/jpeg',
);

const List<OcrPlayer> testOcrPlayers = <OcrPlayer>[
  OcrPlayer(name: '회원', scores: <int>[201, 210], matchedMemberId: 'member-1'),
  OcrPlayer(name: '게스트', scores: <int>[180], matchedMemberId: null),
];

class FakeCaptureRepository implements CaptureRepository {
  CaptureOptions options = testCaptureOptions;
  List<OcrPlayer> analysis = testOcrPlayers;
  BulkSaveResult saveResult = const BulkSaveResult(
    createdCount: 3,
    playerCount: 2,
  );
  Object? optionsError;
  Object? analysisError;
  Object? saveError;
  Completer<List<OcrPlayer>>? pendingAnalysis;
  Completer<BulkSaveResult>? pendingSave;
  int analysisCalls = 0;
  int saveCalls = 0;
  String? analyzedTeamId;
  CaptureImageData? analyzedImage;
  List<CapturePlayerDraft>? savedPlayers;

  @override
  Future<CaptureOptions> fetchOptions() async {
    if (optionsError case final Object error) throw error;
    return options;
  }

  @override
  Future<List<OcrPlayer>> analyze(String teamId, CaptureImageData image) async {
    analysisCalls += 1;
    analyzedTeamId = teamId;
    analyzedImage = image;
    if (analysisError case final Object error) throw error;
    if (pendingAnalysis case final Completer<List<OcrPlayer>> pending) {
      return pending.future;
    }
    return analysis;
  }

  @override
  Future<BulkSaveResult> save({
    required String teamId,
    required String gameDate,
    required String gameType,
    required String? memo,
    required List<CapturePlayerDraft> players,
  }) async {
    saveCalls += 1;
    savedPlayers = players;
    if (saveError case final Object error) throw error;
    if (pendingSave case final Completer<BulkSaveResult> pending) {
      return pending.future;
    }
    return saveResult;
  }
}

class FakeCaptureImagePicker implements CaptureImagePicker {
  CaptureImageData? result = testCaptureImage;
  CaptureImageData? recovered;
  Object? error;
  int pickCalls = 0;

  @override
  Future<CaptureImageData?> pick(CaptureImageSource source) async {
    pickCalls += 1;
    if (error case final Object currentError) throw currentError;
    return result;
  }

  @override
  Future<CaptureImageData?> recoverLostImage() async => recovered;
}
