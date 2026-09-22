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
}
