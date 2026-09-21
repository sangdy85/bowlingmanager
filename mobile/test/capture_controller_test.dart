import 'dart:async';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/capture/application/capture_providers.dart';
import 'package:bowlingmanager_mobile/features/capture/application/capture_state.dart';
import 'package:bowlingmanager_mobile/features/capture/data/capture_image_picker.dart';
import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/capture_fakes.dart';

void main() {
  test(
    'selects an image and exposes analysis loading then OCR drafts',
    () async {
      final Completer<List<OcrPlayer>> pending = Completer<List<OcrPlayer>>();
      final FakeCaptureRepository repository = FakeCaptureRepository()
        ..pendingAnalysis = pending;
      final _Harness harness = _Harness(repository);
      addTearDown(harness.dispose);
      await harness.initialState();

      await harness.controller.selectImage(CaptureImageSource.gallery);
      expect(harness.state.image, same(testCaptureImage));

      final Future<bool> analysis = harness.controller.analyze();
      expect(harness.state.isAnalyzing, isTrue);
      pending.complete(testOcrPlayers);
      expect(await analysis, isTrue);
      expect(harness.state.isAnalyzing, isFalse);
      expect(harness.state.players, hasLength(2));
      expect(harness.state.players.first.memberId, 'member-1');
    },
  );

  test('keeps a safe analysis error in state', () async {
    final FakeCaptureRepository repository = FakeCaptureRepository()
      ..analysisError = const ApiException(
        kind: ApiErrorKind.networkUnavailable,
        userMessage: '네트워크 연결을 확인해주세요.',
      );
    final _Harness harness = _Harness(repository);
    addTearDown(harness.dispose);
    await harness.initialState();
    await harness.controller.selectImage(CaptureImageSource.camera);

    expect(await harness.controller.analyze(), isFalse);
    expect(harness.state.errorMessage, '네트워크 연결을 확인해주세요.');
  });

  test(
    'edits review rows and rejects an invalid score before saving',
    () async {
      final FakeCaptureRepository repository = FakeCaptureRepository();
      final _Harness harness = _Harness(repository);
      addTearDown(harness.dispose);
      await harness.initialState();
      await harness.controller.selectImage(CaptureImageSource.gallery);
      await harness.controller.analyze();

      harness.controller.updatePlayerName(0, '수정 회원');
      harness.controller.updateScore(0, 0, '301');
      harness.controller.removePlayer(1);
      expect(harness.state.players.single.memberId, isNull);
      expect(await harness.controller.save(), isNull);
      expect(repository.saveCalls, 0);
      expect(harness.state.errorMessage, contains('0에서 300'));
    },
  );

  test('prevents duplicate save while request is pending', () async {
    final Completer<BulkSaveResult> pending = Completer<BulkSaveResult>();
    final FakeCaptureRepository repository = FakeCaptureRepository()
      ..pendingSave = pending;
    final _Harness harness = _Harness(repository);
    addTearDown(harness.dispose);
    await harness.initialState();
    await harness.controller.selectImage(CaptureImageSource.gallery);
    await harness.controller.analyze();

    final Future<BulkSaveResult?> first = harness.controller.save();
    final Future<BulkSaveResult?> second = harness.controller.save();
    expect(harness.state.isSaving, isTrue);
    expect(await second, isNull);
    expect(repository.saveCalls, 1);
    pending.complete(const BulkSaveResult(createdCount: 3, playerCount: 2));
    expect((await first)?.createdCount, 3);
    expect(harness.state.isSaving, isFalse);
  });

  test('save failure keeps review data and shows its message', () async {
    final FakeCaptureRepository repository = FakeCaptureRepository()
      ..saveError = const ApiException(
        kind: ApiErrorKind.server,
        userMessage: '서버에 문제가 발생했습니다.',
      );
    final _Harness harness = _Harness(repository);
    addTearDown(harness.dispose);
    await harness.initialState();
    await harness.controller.selectImage(CaptureImageSource.gallery);
    await harness.controller.analyze();

    expect(await harness.controller.save(), isNull);
    expect(harness.state.players, hasLength(2));
    expect(harness.state.errorMessage, '서버에 문제가 발생했습니다.');
  });
}

class _Harness {
  _Harness(FakeCaptureRepository repository)
    : container = ProviderContainer(
        overrides: [
          captureRepositoryProvider.overrideWithValue(repository),
          captureImagePickerProvider.overrideWithValue(
            FakeCaptureImagePicker(),
          ),
        ],
      ) {
    subscription = container.listen<AsyncValue<CaptureState>>(
      provider,
      (AsyncValue<CaptureState>? previous, AsyncValue<CaptureState> next) {},
    );
  }

  final ProviderContainer container;
  late final ProviderSubscription<AsyncValue<CaptureState>> subscription;
  final provider = captureControllerProvider('user-1');

  CaptureController get controller => container.read(provider.notifier);
  CaptureState get state => container.read(provider).value!;
  Future<CaptureState> initialState() => container.read(provider.future);

  void dispose() {
    subscription.close();
    container.dispose();
  }
}
