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

  test('invite entry is preserved before bootstrap redirects', () {
    expect(
      resolveAppRedirect(
        authState: const AuthState.loading(AuthOperation.bootstrap),
        onboardingState: const OnboardingState.loading(),
        location: '/invite/team/A1B2C3',
      ),
      isNull,
    );
  });

  test('pending invite takes priority over the general join intent', () {
    expect(
      resolveAppRedirect(
        authState: const AuthState.authenticated(_user),
        onboardingState: const OnboardingState(
          isInitialized: true,
          completed: true,
          intent: OnboardingIntent.joinClub,
          pendingInviteCode: 'A1B2C3',
        ),
        location: '/login',
      ),
      '/club/join?code=A1B2C3',
    );
  });

  test('pending invite follows welcome and login onboarding gates', () {
    for (final ({bool completed, String expected}) fixture
        in <({bool completed, String expected})>[
          (completed: false, expected: '/welcome'),
          (completed: true, expected: '/login'),
        ]) {
      expect(
        resolveAppRedirect(
          authState: const AuthState.unauthenticated(),
          onboardingState: OnboardingState(
            isInitialized: true,
            completed: fixture.completed,
            pendingInviteCode: 'A1B2C3',
          ),
          location: '/splash',
        ),
        fixture.expected,
      );
    }
  });

  test('manage club intent keeps the existing home destination', () {
    expect(
      resolveAppRedirect(
        authState: const AuthState.authenticated(_user),
        onboardingState: const OnboardingState(
          isInitialized: true,
          completed: true,
          intent: OnboardingIntent.manageClub,
        ),
        location: '/login',
      ),
      '/home',
    );
  });
}
