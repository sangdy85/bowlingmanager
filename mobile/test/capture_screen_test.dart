import 'package:bowlingmanager_mobile/app/app.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/capture/application/capture_providers.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';
import 'support/capture_fakes.dart';
import 'support/dashboard_fakes.dart';

void main() {
  testWidgets('capture selects an image, analyzes it and opens review', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(600, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final FakeCaptureRepository repository = FakeCaptureRepository();
    final FakeCaptureImagePicker picker = FakeCaptureImagePicker();
    await _pumpApp(tester, repository, picker);

    await tester.tap(find.text('촬영'));
    await tester.pumpAndSettle();
    expect(find.text('점수판 촬영'), findsOneWidget);
    expect(find.byKey(const Key('capture-analyze')), findsOneWidget);

    await tester.tap(find.byKey(const Key('capture-gallery')));
    await tester.pumpAndSettle();
    expect(picker.pickCalls, 1);
    expect(find.byKey(const Key('capture-preview')), findsOneWidget);

    await tester.tap(find.byKey(const Key('capture-analyze')));
    await tester.pumpAndSettle();
    expect(repository.analysisCalls, 1);
    expect(find.text('인식 결과 확인'), findsOneWidget);
    expect(find.byKey(const Key('player-name-0')), findsOneWidget);
    expect(find.byKey(const Key('score-0-0')), findsOneWidget);
  });

  testWidgets('review supports score editing and player deletion', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(600, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final FakeCaptureRepository repository = FakeCaptureRepository();
    await _pumpApp(tester, repository, FakeCaptureImagePicker());
    await tester.tap(find.text('촬영'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('capture-gallery')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('capture-analyze')));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('score-0-0')), '250');
    await tester.tap(find.byKey(const Key('remove-player-1')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('remove-player-1')), findsNothing);
    expect(find.text('250'), findsOneWidget);
  });

  testWidgets(
    'review preserves Korean IME composing while player name updates',
    (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(600, 1400));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final FakeCaptureRepository repository = FakeCaptureRepository();
      await _pumpApp(tester, repository, FakeCaptureImagePicker());
      await tester.tap(find.text('촬영'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('capture-gallery')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('capture-analyze')));
      await tester.pumpAndSettle();

      final Finder nameField = find.byKey(const Key('player-name-0'));
      await tester.tap(nameField);
      Future<void> expectComposing(String text) async {
        tester.testTextInput.updateEditingValue(
          TextEditingValue(
            text: text,
            selection: TextSelection.collapsed(offset: text.length),
            composing: TextRange(start: 0, end: text.length),
          ),
        );
        await tester.pump();
        final EditableText editable = tester.widget<EditableText>(
          find.descendant(of: nameField, matching: find.byType(EditableText)),
        );
        expect(editable.controller.value.text, text);
        expect(
          editable.controller.value.composing,
          TextRange(start: 0, end: text.length),
        );
      }

      await expectComposing('ㄱ');
      await expectComposing('가');
      await expectComposing('ㅎ');
      await expectComposing('하');
      await expectComposing('한');

      tester.testTextInput.updateEditingValue(
        const TextEditingValue(
          text: '홍길동',
          selection: TextSelection.collapsed(offset: 3),
          composing: TextRange.empty,
        ),
      );
      await tester.pump();
      await tester.tap(find.byKey(const Key('review-save')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      expect(repository.savedPlayers?.first.name, '홍길동');
    },
  );
}

Future<void> _pumpApp(
  WidgetTester tester,
  FakeCaptureRepository captureRepository,
  FakeCaptureImagePicker picker,
) async {
  final FakeAuthRepository authRepository = FakeAuthRepository()
    ..bootstrapResult = testUser;
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(authRepository),
        dashboardRepositoryProvider.overrideWithValue(
          FakeDashboardRepository(),
        ),
        captureRepositoryProvider.overrideWithValue(captureRepository),
        captureImagePickerProvider.overrideWithValue(picker),
      ],
      child: const BowlingManagerApp(),
    ),
  );
  await tester.pumpAndSettle();
}
