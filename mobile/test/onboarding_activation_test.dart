import 'package:bowlingmanager_mobile/core/config/app_web_urls.dart';
import 'package:bowlingmanager_mobile/core/storage/onboarding_storage.dart';
import 'package:bowlingmanager_mobile/core/theme/app_theme.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/presentation/login_screen.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_screen.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/features/home/presentation/home_screen.dart';
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
  group('Login contextual message', () {
    final List<({MemoryOnboardingStorage storage, String expected})> fixtures =
        <({MemoryOnboardingStorage storage, String expected})>[
          (
            storage: MemoryOnboardingStorage(
              completed: true,
              intent: OnboardingIntent.personal,
              pendingInviteCode: 'A1B2C3',
            ),
            expected: '로그인 후 초대받은 동호회 가입을 이어갑니다.',
          ),
          (
            storage: MemoryOnboardingStorage(
              completed: true,
              intent: OnboardingIntent.joinClub,
            ),
            expected: '로그인 후 동호회 가입 화면으로 이동합니다.',
          ),
          (
            storage: MemoryOnboardingStorage(
              completed: true,
              intent: OnboardingIntent.manageClub,
            ),
            expected: '로그인 후 동호회 관리 화면으로 이동합니다.',
          ),
          (
            storage: MemoryOnboardingStorage(
              completed: true,
              intent: OnboardingIntent.personal,
            ),
            expected: '로그인 후 개인 기록을 시작할 수 있습니다.',
          ),
          (
            storage: MemoryOnboardingStorage(completed: true),
            expected: 'BowlingManager 계정으로 로그인하세요',
          ),
        ];

    for (final fixture in fixtures) {
      testWidgets(fixture.expected, (WidgetTester tester) async {
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              authRepositoryProvider.overrideWithValue(FakeAuthRepository()),
              onboardingStorageProvider.overrideWithValue(fixture.storage),
            ],
            child: MaterialApp(theme: AppTheme.dark, home: const LoginScreen()),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text(fixture.expected), findsOneWidget);
        expect(find.text('로그인'), findsOneWidget);
        expect(find.text('회원가입'), findsOneWidget);
        expect(find.text('비밀번호 찾기'), findsOneWidget);
      });
    }
  });

  group('personal activation', () {
    testWidgets('shows once and later consumes without navigating', (
      WidgetTester tester,
    ) async {
      final MemoryOnboardingStorage storage = MemoryOnboardingStorage(
        completed: true,
        intent: OnboardingIntent.personal,
      );
      await _pumpHome(tester, storage);

      expect(find.byKey(const Key('personal-activation-card')), findsOneWidget);
      expect(find.text('첫 볼링 기록을 남겨보세요'), findsOneWidget);
      expect(find.text('기록 시작'), findsOneWidget);
      expect(find.text('나중에'), findsOneWidget);
      expect(storage.consumeCount, 0);

      await tester.tap(find.byKey(const Key('personal-activation-later')));
      await tester.pumpAndSettle();

      expect(storage.consumeCount, 1);
      expect(storage.intent, isNull);
      expect(find.byKey(const Key('personal-activation-card')), findsNothing);
      expect(find.byKey(const Key('capture-destination')), findsNothing);
    });

    testWidgets('record CTA consumes and uses the canonical capture route', (
      WidgetTester tester,
    ) async {
      final MemoryOnboardingStorage storage = MemoryOnboardingStorage(
        completed: true,
        intent: OnboardingIntent.personal,
      );
      await _pumpHome(tester, storage);

      await tester.tap(find.byKey(const Key('personal-activation-start')));
      await tester.pumpAndSettle();

      expect(storage.consumeCount, 1);
      expect(storage.intent, isNull);
      expect(find.byKey(const Key('capture-destination')), findsOneWidget);
    });

    testWidgets('does not show for a user without an intent', (
      WidgetTester tester,
    ) async {
      await _pumpHome(tester, MemoryOnboardingStorage(completed: true));

      expect(find.byKey(const Key('personal-activation-card')), findsNothing);
    });
  });

  group('manage club activation', () {
    testWidgets('shows with clubs and consumes only when a club is selected', (
      WidgetTester tester,
    ) async {
      final MemoryOnboardingStorage storage = MemoryOnboardingStorage(
        completed: true,
        intent: OnboardingIntent.manageClub,
      );
      await _pumpClub(tester, storage, FakeClubRepository());

      expect(
        find.byKey(const Key('manage-club-activation-card')),
        findsOneWidget,
      );
      expect(find.text('운영할 동호회를 선택하세요'), findsOneWidget);
      expect(find.byKey(const Key('club-team-1')), findsOneWidget);
      expect(storage.consumeCount, 0);

      await tester.tap(find.byKey(const Key('club-team-1')));
      await tester.pumpAndSettle();

      expect(storage.consumeCount, 1);
      expect(storage.intent, isNull);
      expect(find.byKey(const Key('club-detail-destination')), findsOneWidget);
    });

    testWidgets('empty state join CTA consumes and opens club join', (
      WidgetTester tester,
    ) async {
      final MemoryOnboardingStorage storage = MemoryOnboardingStorage(
        completed: true,
        intent: OnboardingIntent.manageClub,
      );
      final FakeClubRepository repository = FakeClubRepository()
        ..clubs = const [];
      await _pumpClub(tester, storage, repository);

      expect(find.byKey(const Key('empty-club-join')), findsOneWidget);
      expect(find.byKey(const Key('empty-club-create')), findsOneWidget);
      expect(
        find.byKey(const Key('manage-club-activation-later')),
        findsOneWidget,
      );
      expect(storage.consumeCount, 0);

      await tester.tap(find.byKey(const Key('empty-club-join')));
      await tester.pumpAndSettle();

      expect(storage.consumeCount, 1);
      expect(find.byKey(const Key('club-join-destination')), findsOneWidget);
    });

    testWidgets('web create uses the centralized URL and handles failure', (
      WidgetTester tester,
    ) async {
      final MemoryOnboardingStorage storage = MemoryOnboardingStorage(
        completed: true,
        intent: OnboardingIntent.manageClub,
      );
      final FakeClubRepository repository = FakeClubRepository()
        ..clubs = const [];
      final List<Uri> launched = <Uri>[];
      await _pumpClub(
        tester,
        storage,
        repository,
        webLauncher: (Uri uri) async {
          launched.add(uri);
          return false;
        },
      );

      await tester.tap(find.byKey(const Key('empty-club-create')));
      await tester.pumpAndSettle();

      expect(launched, <Uri>[AppWebUrls.teamCreation]);
      expect(storage.consumeCount, 1);
      expect(find.text('웹 페이지를 열지 못했습니다. 잠시 후 다시 시도해주세요.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('later consumes the activation without hiding the club list', (
      WidgetTester tester,
    ) async {
      final MemoryOnboardingStorage storage = MemoryOnboardingStorage(
        completed: true,
        intent: OnboardingIntent.manageClub,
      );
      await _pumpClub(tester, storage, FakeClubRepository());

      await tester.tap(find.byKey(const Key('manage-club-activation-later')));
      await tester.pumpAndSettle();

      expect(storage.consumeCount, 1);
      expect(
        find.byKey(const Key('manage-club-activation-card')),
        findsNothing,
      );
      expect(find.byKey(const Key('club-team-1')), findsOneWidget);
    });

    testWidgets('normal empty club still provides both actions', (
      WidgetTester tester,
    ) async {
      final MemoryOnboardingStorage storage = MemoryOnboardingStorage(
        completed: true,
      );
      final FakeClubRepository repository = FakeClubRepository()
        ..clubs = const [];
      await _pumpClub(tester, storage, repository);

      expect(
        find.byKey(const Key('manage-club-activation-card')),
        findsNothing,
      );
      expect(find.byKey(const Key('empty-club-join')), findsOneWidget);
      expect(find.byKey(const Key('empty-club-create')), findsOneWidget);
      expect(storage.consumeCount, 0);
    });
  });
}

Future<void> _pumpHome(
  WidgetTester tester,
  MemoryOnboardingStorage storage,
) async {
  final GoRouter router = GoRouter(
    initialLocation: '/home',
    routes: <RouteBase>[
      GoRoute(
        path: '/home',
        builder: (BuildContext context, GoRouterState state) =>
            const HomeScreen(),
      ),
      GoRoute(
        path: '/capture',
        builder: (BuildContext context, GoRouterState state) =>
            const Scaffold(body: SizedBox(key: Key('capture-destination'))),
      ),
    ],
  );
  addTearDown(router.dispose);
  final FakeAuthRepository authRepository = FakeAuthRepository()
    ..bootstrapResult = testUser;
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(authRepository),
        onboardingStorageProvider.overrideWithValue(storage),
        dashboardRepositoryProvider.overrideWithValue(
          FakeDashboardRepository(),
        ),
      ],
      child: MaterialApp.router(theme: AppTheme.dark, routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _pumpClub(
  WidgetTester tester,
  MemoryOnboardingStorage storage,
  FakeClubRepository repository, {
  ClubWebLauncher? webLauncher,
}) async {
  final GoRouter router = GoRouter(
    initialLocation: '/club',
    routes: <RouteBase>[
      GoRoute(
        path: '/club',
        builder: (BuildContext context, GoRouterState state) => Scaffold(
          body: ClubScreen(webLauncher: webLauncher ?? (Uri uri) async => true),
        ),
      ),
      GoRoute(
        path: '/club/join',
        builder: (BuildContext context, GoRouterState state) =>
            const Scaffold(body: SizedBox(key: Key('club-join-destination'))),
      ),
      GoRoute(
        path: '/club/:teamId',
        builder: (BuildContext context, GoRouterState state) =>
            const Scaffold(body: SizedBox(key: Key('club-detail-destination'))),
      ),
    ],
  );
  addTearDown(router.dispose);
  final FakeAuthRepository authRepository = FakeAuthRepository()
    ..bootstrapResult = testUser;
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(authRepository),
        onboardingStorageProvider.overrideWithValue(storage),
        clubRepositoryProvider.overrideWithValue(repository),
      ],
      child: MaterialApp.router(theme: AppTheme.dark, routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
}
