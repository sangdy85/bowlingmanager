import 'package:bowlingmanager_mobile/app/app.dart';
import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/features/records/application/records_providers.dart';
import 'package:bowlingmanager_mobile/features/records/domain/score_record.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';
import 'support/dashboard_fakes.dart';
import 'support/records_fakes.dart';

void main() {
  testWidgets('Records shows loading and then real score fields', (
    WidgetTester tester,
  ) async {
    final pending = pendingScoresPage();
    final FakeScoresRepository repository = FakeScoresRepository()
      ..pendingPages[1] = pending.future;
    await _openRecords(tester, repository, settleRecords: false);

    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    pending.complete(testScoresPage);
    await tester.pumpAndSettle();

    expect(find.text('2026.09.15'), findsOneWidget);
    expect(find.text('215'), findsOneWidget);
    expect(find.text('정기전 · 테스트 팀'), findsOneWidget);
    expect(find.text('synthetic memo'), findsOneWidget);
    expect(find.byType(RefreshIndicator), findsOneWidget);
  });

  testWidgets('Records shows the empty state', (WidgetTester tester) async {
    final FakeScoresRepository repository = FakeScoresRepository()
      ..pages[1] = emptyScoresPage;

    await _openRecords(tester, repository);

    expect(find.text('아직 기록이 없습니다.'), findsOneWidget);
  });

  testWidgets('Records shows an initial error and retries', (
    WidgetTester tester,
  ) async {
    const ApiException error = ApiException(
      kind: ApiErrorKind.networkUnavailable,
      userMessage: '네트워크 연결을 확인해주세요.',
    );
    final FakeScoresRepository repository = FakeScoresRepository()
      ..errors[1] = error;

    await _openRecords(tester, repository);

    expect(find.text(error.userMessage), findsOneWidget);
    repository.errors.remove(1);
    await tester.tap(find.text('다시 시도'));
    await tester.pumpAndSettle();

    expect(find.text('215'), findsOneWidget);
    expect(repository.requestedPages, <int>[1, 1]);
  });

  testWidgets('Records loads another page without replacing existing scores', (
    WidgetTester tester,
  ) async {
    final pending = pendingScoresPage();
    final FakeScoresRepository repository = FakeScoresRepository()
      ..pages[1] = scoresPage(
        page: 1,
        total: 21,
        items: <ScoreRecord>[scoreRecord('score-1', 201)],
      )
      ..pendingPages[2] = pending.future;
    await _openRecords(tester, repository);

    await tester.ensureVisible(find.byKey(const Key('records-load-more')));
    await tester.tap(find.byKey(const Key('records-load-more')));
    await tester.pump();

    expect(find.text('201'), findsOneWidget);
    expect(find.byKey(const Key('records-loading-more')), findsOneWidget);
    pending.complete(
      scoresPage(
        page: 2,
        total: 21,
        items: <ScoreRecord>[scoreRecord('score-2', 202)],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('201'), findsOneWidget);
    expect(find.text('202'), findsOneWidget);
    expect(find.byKey(const Key('records-load-more')), findsNothing);
  });

  testWidgets('Records keeps the list when loading another page fails', (
    WidgetTester tester,
  ) async {
    const ApiException error = ApiException(
      kind: ApiErrorKind.networkUnavailable,
      userMessage: '네트워크 연결을 확인해주세요.',
    );
    final FakeScoresRepository repository = FakeScoresRepository()
      ..pages[1] = scoresPage(
        page: 1,
        total: 21,
        items: <ScoreRecord>[scoreRecord('score-1', 201)],
      )
      ..errors[2] = error;
    await _openRecords(tester, repository);

    await tester.ensureVisible(find.byKey(const Key('records-load-more')));
    await tester.tap(find.byKey(const Key('records-load-more')));
    await tester.pumpAndSettle();

    expect(find.text('201'), findsOneWidget);
    expect(find.text(error.userMessage), findsOneWidget);
    expect(find.text('다시 시도'), findsOneWidget);
  });
}

Future<void> _openRecords(
  WidgetTester tester,
  FakeScoresRepository scoresRepository, {
  bool settleRecords = true,
}) async {
  final FakeAuthRepository authRepository = FakeAuthRepository()
    ..bootstrapResult = testUser;
  final FakeDashboardRepository dashboardRepository = FakeDashboardRepository();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(authRepository),
        dashboardRepositoryProvider.overrideWithValue(dashboardRepository),
        scoresRepositoryProvider.overrideWithValue(scoresRepository),
      ],
      child: const BowlingManagerApp(),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('기록'));
  if (settleRecords) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
}
