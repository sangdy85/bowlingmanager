import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';

class CaptureState {
  const CaptureState({
    required this.options,
    required this.selectedTeamId,
    required this.gameType,
    required this.gameDate,
    this.image,
    this.players = const <CapturePlayerDraft>[],
    this.memo = '',
    this.isAnalyzing = false,
    this.isSaving = false,
    this.errorMessage,
  });

  final CaptureOptions options;
  final String? selectedTeamId;
  final String gameType;
  final DateTime gameDate;
  final CaptureImageData? image;
  final List<CapturePlayerDraft> players;
  final String memo;
  final bool isAnalyzing;
  final bool isSaving;
  final String? errorMessage;

  bool get canAnalyze =>
      selectedTeamId != null && image != null && !isAnalyzing;

  CaptureState copyWith({
    String? selectedTeamId,
    String? gameType,
    DateTime? gameDate,
    CaptureImageData? image,
    List<CapturePlayerDraft>? players,
    String? memo,
    bool? isAnalyzing,
    bool? isSaving,
    String? errorMessage,
    bool clearError = false,
  }) => CaptureState(
    options: options,
    selectedTeamId: selectedTeamId ?? this.selectedTeamId,
    gameType: gameType ?? this.gameType,
    gameDate: gameDate ?? this.gameDate,
    image: image ?? this.image,
    players: players ?? this.players,
    memo: memo ?? this.memo,
    isAnalyzing: isAnalyzing ?? this.isAnalyzing,
    isSaving: isSaving ?? this.isSaving,
    errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
  );
}
