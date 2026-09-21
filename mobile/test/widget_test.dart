import 'package:bowlingmanager_mobile/app/app.dart';
import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'support/auth_fakes.dart';
import 'support/dashboard_fakes.dart';

void main() {
  testWidgets('splash transitions to the login foundation', (
    WidgetTester tester,
  ) async {
    final FakeAuthRepository repository = FakeAuthRepository();
    final FakeDashboardRepository dashboardRepository =
        FakeDashboardRepository();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(repository),
          dashboardRepositoryProvider.overrideWithValue(dashboardRepository),
        ],
        child: const BowlingManagerApp(),
      ),
    );

    expect(find.text('BowlingManager'), findsOneWidget);
    expect(find.text('볼링을 더 즐겁게,\n기록을 더 특별하게'), findsOneWidget);

    await tester.pumpAndSettle();

    expect(find.text('다시 만나 반가워요'), findsOneWidget);
    expect(find.text('로그인'), findsOneWidget);
  });

  testWidgets('authenticated bootstrap opens home without showing login', (
    WidgetTester tester,
  ) async {
    final FakeAuthRepository repository = FakeAuthRepository()
      ..bootstrapResult = testUser;
    final FakeDashboardRepository dashboardRepository =
        FakeDashboardRepository();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(repository),
          dashboardRepositoryProvider.overrideWithValue(dashboardRepository),
        ],
        child: const BowlingManagerApp(),
      ),
    );

    expect(find.text('BowlingManager'), findsOneWidget);
    await tester.pumpAndSettle();

    expect(repository.bootstrapCount, 1);
    expect(find.text('안녕하세요, 볼러님'), findsOneWidget);
    expect(find.text('다시 만나 반가워요'), findsNothing);
  });

  testWidgets('successful login opens the authenticated home shell', (
    WidgetTester tester,
  ) async {
    final FakeAuthRepository repository = FakeAuthRepository();
    final FakeDashboardRepository dashboardRepository =
        FakeDashboardRepository();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(repository),
          dashboardRepositoryProvider.overrideWithValue(dashboardRepository),
        ],
        child: const BowlingManagerApp(),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextFormField, '이메일'),
      'user@example.com',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, '비밀번호'),
      'password',
    );
    await tester.tap(find.text('로그인'));
    await tester.pumpAndSettle();

    expect(repository.loginCount, 1);
    expect(find.text('안녕하세요, 볼러님'), findsOneWidget);
    expect(find.text('CURRENT AVG'), findsOneWidget);
    expect(find.text('촬영'), findsOneWidget);
  });

  testWidgets('failed login stays unauthenticated and shows backend message', (
    WidgetTester tester,
  ) async {
    final FakeAuthRepository repository = FakeAuthRepository()
      ..loginError = const ApiException(
        kind: ApiErrorKind.unauthorized,
        userMessage: '이메일 또는 비밀번호를 확인해주세요.',
      );
    final FakeDashboardRepository dashboardRepository =
        FakeDashboardRepository();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(repository),
          dashboardRepositoryProvider.overrideWithValue(dashboardRepository),
        ],
        child: const BowlingManagerApp(),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextFormField, '이메일'),
      'user@example.com',
    );
    await tester.enterText(find.widgetWithText(TextFormField, '비밀번호'), 'wrong');
    await tester.tap(find.text('로그인'));
    await tester.pumpAndSettle();

    expect(find.text('이메일 또는 비밀번호를 확인해주세요.'), findsOneWidget);
    expect(find.text('다시 만나 반가워요'), findsOneWidget);
    expect(repository.loginCount, 1);
  });
}
