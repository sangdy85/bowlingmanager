import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/core/domain/game_session.dart';
import 'package:bowlingmanager_mobile/features/records/application/records_providers.dart';
import 'package:bowlingmanager_mobile/features/records/application/records_state.dart';
import 'package:bowlingmanager_mobile/features/records/data/scores_repository.dart';
import 'package:bowlingmanager_mobile/features/records/domain/score_record.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/records_fakes.dart';

void main() {
  test('loads the first page with the configured limit', () async {
    final FakeScoresRepository repository = FakeScoresRepository();
    final _RecordsHarness harness = _RecordsHarness(repository);
    addTearDown(harness.dispose);

    final RecordsState state = await harness.initialState();

    expect(state.items.single.id, 'score-1');
    expect(repository.requestedPages, <int>[1]);
    expect(repository.requestedLimits, <int>[recordsPageLimit]);
  });

  test('supports an empty first page', () async {
    final FakeScoresRepository repository = FakeScoresRepository()
      ..pages[1] = emptyScoresPage;
    final _RecordsHarness harness = _RecordsHarness(repository);
    addTearDown(harness.dispose);

    final RecordsState state = await harness.initialState();

    expect(state.items, isEmpty);
    expect(state.hasNextPage, isFalse);
  });

  test(
    'appends a next page, removes duplicate IDs and stops at last page',
    () async {
      final FakeScoresRepository repository = FakeScoresRepository()
        ..pages[1] = scoresPage(
          page: 1,
          total: 21,
          items: <GameSession>[scoreRecord('score-1', 201)],
        )
        ..pages[2] = scoresPage(
          page: 2,
          total: 21,
          items: <GameSession>[
            scoreRecord('score-1', 201),
            scoreRecord('score-2', 202),
          ],
        );
      final _RecordsHarness harness = _RecordsHarness(repository);
      addTearDown(harness.dispose);
      await harness.initialState();

      await harness.controller.loadNextPage();
      await harness.controller.loadNextPage();

      final RecordsState state = harness.state;
      expect(state.items.map((GameSession item) => item.id), <String>[
        'score-1',
        'score-2',
      ]);
      expect(state.hasNextPage, isFalse);
      expect(repository.requestedPages, <int>[1, 2]);
    },
  );

  test('keeps existing data after pagination failure and can retry', () async {
    const ApiException error = ApiException(
      kind: ApiErrorKind.networkUnavailable,
      userMessage: '네트워크 연결을 확인해주세요.',
    );
    final FakeScoresRepository repository = FakeScoresRepository()
      ..pages[1] = scoresPage(
        page: 1,
        total: 21,
        items: <GameSession>[scoreRecord('score-1', 201)],
      )
      ..errors[2] = error;
    final _RecordsHarness harness = _RecordsHarness(repository);
    addTearDown(harness.dispose);
    await harness.initialState();

    await harness.controller.loadNextPage();

    expect(harness.state.items.single.id, 'score-1');
    expect(harness.state.pagination.page, 1);
    expect(harness.state.paginationErrorMessage, error.userMessage);

    repository.errors.remove(2);
    repository.pages[2] = scoresPage(
      page: 2,
      total: 21,
      items: <GameSession>[scoreRecord('score-2', 202)],
    );
    await harness.controller.loadNextPage();

    expect(harness.state.items.length, 2);
    expect(harness.state.paginationErrorMessage, isNull);
    expect(repository.requestedPages, <int>[1, 2, 2]);
  });

  test('refresh replaces data with page one', () async {
    final FakeScoresRepository repository = FakeScoresRepository();
    final _RecordsHarness harness = _RecordsHarness(repository);
    addTearDown(harness.dispose);
    await harness.initialState();
    repository.pages[1] = scoresPage(
      page: 1,
      total: 1,
      items: <GameSession>[scoreRecord('replacement', 222)],
    );

    await harness.controller.refreshRecords();

    expect(harness.state.items.single.id, 'replacement');
    expect(repository.requestedPages, <int>[1, 1]);
  });

  test('refresh failure preserves the existing page', () async {
    const ApiException error = ApiException(
      kind: ApiErrorKind.networkUnavailable,
      userMessage: '네트워크 연결을 확인해주세요.',
    );
    final FakeScoresRepository repository = FakeScoresRepository();
    final _RecordsHarness harness = _RecordsHarness(repository);
    addTearDown(harness.dispose);
    await harness.initialState();
    repository.errors[1] = error;

    await harness.controller.refreshRecords();

    expect(harness.state.items.single.id, 'score-1');
    expect(harness.state.refreshErrorMessage, error.userMessage);
    expect(repository.requestedPages, <int>[1, 1]);
  });

  test('prevents duplicate requests while loading the next page', () async {
    final pending = pendingScoresPage();
    final FakeScoresRepository repository = FakeScoresRepository()
      ..pages[1] = scoresPage(
        page: 1,
        total: 21,
        items: <GameSession>[scoreRecord('score-1', 201)],
      )
      ..pendingPages[2] = pending.future;
    final _RecordsHarness harness = _RecordsHarness(repository);
    addTearDown(harness.dispose);
    await harness.initialState();

    final Future<void> first = harness.controller.loadNextPage();
    final Future<void> second = harness.controller.loadNextPage();

    expect(repository.requestedPages, <int>[1, 2]);
    expect(harness.state.isLoadingMore, isTrue);
    pending.complete(
      scoresPage(
        page: 2,
        total: 21,
        items: <GameSession>[scoreRecord('score-2', 202)],
      ),
    );
    await Future.wait(<Future<void>>[first, second]);
    expect(harness.state.items.length, 2);
  });

  test('applies combined filters and resets pagination to page one', () async {
    final FakeScoresRepository repository = FakeScoresRepository()
      ..pages[1] = scoresPage(
        page: 1,
        total: 1,
        items: <GameSession>[scoreRecord('official', 220, year: 2025)],
        availableYears: const <int>[2026, 2025],
      );
    final _RecordsHarness harness = _RecordsHarness(repository);
    addTearDown(harness.dispose);
    await harness.initialState();

    const RecordsFilter filter = RecordsFilter(
      year: 2025,
      category: RecordCategory.official,
      officialCategory: OfficialRecordCategory.standingLeague,
      minAverage: 200,
      maxAverage: 230,
    );
    await harness.controller.applyFilter(filter);

    expect(repository.requestedPages, <int>[1, 1]);
    final RecordsFilter requested = repository.requestedFilters.last;
    expect(requested.year, 2025);
    expect(requested.category, RecordCategory.official);
    expect(requested.officialCategory, OfficialRecordCategory.standingLeague);
    expect(requested.minAverage, 200);
    expect(requested.maxAverage, 230);
    expect(harness.state.pagination.page, 1);
    expect(harness.state.filter.year, 2025);
    expect(harness.state.availableYears, <int>[2026, 2025]);
  });
}

class _RecordsHarness {
  _RecordsHarness(ScoresRepository repository)
    : container = ProviderContainer(
        overrides: [scoresRepositoryProvider.overrideWithValue(repository)],
      ) {
    subscription = container.listen<AsyncValue<RecordsState>>(
      provider,
      (AsyncValue<RecordsState>? previous, AsyncValue<RecordsState> next) {},
    );
  }

  final ProviderContainer container;
  late final ProviderSubscription<AsyncValue<RecordsState>> subscription;
  final provider = recordsControllerProvider('user-1');

  RecordsController get controller => container.read(provider.notifier);
  RecordsState get state => container.read(provider).value!;

  Future<RecordsState> initialState() => container.read(provider.future);

  void dispose() {
    subscription.close();
    container.dispose();
  }
}
