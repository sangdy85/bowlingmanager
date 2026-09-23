import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_records_state.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_records_models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/club_fakes.dart';

void main() {
  test('statistics cache key includes user, team, year and filter', () async {
    final FakeClubRepository repository = FakeClubRepository();
    final ProviderContainer container = ProviderContainer(
      overrides: [clubRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);

    for (final ClubStatisticsRequest request in <ClubStatisticsRequest>[
      (
        userId: 'user-1',
        teamId: 'team-1',
        year: 2026,
        filter: ClubRecordFilter.regular,
      ),
      (
        userId: 'user-2',
        teamId: 'team-1',
        year: 2026,
        filter: ClubRecordFilter.regular,
      ),
      (
        userId: 'user-1',
        teamId: 'team-2',
        year: 2026,
        filter: ClubRecordFilter.regular,
      ),
      (
        userId: 'user-1',
        teamId: 'team-1',
        year: 2025,
        filter: ClubRecordFilter.regular,
      ),
      (
        userId: 'user-1',
        teamId: 'team-1',
        year: 2026,
        filter: ClubRecordFilter.all,
      ),
    ]) {
      await container.read(clubStatisticsProvider(request).future);
    }
    expect(repository.statisticsCalls, 5);
  });

  test(
    'activity cache and detail cache are isolated by identity fields',
    () async {
      final FakeClubRepository repository = FakeClubRepository();
      final ProviderContainer container = ProviderContainer(
        overrides: [clubRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);
      final requests = <ClubStatisticsRequest>[
        (
          userId: 'user-1',
          teamId: 'team-1',
          year: 2026,
          filter: ClubRecordFilter.regular,
        ),
        (
          userId: 'user-2',
          teamId: 'team-1',
          year: 2026,
          filter: ClubRecordFilter.regular,
        ),
      ];
      for (final ClubStatisticsRequest request in requests) {
        await container.read(clubActivitiesControllerProvider(request).future);
      }
      for (final ClubActivityRequest request in <ClubActivityRequest>[
        (userId: 'user-1', teamId: 'team-1', activityId: 'activity-1'),
        (userId: 'user-2', teamId: 'team-1', activityId: 'activity-1'),
        (userId: 'user-1', teamId: 'team-2', activityId: 'activity-1'),
        (userId: 'user-1', teamId: 'team-1', activityId: 'activity-2'),
      ]) {
        await container.read(clubActivityProvider(request).future);
      }
      expect(repository.requestedActivityPages, <int>[1, 1]);
      expect(repository.activityCalls, 4);
    },
  );

  test(
    'activity pagination de-duplicates ids and retains data on failure',
    () async {
      final ClubActivity second = ClubActivity(
        id: 'activity-2',
        date: DateTime(2026, 9, 18),
        gameType: '정기전',
        participantCount: 2,
        gameCount: 6,
        dailyAverage: 200,
      );
      final FakeClubRepository repository = FakeClubRepository()
        ..activityPages[1] = ClubActivitiesPage(
          year: 2026,
          filter: ClubRecordFilter.regular,
          items: <ClubActivity>[testClubActivity],
          page: 1,
          limit: 20,
          total: 21,
          totalPages: 2,
        )
        ..activityPageErrors[2] = const ApiException(
          kind: ApiErrorKind.networkUnavailable,
          userMessage: '네트워크 연결을 확인해주세요.',
        );
      final ProviderContainer container = ProviderContainer(
        overrides: [clubRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);
      const ClubStatisticsRequest request = (
        userId: 'user-1',
        teamId: 'team-1',
        year: 2026,
        filter: ClubRecordFilter.regular,
      );
      final provider = clubActivitiesControllerProvider(request);
      await container.read(provider.future);
      await container.read(provider.notifier).loadNextPage();
      expect(
        container.read(provider).value!.items.single.id,
        testClubActivity.id,
      );
      expect(container.read(provider).value!.paginationErrorMessage, isNotNull);

      repository.activityPageErrors.remove(2);
      repository.activityPages[2] = ClubActivitiesPage(
        year: 2026,
        filter: ClubRecordFilter.regular,
        items: <ClubActivity>[testClubActivity, second],
        page: 2,
        limit: 20,
        total: 21,
        totalPages: 2,
      );
      await container.read(provider.notifier).loadNextPage();
      final ClubActivitiesState state = container.read(provider).value!;
      expect(state.items.map((ClubActivity item) => item.id), <String>[
        testClubActivity.id,
        'activity-2',
      ]);
      expect(state.hasNextPage, isFalse);
    },
  );

  test('expanded feed is isolated by user and multi-filter key', () async {
    final FakeClubRepository repository = FakeClubRepository();
    final ProviderContainer container = ProviderContainer(
      overrides: [clubRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);
    for (final ClubActivityFeedRequest request in <ClubActivityFeedRequest>[
      (
        userId: 'user-1',
        teamId: 'team-1',
        year: 2026,
        typesKey: 'REGULAR,CASUAL,HOUSE',
      ),
      (
        userId: 'user-2',
        teamId: 'team-1',
        year: 2026,
        typesKey: 'REGULAR,CASUAL,HOUSE',
      ),
      (userId: 'user-1', teamId: 'team-1', year: 2026, typesKey: 'REGULAR'),
    ]) {
      repository.activityFeed = ClubActivityFeedPage(
        year: 2026,
        types: request.typesKey
            .split(',')
            .map(ClubRecordFilter.fromJson)
            .toList(),
        currentMemberId: 'member-1',
        items: <ClubActivityFeedItem>[testClubActivityFeedItem],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      );
      await container.read(clubActivityFeedControllerProvider(request).future);
    }
    expect(repository.requestedActivityFeedPages, <int>[1, 1, 1]);
  });

  test(
    'expanded feed pagination de-duplicates and retains rows on failure',
    () async {
      final ClubActivityFeedItem second = ClubActivityFeedItem(
        id: '2026-09-18~REGULAR',
        date: DateTime(2026, 9, 18),
        gameType: '정기전',
        participantCount: 1,
        gameCount: 1,
        dailyAverage: 200,
        participants: testClubActivityDetail.participants,
        canManage: false,
      );
      final FakeClubRepository repository = FakeClubRepository()
        ..activityFeedPages[1] = ClubActivityFeedPage(
          year: 2026,
          types: const <ClubRecordFilter>[ClubRecordFilter.regular],
          currentMemberId: 'member-1',
          items: <ClubActivityFeedItem>[testClubActivityFeedItem],
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 2,
        )
        ..activityPageErrors[2] = const ApiException(
          kind: ApiErrorKind.networkUnavailable,
          userMessage: '네트워크 연결을 확인해주세요.',
        );
      final ProviderContainer container = ProviderContainer(
        overrides: [clubRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);
      const ClubActivityFeedRequest request = (
        userId: 'user-1',
        teamId: 'team-1',
        year: 2026,
        typesKey: 'REGULAR',
      );
      final provider = clubActivityFeedControllerProvider(request);
      await container.read(provider.future);
      await container.read(provider.notifier).loadNextPage();
      expect(container.read(provider).value!.items.length, 1);
      expect(container.read(provider).value!.paginationErrorMessage, isNotNull);

      repository.activityPageErrors.remove(2);
      repository.activityFeedPages[2] = ClubActivityFeedPage(
        year: 2026,
        types: const <ClubRecordFilter>[ClubRecordFilter.regular],
        currentMemberId: 'member-1',
        items: <ClubActivityFeedItem>[testClubActivityFeedItem, second],
        page: 2,
        limit: 10,
        total: 2,
        totalPages: 2,
      );
      await container.read(provider.notifier).loadNextPage();
      expect(
        container.read(provider).value!.items.map((item) => item.id),
        <String>[testClubActivity.id, second.id],
      );
    },
  );
}
