import 'dart:async';

import 'package:bowlingmanager_mobile/app/app.dart';
import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_state.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';
import 'support/club_fakes.dart';
import 'support/dashboard_fakes.dart';

void main() {
  testWidgets('MY displays real profile and multiple club summaries', (
    WidgetTester tester,
  ) async {
    final FakeAuthRepository auth = FakeAuthRepository()
      ..bootstrapResult = testUser;
    final FakeClubRepository clubs = FakeClubRepository()
      ..clubs = const <ClubSummary>[testClub, secondClub];
    await _openProfile(tester, auth, clubs);

    expect(find.text('테스트 볼러'), findsOneWidget);
    expect(find.text('user@example.com'), findsOneWidget);
    expect(find.text('핸디캡'), findsOneWidget);
    expect(find.text('10'), findsOneWidget);
    expect(find.text('2개'), findsOneWidget);
    expect(find.text('테스트 동호회'), findsOneWidget);
    expect(find.text('두 번째 동호회'), findsOneWidget);
    expect(find.text('팀장 · 회원 3명'), findsOneWidget);
    expect(find.text('USER'), findsNothing);
  });

  testWidgets('MY renders null handicap and no-club state without zeroing it', (
    WidgetTester tester,
  ) async {
    const AuthUser user = AuthUser(
      id: 'user-null',
      email: null,
      name: null,
      role: 'ADMIN',
      handicap: null,
    );
    final FakeAuthRepository auth = FakeAuthRepository()
      ..bootstrapResult = user;
    final FakeClubRepository clubs = FakeClubRepository()
      ..clubs = const <ClubSummary>[];
    await _openProfile(tester, auth, clubs);

    expect(find.text('볼러님'), findsOneWidget);
    expect(find.text('이메일 정보 없음'), findsOneWidget);
    expect(find.text('미설정'), findsOneWidget);
    expect(find.text('0개'), findsOneWidget);
    expect(find.text('가입한 동호회가 없습니다.'), findsOneWidget);
    expect(find.text('ADMIN'), findsNothing);
  });

  testWidgets('MY keeps profile visible while clubs load or fail and retries', (
    WidgetTester tester,
  ) async {
    final Completer<List<ClubSummary>> pending = pendingClubList();
    final FakeAuthRepository auth = FakeAuthRepository()
      ..bootstrapResult = testUser;
    final FakeClubRepository clubs = FakeClubRepository()
      ..pendingClubs = pending.future;
    await _openProfile(tester, auth, clubs, settleClubs: false);

    expect(find.text('테스트 볼러'), findsOneWidget);
    expect(find.text('불러오는 중'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    pending.completeError(
      const ApiException(
        kind: ApiErrorKind.networkUnavailable,
        userMessage: '네트워크 연결을 확인해주세요.',
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('테스트 볼러'), findsOneWidget);
    expect(find.text('네트워크 연결을 확인해주세요.'), findsOneWidget);

    clubs
      ..pendingClubs = null
      ..clubs = const <ClubSummary>[testClub];
    await tester.tap(find.byKey(const Key('profile-clubs-retry')));
    await tester.pumpAndSettle();
    expect(find.text('테스트 동호회'), findsOneWidget);
  });

  testWidgets('MY pull-to-refresh reloads /me and clubs independently', (
    WidgetTester tester,
  ) async {
    const AuthUser refreshed = AuthUser(
      id: 'user-1',
      email: 'new@example.com',
      name: '새 이름',
      role: 'USER',
      handicap: null,
    );
    final FakeAuthRepository auth = FakeAuthRepository()
      ..bootstrapResult = testUser
      ..refreshResult = refreshed;
    final FakeClubRepository clubs = FakeClubRepository();
    await _openProfile(tester, auth, clubs);

    clubs.clubs = const <ClubSummary>[testClub, secondClub];
    await tester.drag(
      find.byKey(const Key('profile-list')),
      const Offset(0, 400),
    );
    await tester.pumpAndSettle();

    expect(auth.refreshCount, 1);
    expect(clubs.clubCalls, 2);
    expect(find.text('새 이름'), findsOneWidget);
    expect(find.text('new@example.com'), findsOneWidget);
    expect(find.text('미설정'), findsOneWidget);
    expect(find.text('2개'), findsOneWidget);
  });

  testWidgets('MY retains current profile when only /me refresh fails', (
    WidgetTester tester,
  ) async {
    final FakeAuthRepository auth = FakeAuthRepository()
      ..bootstrapResult = testUser
      ..refreshError = const ApiException(
        kind: ApiErrorKind.networkUnavailable,
        userMessage: '네트워크 연결을 확인해주세요.',
      );
    final FakeClubRepository clubs = FakeClubRepository();
    await _openProfile(tester, auth, clubs);

    await tester.drag(
      find.byKey(const Key('profile-list')),
      const Offset(0, 400),
    );
    await tester.pumpAndSettle();

    expect(find.text('테스트 볼러'), findsOneWidget);
    expect(find.text('user@example.com'), findsOneWidget);
    expect(find.text('네트워크 연결을 확인해주세요.'), findsOneWidget);
    expect(clubs.clubCalls, 2);
  });

  testWidgets('MY logout prevents repeat taps and returns to login', (
    WidgetTester tester,
  ) async {
    final Completer<void> pendingLogout = Completer<void>();
    final FakeAuthRepository auth = FakeAuthRepository()
      ..bootstrapResult = testUser
      ..pendingLogout = pendingLogout.future;
    await _openProfile(tester, auth, FakeClubRepository());

    await tester.tap(find.byKey(const Key('profile-logout')));
    await tester.pump();
    expect(find.text('로그아웃 중'), findsOneWidget);
    expect(auth.logoutCount, 1);

    await tester.tap(find.byKey(const Key('profile-logout')));
    expect(auth.logoutCount, 1);
    pendingLogout.complete();
    await tester.pumpAndSettle();
    expect(find.text('다시 만나 반가워요'), findsOneWidget);
  });

  testWidgets('MY changes identity without exposing the previous user cache', (
    WidgetTester tester,
  ) async {
    const AuthUser nextUser = AuthUser(
      id: 'user-2',
      email: 'second@example.com',
      name: '두 번째 사용자',
      role: 'USER',
      handicap: 20,
    );
    final FakeAuthRepository auth = FakeAuthRepository()
      ..bootstrapResult = testUser
      ..loginResult = nextUser;
    final FakeClubRepository clubs = FakeClubRepository();
    final ProviderContainer container = await _openProfile(tester, auth, clubs);

    await container
        .read(authControllerProvider.notifier)
        .login('second@example.com', 'password');
    await tester.pumpAndSettle();

    expect(find.text('테스트 볼러'), findsNothing);
    expect(find.text('user@example.com'), findsNothing);
    expect(find.text('두 번째 사용자'), findsOneWidget);
    expect(find.text('second@example.com'), findsOneWidget);
    expect(clubs.clubCalls, 2);
  });

  testWidgets('MY rejects a mismatched /me user without replacing auth state', (
    WidgetTester tester,
  ) async {
    const AuthUser otherUser = AuthUser(
      id: 'other-user',
      email: 'other@example.com',
      name: '다른 사용자',
      role: 'USER',
      handicap: 5,
    );
    final FakeAuthRepository auth = FakeAuthRepository()
      ..bootstrapResult = testUser
      ..refreshResult = otherUser;
    final ProviderContainer container = await _openProfile(
      tester,
      auth,
      FakeClubRepository(),
    );

    await tester.drag(
      find.byKey(const Key('profile-list')),
      const Offset(0, 400),
    );
    await tester.pumpAndSettle();

    expect(container.read(authControllerProvider).user, same(testUser));
    expect(find.text('테스트 볼러'), findsOneWidget);
    expect(find.text('다른 사용자'), findsNothing);
    expect(find.text('서버 응답을 확인할 수 없습니다. 잠시 후 다시 시도해주세요.'), findsOneWidget);
  });

  testWidgets('only the latest concurrent /me refresh updates auth state', (
    WidgetTester tester,
  ) async {
    const AuthUser newestUser = AuthUser(
      id: 'user-1',
      email: 'newest@example.com',
      name: '최신 사용자',
      role: 'USER',
      handicap: 15,
    );
    const AuthUser staleUser = AuthUser(
      id: 'user-1',
      email: 'stale@example.com',
      name: '이전 사용자',
      role: 'USER',
      handicap: 3,
    );
    final Completer<AuthUser> first = Completer<AuthUser>();
    final Completer<AuthUser> second = Completer<AuthUser>();
    final FakeAuthRepository auth = FakeAuthRepository()
      ..bootstrapResult = testUser
      ..pendingRefreshes.addAll(<Future<AuthUser>>[
        first.future,
        second.future,
      ]);
    final ProviderContainer container = await _openProfile(
      tester,
      auth,
      FakeClubRepository(),
    );
    final controller = container.read(authControllerProvider.notifier);

    final Future<AuthUser> firstRefresh = controller.refreshCurrentUser();
    final Future<AuthUser> secondRefresh = controller.refreshCurrentUser();
    second.complete(newestUser);
    await secondRefresh;
    first.complete(staleUser);
    await firstRefresh;
    await tester.pump();

    expect(container.read(authControllerProvider).user, same(newestUser));
    expect(find.text('최신 사용자'), findsOneWidget);
    expect(find.text('이전 사용자'), findsNothing);
  });

  testWidgets('a refresh finishing after logout cannot restore the user', (
    WidgetTester tester,
  ) async {
    final Completer<AuthUser> pending = Completer<AuthUser>();
    final FakeAuthRepository auth = FakeAuthRepository()
      ..bootstrapResult = testUser
      ..pendingRefreshes.add(pending.future);
    final ProviderContainer container = await _openProfile(
      tester,
      auth,
      FakeClubRepository(),
    );
    final controller = container.read(authControllerProvider.notifier);

    final Future<AuthUser> refresh = controller.refreshCurrentUser();
    await controller.logout();
    pending.complete(testUser);
    await refresh;
    await tester.pumpAndSettle();

    expect(
      container.read(authControllerProvider).status,
      AuthStatus.unauthenticated,
    );
    expect(find.text('다시 만나 반가워요'), findsOneWidget);
  });

  testWidgets('a refresh finishing after another login cannot replace it', (
    WidgetTester tester,
  ) async {
    const AuthUser nextUser = AuthUser(
      id: 'user-2',
      email: 'next@example.com',
      name: '새 로그인 사용자',
      role: 'USER',
      handicap: null,
    );
    final Completer<AuthUser> pending = Completer<AuthUser>();
    final FakeAuthRepository auth = FakeAuthRepository()
      ..bootstrapResult = testUser
      ..loginResult = nextUser
      ..pendingRefreshes.add(pending.future);
    final ProviderContainer container = await _openProfile(
      tester,
      auth,
      FakeClubRepository(),
    );
    final controller = container.read(authControllerProvider.notifier);

    final Future<AuthUser> refresh = controller.refreshCurrentUser();
    await controller.login('next@example.com', 'password');
    pending.complete(testUser);
    await refresh;
    await tester.pumpAndSettle();

    expect(container.read(authControllerProvider).user, same(nextUser));
    expect(find.text('새 로그인 사용자'), findsOneWidget);
    expect(find.text('테스트 볼러'), findsNothing);
  });

  testWidgets('MY tab is selected and a club card opens existing detail', (
    WidgetTester tester,
  ) async {
    final FakeAuthRepository auth = FakeAuthRepository()
      ..bootstrapResult = testUser;
    await _openProfile(tester, auth, FakeClubRepository());

    final Semantics myTab = tester.widget<Semantics>(
      find.byWidgetPredicate(
        (Widget widget) =>
            widget is Semantics && widget.properties.label == 'MY',
      ),
    );
    expect(myTab.properties.selected, isTrue);

    await tester.tap(find.byKey(const Key('profile-club-team-1')));
    await tester.pumpAndSettle();
    expect(find.text('동호회 상세'), findsOneWidget);
    expect(find.text('테스트 동호회'), findsOneWidget);

    await tester.tap(find.byKey(const Key('club-back')));
    await tester.pumpAndSettle();
    expect(find.text('MY'), findsWidgets);
    expect(find.text('user@example.com'), findsOneWidget);
  });
}

Future<ProviderContainer> _openProfile(
  WidgetTester tester,
  FakeAuthRepository authRepository,
  FakeClubRepository clubRepository, {
  bool settleClubs = true,
}) async {
  await tester.binding.setSurfaceSize(const Size(600, 1200));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(authRepository),
        dashboardRepositoryProvider.overrideWithValue(
          FakeDashboardRepository(),
        ),
        clubRepositoryProvider.overrideWithValue(clubRepository),
      ],
      child: const BowlingManagerApp(),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('MY'));
  if (settleClubs) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
  return ProviderScope.containerOf(
    tester.element(find.byType(BowlingManagerApp)),
  );
}
