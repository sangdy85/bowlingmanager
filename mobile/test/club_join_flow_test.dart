import 'package:bowlingmanager_mobile/app/app.dart';
import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/core/storage/onboarding_storage.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/features/onboarding/application/onboarding_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';
import 'support/club_fakes.dart';
import 'support/dashboard_fakes.dart';
import 'support/onboarding_fakes.dart';

void main() {
  testWidgets('join_club intent is consumed and successful join opens detail', (
    tester,
  ) async {
    final repository = FakeClubRepository();
    final onboarding = MemoryOnboardingStorage(
      completed: true,
      intent: OnboardingIntent.joinClub,
      pendingInviteCode: 'A1B2C3',
    );
    await _pumpJoinApp(tester, repository, onboarding);

    expect(find.byKey(const Key('club-join-screen')), findsOneWidget);
    expect(onboarding.consumeCount, 1);
    expect(
      tester
          .widget<TextFormField>(find.byKey(const Key('club-code-field')))
          .controller
          ?.text,
      'A1B2C3',
    );
    await tester.tap(find.byKey(const Key('club-join-submit')));
    await tester.pumpAndSettle();

    expect(repository.joinedCode, 'A1B2C3');
    expect(onboarding.clearPendingInviteCount, 1);
    expect(onboarding.pendingInviteCode, isNull);
    expect(find.byKey(const Key('club-detail')), findsOneWidget);
  });

  testWidgets('already-member response also opens the existing team detail', (
    tester,
  ) async {
    final repository = FakeClubRepository()
      ..joinResult = const ClubJoinResult(
        team: testClub,
        joined: false,
        alreadyMember: true,
      );
    final onboarding = MemoryOnboardingStorage(
      completed: true,
      intent: OnboardingIntent.joinClub,
      pendingInviteCode: 'TEST01',
    );
    await _pumpJoinApp(tester, repository, onboarding);
    await tester.tap(find.byKey(const Key('club-join-submit')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('club-detail')), findsOneWidget);
    expect(onboarding.clearPendingInviteCount, 1);
  });

  testWidgets('invalid code API error remains on the form', (tester) async {
    final repository = FakeClubRepository()
      ..joinError = const ApiException(
        kind: ApiErrorKind.badRequest,
        code: 'INVALID_TEAM_CODE',
        userMessage: '유효하지 않은 초대 코드입니다.',
      );
    final onboarding = MemoryOnboardingStorage(
      completed: true,
      intent: OnboardingIntent.joinClub,
      pendingInviteCode: 'TEST01',
    );
    await _pumpJoinApp(tester, repository, onboarding);
    await tester.tap(find.byKey(const Key('club-join-submit')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('club-join-error')), findsOneWidget);
    expect(find.text('유효하지 않은 초대 코드입니다.'), findsOneWidget);
    expect(onboarding.clearPendingInviteCount, 1);
    expect(onboarding.pendingInviteCode, isNull);
  });
}

Future<void> _pumpJoinApp(
  WidgetTester tester,
  FakeClubRepository clubRepository,
  MemoryOnboardingStorage onboardingStorage,
) async {
  final authRepository = FakeAuthRepository()..bootstrapResult = testUser;
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(authRepository),
        onboardingStorageProvider.overrideWithValue(onboardingStorage),
        clubRepositoryProvider.overrideWithValue(clubRepository),
        dashboardRepositoryProvider.overrideWithValue(
          FakeDashboardRepository(),
        ),
      ],
      child: const BowlingManagerApp(),
    ),
  );
  await tester.pumpAndSettle();
}
