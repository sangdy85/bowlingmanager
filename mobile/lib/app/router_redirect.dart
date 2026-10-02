import 'package:bowlingmanager_mobile/features/auth/application/auth_state.dart';
import 'package:bowlingmanager_mobile/core/storage/onboarding_storage.dart';
import 'package:bowlingmanager_mobile/features/onboarding/application/onboarding_state.dart';

String? resolveAppRedirect({
  required AuthState authState,
  required OnboardingState onboardingState,
  required String location,
}) {
  final bool isSplash = location == '/splash';
  final bool isLogin = location == '/login';
  final bool isWelcome = location == '/welcome';
  final bool isInviteEntry = location.startsWith('/invite/team/');

  // The entry screen persists the code before authentication redirects run.
  if (isInviteEntry) return null;

  if (authState.isBootstrapping) return isSplash ? null : '/splash';
  if (authState.isLoading) return null;

  if (authState.isAuthenticated) {
    final String? pendingInviteCode = onboardingState.pendingInviteCode;
    if (pendingInviteCode != null &&
        (isSplash || isLogin || isWelcome || location == '/home')) {
      return '/club/join?code=$pendingInviteCode';
    }
    if (onboardingState.isInitialized &&
        onboardingState.intent == OnboardingIntent.joinClub &&
        (isSplash || isLogin || isWelcome || location == '/home')) {
      return '/club/join';
    }
    if (onboardingState.isInitialized &&
        onboardingState.intent == OnboardingIntent.manageClub &&
        (isSplash || isLogin || isWelcome || location == '/home')) {
      return '/club';
    }
    return isSplash || isLogin || isWelcome ? '/home' : null;
  }

  if (!onboardingState.isInitialized) {
    return isSplash ? null : '/splash';
  }

  final String target = onboardingState.completed ? '/login' : '/welcome';
  return location == target ? null : target;
}
