import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/capture/application/capture_state.dart';
import 'package:bowlingmanager_mobile/features/capture/data/capture_api.dart';
import 'package:bowlingmanager_mobile/features/capture/data/capture_image_picker.dart';
import 'package:bowlingmanager_mobile/features/capture/data/capture_repository.dart';
import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/features/records/application/records_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final Provider<CaptureApi> captureApiProvider = Provider<CaptureApi>(
  (Ref ref) => MobileCaptureApi(ref.watch(apiClientProvider).dio),
);

final Provider<CaptureRepository> captureRepositoryProvider =
    Provider<CaptureRepository>((Ref ref) {
      return MobileCaptureRepository(ref.watch(captureApiProvider));
    });

final Provider<CaptureImagePicker> captureImagePickerProvider =
    Provider<CaptureImagePicker>((Ref ref) => MobileCaptureImagePicker());

final captureControllerProvider = AsyncNotifierProvider.autoDispose
    .family<CaptureController, CaptureState, String>(
      CaptureController.new,
      retry: (int retryCount, Object error) => null,
    );

class CaptureController extends AsyncNotifier<CaptureState> {
  CaptureController(this.userId);

  final String userId;
  late CaptureRepository _repository;
  late CaptureImagePicker _imagePicker;

  @override
  Future<CaptureState> build() async {
    _repository = ref.watch(captureRepositoryProvider);
    _imagePicker = ref.watch(captureImagePickerProvider);
    final CaptureOptions options = await _repository.fetchOptions();
    CaptureImageData? recovered;
    try {
      recovered = await _imagePicker.recoverLostImage();
    } on Object {
      recovered = null;
    }
    return CaptureState(
      options: options,
      selectedTeamId: options.teams.isEmpty ? null : options.teams.first.id,
      gameType: options.gameTypes.first,
      gameDate: DateTime.now(),
      image: recovered,
    );
  }

  Future<void> selectImage(CaptureImageSource source) async {
    final CaptureState? current = state.value;
    if (current == null || current.isAnalyzing || current.isSaving) return;
    try {
      final CaptureImageData? image = await _imagePicker.pick(source);
      if (!ref.mounted || image == null) return;
      state = AsyncData<CaptureState>(
        current.copyWith(image: image, players: const [], clearError: true),
      );
    } on Object catch (error) {
      if (!ref.mounted) return;
      state = AsyncData<CaptureState>(
        current.copyWith(errorMessage: captureErrorMessage(error)),
      );
    }
  }

  void selectTeam(String teamId) {
    final CaptureState? current = state.value;
    if (current == null) return;
    state = AsyncData<CaptureState>(
      current.copyWith(
        selectedTeamId: teamId,
        players: const [],
        clearError: true,
      ),
    );
  }

  Future<bool> analyze() async {
    final CaptureState? current = state.value;
    if (current == null || !current.canAnalyze) return false;
    state = AsyncData<CaptureState>(
      current.copyWith(isAnalyzing: true, clearError: true),
    );
    try {
      final List<OcrPlayer> result = await _repository.analyze(
        current.selectedTeamId!,
        current.image!,
      );
      if (!ref.mounted) return false;
      state = AsyncData<CaptureState>(
        current.copyWith(
          isAnalyzing: false,
          players: List<CapturePlayerDraft>.unmodifiable(
            result.map(CapturePlayerDraft.fromOcr),
          ),
          clearError: true,
        ),
      );
      return true;
    } on Object catch (error) {
      if (!ref.mounted) return false;
      state = AsyncData<CaptureState>(
        current.copyWith(
          isAnalyzing: false,
          errorMessage: captureErrorMessage(error),
        ),
      );
      return false;
    }
  }

  void setGameDate(DateTime value) =>
      _update((CaptureState current) => current.copyWith(gameDate: value));

  void setGameType(String value) =>
      _update((CaptureState current) => current.copyWith(gameType: value));

  void setMemo(String value) =>
      _update((CaptureState current) => current.copyWith(memo: value));

  void updatePlayerName(int index, String value) {
    _changePlayer(index, (CapturePlayerDraft player) {
      final bool changed = value.trim() != player.name.trim();
      return player.copyWith(name: value, clearMemberId: changed);
    });
  }

  void updateScore(int playerIndex, int scoreIndex, String value) {
    _changePlayer(playerIndex, (CapturePlayerDraft player) {
      final List<String> scores = List<String>.of(player.scoreTexts);
      scores[scoreIndex] = value;
      return player.copyWith(scoreTexts: scores);
    });
  }

  void addScore(int playerIndex) {
    _changePlayer(playerIndex, (CapturePlayerDraft player) {
      return player.copyWith(scoreTexts: <String>[...player.scoreTexts, '']);
    });
  }

  void removeScore(int playerIndex, int scoreIndex) {
    _changePlayer(playerIndex, (CapturePlayerDraft player) {
      if (player.scoreTexts.length <= 1) return player;
      final List<String> scores = List<String>.of(player.scoreTexts)
        ..removeAt(scoreIndex);
      return player.copyWith(scoreTexts: scores);
    });
  }

  void removePlayer(int index) {
    final CaptureState? current = state.value;
    if (current == null || current.isSaving) return;
    final List<CapturePlayerDraft> players = List.of(current.players)
      ..removeAt(index);
    state = AsyncData<CaptureState>(
      current.copyWith(players: players, clearError: true),
    );
  }

  Future<BulkSaveResult?> save() async {
    final CaptureState? current = state.value;
    if (current == null || current.isSaving) return null;
    final String? validation = _validate(current);
    if (validation != null) {
      state = AsyncData<CaptureState>(
        current.copyWith(errorMessage: validation),
      );
      return null;
    }
    state = AsyncData<CaptureState>(
      current.copyWith(isSaving: true, clearError: true),
    );
    try {
      final BulkSaveResult result = await _repository.save(
        teamId: current.selectedTeamId!,
        gameDate: _formatDate(current.gameDate),
        gameType: current.gameType,
        memo: current.memo.trim().isEmpty ? null : current.memo.trim(),
        players: current.players,
      );
      ref.invalidate(dashboardProvider(userId));
      ref.invalidate(recordsControllerProvider(userId));
      ref.invalidate(clubStatisticsProvider);
      ref.invalidate(clubActivitiesControllerProvider);
      ref.invalidate(clubActivityProvider);
      ref.invalidate(clubActivityEditProvider);
      if (ref.mounted) {
        state = AsyncData<CaptureState>(
          current.copyWith(isSaving: false, clearError: true),
        );
      }
      return result;
    } on Object catch (error) {
      if (!ref.mounted) return null;
      state = AsyncData<CaptureState>(
        current.copyWith(
          isSaving: false,
          errorMessage: captureErrorMessage(error),
        ),
      );
      return null;
    }
  }

  void _changePlayer(
    int index,
    CapturePlayerDraft Function(CapturePlayerDraft) change,
  ) {
    final CaptureState? current = state.value;
    if (current == null || current.isSaving) return;
    final List<CapturePlayerDraft> players = List.of(current.players);
    players[index] = change(players[index]);
    state = AsyncData<CaptureState>(
      current.copyWith(players: players, clearError: true),
    );
  }

  void _update(CaptureState Function(CaptureState) change) {
    final CaptureState? current = state.value;
    if (current == null || current.isSaving) return;
    state = AsyncData<CaptureState>(change(current).copyWith(clearError: true));
  }
}

String? _validate(CaptureState state) {
  if (state.selectedTeamId == null) return '팀을 선택해주세요.';
  if (state.players.isEmpty) return '저장할 선수가 없습니다.';
  if (state.memo.trim().length > 500) return '메모는 500자 이하로 입력해주세요.';
  for (final CapturePlayerDraft player in state.players) {
    if (player.name.trim().isEmpty || player.name.trim().length > 100) {
      return '선수 이름을 확인해주세요.';
    }
    if (player.scoreTexts.length > 12 || player.validatedScores() == null) {
      return '모든 점수는 0에서 300 사이의 정수여야 합니다.';
    }
  }
  return null;
}

String _formatDate(DateTime value) {
  String twoDigits(int number) => number.toString().padLeft(2, '0');
  return '${value.year}-${twoDigits(value.month)}-${twoDigits(value.day)}';
}

String captureErrorMessage(Object error) {
  if (error is ApiException) return error.userMessage;
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.';
}
