import 'package:bowlingmanager_mobile/app/router_redirect.dart';
import 'package:bowlingmanager_mobile/core/storage/onboarding_storage.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_state.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/onboarding/application/onboarding_state.dart';
import 'package:flutter_test/flutter_test.dart';

const AuthUser _user = AuthUser(
  id: 'user-1',
  email: 'user@example.com',
  name: '테스트 볼러',
  role: 'USER',
  handicap: 10,
);

void main() {
  test('unauthenticated and incomplete onboarding redirects to welcome', () {
    expect(
      resolveAppRedirect(
        authState: const AuthState.unauthenticated(),
        onboardingState: const OnboardingState(
          isInitialized: true,
          completed: false,
        ),
        location: '/splash',
      ),
      '/welcome',
    );
  });

  test('unauthenticated and completed onboarding redirects to login', () {
    expect(
      resolveAppRedirect(
        authState: const AuthState.unauthenticated(),
        onboardingState: const OnboardingState(
          isInitialized: true,
          completed: true,
        ),
        location: '/splash',
      ),
      '/login',
    );
  });

  test('authenticated state redirects entry routes to home', () {
    for (final String location in <String>['/splash', '/welcome', '/login']) {
      expect(
        resolveAppRedirect(
          authState: const AuthState.authenticated(_user),
          onboardingState: const OnboardingState.loading(),
          location: location,
        ),
        '/home',
      );
    }
  });

  test('bootstrap keeps every non-splash route on splash', () {
    expect(
      resolveAppRedirect(
        authState: const AuthState.loading(AuthOperation.bootstrap),
        onboardingState: const OnboardingState.loading(),
        location: '/welcome',
      ),
      '/splash',
    );
  });

  test('authenticated join intent routes once to club join', () {
    expect(
      resolveAppRedirect(
        authState: const AuthState.authenticated(_user),
        onboardingState: const OnboardingState(
          isInitialized: true,
          completed: true,
          intent: OnboardingIntent.joinClub,
        ),
        location: '/login',
      ),
      '/club/join',
    );
    expect(
      resolveAppRedirect(
        authState: const AuthState.authenticated(_user),
        onboardingState: const OnboardingState(
          isInitialized: true,
          completed: true,
          intent: OnboardingIntent.joinClub,
        ),
        location: '/club/join',
      ),
      isNull,
    );
  });

  test('authenticated personal intent keeps the existing home destination', () {
    expect(
      resolveAppRedirect(
        authState: const AuthState.authenticated(_user),
        onboardingState: const OnboardingState(
          isInitialized: true,
          completed: true,
          intent: OnboardingIntent.personal,
        ),
        location: '/login',
      ),
      '/home',
    );
  });
}
