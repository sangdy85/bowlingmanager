import 'package:bowlingmanager_mobile/app/app.dart';
import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_records_models.dart';
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

  testWidgets('Club records shows statistics, filters and activity detail', (
    WidgetTester tester,
  ) async {
    final FakeClubRepository repository = FakeClubRepository();
    await _openClubs(tester, repository);

    await tester.tap(find.byKey(const Key('club-team-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('club-records-link')));
    await tester.pumpAndSettle();

    expect(find.text('동호회 기록'), findsOneWidget);
    expect(find.text('출석 100.0% · 2/2'), findsOneWidget);
    expect(find.text('1월 -'), findsOneWidget);
    expect(find.text('9월 210'), findsOneWidget);

    await tester.tap(find.byKey(const Key('club-records-year')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('2025년').last);
    await tester.pumpAndSettle();
    expect(repository.statisticsCalls, 2);

    await tester.tap(find.text('전체'));
    await tester.pumpAndSettle();
    expect(repository.statisticsCalls, 3);

    await tester.tap(find.text('정기전'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('club-records-year')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('2026년').last);
    await tester.pumpAndSettle();

    await tester.tap(find.text('활동 일지'));
    await tester.pumpAndSettle();
    expect(
      find.byKey(Key('club-activity-${testClubActivity.id}')),
      findsOneWidget,
    );
    await tester.tap(find.byKey(Key('club-activity-${testClubActivity.id}')));
    await tester.pumpAndSettle();

    expect(find.text('경기 상세'), findsOneWidget);
    expect(find.text('1G 200'), findsOneWidget);
    expect(find.text('2G 210'), findsOneWidget);
    expect(find.text('3G 220'), findsOneWidget);
    expect(find.text('총점 630 · AVG 210'), findsOneWidget);
  });

  testWidgets('Club records handles an empty statistics result', (
    WidgetTester tester,
  ) async {
    final FakeClubRepository repository = FakeClubRepository()
      ..statistics = ClubStatistics(
        year: 2026,
        filter: ClubRecordFilter.regular,
        availableYears: const <int>[2026],
        summary: const ClubStatisticsSummary(
          activityCount: 0,
          memberCount: 0,
          attendanceRate: 0,
          gameCount: 0,
          monthlyAverages: <int?>[
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
          ],
          total: 0,
          average: 0,
        ),
        members: const <ClubMemberStatistics>[],
      );
    await _openClubs(tester, repository);
    await tester.tap(find.byKey(const Key('club-team-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('club-records-link')));
    await tester.pumpAndSettle();

    expect(find.text('선택한 조건의 팀원 기록이 없습니다.'), findsOneWidget);
    expect(find.text('0회'), findsOneWidget);
  });

  testWidgets('Club records retries a statistics error', (
    WidgetTester tester,
  ) async {
    const ApiException error = ApiException(
      kind: ApiErrorKind.networkUnavailable,
      userMessage: '네트워크 연결을 확인해주세요.',
    );
    final FakeClubRepository repository = FakeClubRepository()
      ..statisticsError = error;
    await _openClubs(tester, repository);
    await tester.tap(find.byKey(const Key('club-team-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('club-records-link')));
    await tester.pumpAndSettle();
    expect(find.text(error.userMessage), findsOneWidget);

    repository.statisticsError = null;
    await tester.tap(find.text('다시 시도'));
    await tester.pumpAndSettle();
    expect(find.text('출석 100.0% · 2/2'), findsOneWidget);
  });

  testWidgets('Club records avoids overflow with long names and many scores', (
    WidgetTester tester,
  ) async {
    const String longName = '아주 긴 이름을 사용하는 동호회 회원 테스트 볼러';
    final List<ClubMemberStatistics> members =
        List<ClubMemberStatistics>.generate(
          23,
          (int index) => ClubMemberStatistics(
            id: 'member-$index',
            name: index == 0 ? longName : '회원 $index',
            attendanceRate: 100,
            attended: 12,
            activityCount: 12,
            gameCount: 48,
            monthlyAverages: const <int?>[
              200,
              201,
              202,
              203,
              204,
              205,
              206,
              207,
              208,
              209,
              210,
              211,
            ],
            total: 9840,
            average: 205,
          ),
        );
    final FakeClubRepository repository = FakeClubRepository()
      ..statistics = ClubStatistics(
        year: 2026,
        filter: ClubRecordFilter.regular,
        availableYears: const <int>[2026],
        summary: ClubStatisticsSummary(
          activityCount: 12,
          memberCount: members.length,
          attendanceRate: 100,
          gameCount: 1104,
          monthlyAverages: const <int?>[
            200,
            201,
            202,
            203,
            204,
            205,
            206,
            207,
            208,
            209,
            210,
            211,
          ],
          total: 226320,
          average: 205,
        ),
        members: members,
      )
      ..activityDetail = ClubActivityDetail(
        id: testClubActivity.id,
        date: testClubActivity.date,
        gameType: testClubActivity.gameType,
        participantCount: 23,
        gameCount: 276,
        dailyAverage: 205,
        participants: List<ClubActivityParticipant>.generate(
          23,
          (int index) => ClubActivityParticipant(
            rank: index + 1,
            id: 'member-$index',
            name: index == 0 ? longName : '회원 $index',
            scores: index == 0
                ? List<int>.generate(12, (int game) => 200 + game)
                : const <int>[200, 201, 202, 203],
            total: index == 0 ? 2466 : 806,
            average: index == 0 ? 205.5 : 201.5,
          ),
        ),
      );

    await _openClubs(tester, repository, surfaceSize: const Size(360, 720));
    await tester.tap(find.byKey(const Key('club-team-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('club-records-link')));
    await tester.pumpAndSettle();
    expect(find.text(longName), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('활동 일지'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(Key('club-activity-${testClubActivity.id}')));
    await tester.pumpAndSettle();
    expect(find.text('12G 211'), findsOneWidget);
    expect(find.text('총점 2466 · AVG 205.5'), findsOneWidget);
    expect(tester.takeException(), isNull);
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
  Size surfaceSize = const Size(600, 1200),
}) async {
  await tester.binding.setSurfaceSize(surfaceSize);
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
