import 'package:bowlingmanager_mobile/app/app.dart';
import 'package:bowlingmanager_mobile/app/router.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/features/onboarding/application/onboarding_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'support/auth_fakes.dart';
import 'support/club_fakes.dart';
import 'support/dashboard_fakes.dart';
import 'support/onboarding_fakes.dart';

void main() {
  testWidgets('authenticated valid invite opens a prefilled join screen', (
    WidgetTester tester,
  ) async {
    final MemoryOnboardingStorage onboarding = MemoryOnboardingStorage(
      completed: true,
    );
    final _InviteTestApp app = await _pumpApp(
      tester,
      auth: FakeAuthRepository()..bootstrapResult = testUser,
      onboarding: onboarding,
    );

    app.router.go('/invite/team/a1b2c3');
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('club-join-screen')), findsOneWidget);
    expect(
      tester
          .widget<TextFormField>(find.byKey(const Key('club-code-field')))
          .controller
          ?.text,
      'A1B2C3',
    );
    expect(onboarding.pendingInviteCode, 'A1B2C3');
    expect(app.clubRepository.joinedCode, isNull);
  });

  testWidgets('unauthenticated invite survives login and restores its code', (
    WidgetTester tester,
  ) async {
    final FakeAuthRepository auth = FakeAuthRepository();
    final MemoryOnboardingStorage onboarding = MemoryOnboardingStorage(
      completed: true,
    );
    final _InviteTestApp app = await _pumpApp(
      tester,
      auth: auth,
      onboarding: onboarding,
    );

    app.router.go('/invite/team/A1B2C3');
    await tester.pumpAndSettle();
    expect(find.text('다시 만나 반가워요'), findsOneWidget);
    expect(onboarding.pendingInviteCode, 'A1B2C3');

    await tester.enterText(
      find.widgetWithText(TextFormField, '이메일'),
      'user@example.com',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, '비밀번호'),
      'password',
    );
    await tester.tap(find.text('로그인'));
    await tester.pumpAndSettle();

    expect(auth.loginCount, 1);
    expect(find.byKey(const Key('club-join-screen')), findsOneWidget);
    expect(
      tester
          .widget<TextFormField>(find.byKey(const Key('club-code-field')))
          .controller
          ?.text,
      'A1B2C3',
    );
  });

  testWidgets(
    'first-launch invite passes through welcome and remains pending',
    (WidgetTester tester) async {
      final MemoryOnboardingStorage onboarding = MemoryOnboardingStorage();
      final _InviteTestApp app = await _pumpApp(
        tester,
        auth: FakeAuthRepository(),
        onboarding: onboarding,
      );

      app.router.go('/invite/team/A1B2C3');
      await tester.pumpAndSettle();

      expect(find.text('내 기록부터 우리 동호회까지,\n볼링을 더 편하게 관리하세요.'), findsOneWidget);
      expect(onboarding.pendingInviteCode, 'A1B2C3');
      await tester.tap(find.text('동호회 가입'));
      await tester.pump();
      await tester.tap(find.text('시작하기'));
      await tester.pumpAndSettle();
      expect(find.text('다시 만나 반가워요'), findsOneWidget);
      expect(onboarding.pendingInviteCode, 'A1B2C3');
    },
  );

  testWidgets('invalid invite renders a safe fallback without joining', (
    WidgetTester tester,
  ) async {
    final _InviteTestApp app = await _pumpApp(
      tester,
      auth: FakeAuthRepository()..bootstrapResult = testUser,
      onboarding: MemoryOnboardingStorage(completed: true),
    );

    app.router.go('/invite/team/not-valid');
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('invite-team-entry-error')), findsOneWidget);
    expect(find.text('유효하지 않은 초대 링크입니다.'), findsOneWidget);
    expect(app.clubRepository.joinedCode, isNull);
  });
}

class _InviteTestApp {
  const _InviteTestApp({required this.router, required this.clubRepository});

  final GoRouter router;
  final FakeClubRepository clubRepository;
}

Future<_InviteTestApp> _pumpApp(
  WidgetTester tester, {
  required FakeAuthRepository auth,
  required MemoryOnboardingStorage onboarding,
}) async {
  final FakeClubRepository clubRepository = FakeClubRepository();
  final ProviderContainer container = ProviderContainer(
    overrides: [
      authRepositoryProvider.overrideWithValue(auth),
      onboardingStorageProvider.overrideWithValue(onboarding),
      clubRepositoryProvider.overrideWithValue(clubRepository),
      dashboardRepositoryProvider.overrideWithValue(FakeDashboardRepository()),
    ],
  );
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: const BowlingManagerApp(),
    ),
  );
  await tester.pumpAndSettle();
  return _InviteTestApp(
    router: container.read(appRouterProvider),
    clubRepository: clubRepository,
  );
}
