import 'package:bowlingmanager_mobile/app/app.dart';
import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/shared/widgets/bottom_navigation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';
import 'support/club_fakes.dart';
import 'support/dashboard_fakes.dart';

void main() {
  testWidgets('Club shows an empty state', (WidgetTester tester) async {
    final FakeClubRepository repository = FakeClubRepository()
      ..clubs = const <ClubSummary>[];
    await _openClubs(tester, repository);

    expect(find.text('가입한 동호회가 없습니다.'), findsOneWidget);
  });

  testWidgets('Club shows one or multiple real club cards', (
    WidgetTester tester,
  ) async {
    final FakeClubRepository repository = FakeClubRepository()
      ..clubs = const <ClubSummary>[testClub, secondClub];
    await _openClubs(tester, repository);

    expect(find.text('테스트 동호회'), findsOneWidget);
    expect(find.text('두 번째 동호회'), findsOneWidget);
    expect(find.text('팀장 · 회원 3명'), findsOneWidget);
    expect(find.text('회원 · 회원 8명'), findsOneWidget);
  });

  testWidgets('Club displays loading while the list is pending', (
    WidgetTester tester,
  ) async {
    final pending = pendingClubList();
    final FakeClubRepository repository = FakeClubRepository()
      ..pendingClubs = pending.future;
    await _openClubs(tester, repository, settleClubs: false);

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    pending.complete(const <ClubSummary>[testClub]);
    await tester.pumpAndSettle();
    expect(find.text('테스트 동호회'), findsOneWidget);
  });

  testWidgets('Club retries an initial API error', (WidgetTester tester) async {
    const ApiException error = ApiException(
      kind: ApiErrorKind.networkUnavailable,
      userMessage: '네트워크 연결을 확인해주세요.',
    );
    final FakeClubRepository repository = FakeClubRepository()
      ..clubsError = error;
    await _openClubs(tester, repository);

    expect(find.text(error.userMessage), findsOneWidget);
    repository.clubsError = null;
    await tester.tap(find.text('다시 시도'));
    await tester.pumpAndSettle();
    expect(find.text('테스트 동호회'), findsOneWidget);
    expect(repository.clubCalls, 2);
  });

  testWidgets('Club opens detail and the complete member list', (
    WidgetTester tester,
  ) async {
    final FakeClubRepository repository = FakeClubRepository();
    await _openClubs(tester, repository);

    await tester.tap(find.byKey(const Key('club-team-1')));
    await tester.pumpAndSettle();
    expect(find.text('동호회 상세'), findsOneWidget);
    expect(find.text('팀장'), findsWidgets);
    expect(find.text('3명'), findsOneWidget);

    await tester.tap(find.byKey(const Key('club-members-link')));
    await tester.pumpAndSettle();
    expect(find.text('동호회 회원'), findsOneWidget);
    expect(find.text('매니저'), findsWidgets);
    expect(find.text('회원'), findsWidgets);
    expect(find.text('핸디캡 10'), findsOneWidget);
    expect(repository.detailTeamIds, <String>['team-1']);
    expect(repository.memberTeamIds, <String>['team-1']);
  });

  testWidgets('Club pull-to-refresh reloads the current user list', (
    WidgetTester tester,
  ) async {
    final FakeClubRepository repository = FakeClubRepository();
    await _openClubs(tester, repository);

    await tester.drag(find.byKey(const Key('club-list')), const Offset(0, 400));
    await tester.pumpAndSettle();
    expect(repository.clubCalls, 2);
  });

  testWidgets('nested club and capture routes keep their bottom tab selected', (
    WidgetTester tester,
  ) async {
    Future<void> expectSelected(String path, String label) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            bottomNavigationBar: AppBottomNavigation(
              currentPath: path,
              onSelected: (_) {},
            ),
          ),
        ),
      );
      final Semantics semantics = tester.widget<Semantics>(
        find.byWidgetPredicate(
          (Widget widget) =>
              widget is Semantics && widget.properties.label == label,
        ),
      );
      expect(semantics.properties.selected, isTrue);
    }

    await expectSelected('/club/team-1', '동호회');
    await expectSelected('/club/team-1/members', '동호회');
    await expectSelected('/capture/review', '촬영');
  });
}

Future<void> _openClubs(
  WidgetTester tester,
  FakeClubRepository clubRepository, {
  bool settleClubs = true,
}) async {
  await tester.binding.setSurfaceSize(const Size(600, 1200));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  final FakeAuthRepository authRepository = FakeAuthRepository()
    ..bootstrapResult = testUser;
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
  await tester.tap(find.text('동호회'));
  if (settleClubs) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
}
