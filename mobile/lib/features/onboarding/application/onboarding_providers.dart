import 'package:bowlingmanager_mobile/core/storage/onboarding_storage.dart';
import 'package:bowlingmanager_mobile/features/onboarding/application/onboarding_controller.dart';
import 'package:bowlingmanager_mobile/features/onboarding/application/onboarding_state.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final Provider<OnboardingStorage> onboardingStorageProvider =
    Provider<OnboardingStorage>(
      (Ref ref) => SharedPreferencesOnboardingStorage(),
    );

final NotifierProvider<OnboardingController, OnboardingState>
onboardingControllerProvider =
    NotifierProvider<OnboardingController, OnboardingState>(
      OnboardingController.new,
    );
