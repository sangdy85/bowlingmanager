import 'package:bowlingmanager_mobile/core/storage/onboarding_storage.dart';

class OnboardingState {
  const OnboardingState({
    required this.isInitialized,
    required this.completed,
    this.intent,
    this.pendingInviteCode,
    this.isSaving = false,
    this.errorMessage,
  });

  const OnboardingState.loading()
    : this(isInitialized: false, completed: false);

  final bool isInitialized;
  final bool completed;
  final OnboardingIntent? intent;
  final String? pendingInviteCode;
  final bool isSaving;
  final String? errorMessage;

  OnboardingState copyWith({
    bool? completed,
    OnboardingIntent? intent,
    String? pendingInviteCode,
    bool? isSaving,
    String? errorMessage,
    bool clearError = false,
    bool clearIntent = false,
    bool clearPendingInvite = false,
  }) {
    return OnboardingState(
      isInitialized: isInitialized,
      completed: completed ?? this.completed,
      intent: clearIntent ? null : intent ?? this.intent,
      pendingInviteCode: clearPendingInvite
          ? null
          : pendingInviteCode ?? this.pendingInviteCode,
      isSaving: isSaving ?? this.isSaving,
      errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
    );
  }
}
