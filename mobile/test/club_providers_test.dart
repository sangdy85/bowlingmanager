import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/club_fakes.dart';

void main() {
  test('club list cache is isolated by authenticated user id', () async {
    final FakeClubRepository repository = FakeClubRepository();
    final ProviderContainer container = ProviderContainer(
      overrides: [clubRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);

    final List<ClubSummary> first = await container.read(
      clubListProvider('user-1').future,
    );
    final List<ClubSummary> second = await container.read(
      clubListProvider('user-2').future,
    );

    expect(first, <ClubSummary>[testClub]);
    expect(second, <ClubSummary>[testClub]);
    expect(repository.clubCalls, 2);
  });

  test('detail and member caches include both user and team id', () async {
    final FakeClubRepository repository = FakeClubRepository();
    final ProviderContainer container = ProviderContainer(
      overrides: [clubRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);

    await container.read(
      clubDetailProvider((userId: 'user-1', teamId: 'team-1')).future,
    );
    await container.read(
      clubDetailProvider((userId: 'user-2', teamId: 'team-1')).future,
    );
    await container.read(
      clubMembersProvider((userId: 'user-1', teamId: 'team-1')).future,
    );
    await container.read(
      clubMembersProvider((userId: 'user-1', teamId: 'team-2')).future,
    );

    expect(repository.detailCalls, 2);
    expect(repository.memberCalls, 2);
    expect(repository.memberTeamIds, <String>['team-1', 'team-2']);
  });
}
