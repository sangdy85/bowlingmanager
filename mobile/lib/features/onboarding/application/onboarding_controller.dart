import 'dart:async';

import 'package:bowlingmanager_mobile/core/storage/onboarding_storage.dart';
import 'package:bowlingmanager_mobile/features/onboarding/application/onboarding_providers.dart';
import 'package:bowlingmanager_mobile/features/onboarding/application/onboarding_state.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class OnboardingController extends Notifier<OnboardingState> {
  late OnboardingStorage _storage;
  bool _bootstrapStarted = false;
  final Completer<void> _bootstrapCompleter = Completer<void>();

  @override
  OnboardingState build() {
    _storage = ref.watch(onboardingStorageProvider);
    if (!_bootstrapStarted) {
      _bootstrapStarted = true;
      unawaited(Future<void>.microtask(bootstrap));
    }
    return const OnboardingState.loading();
  }

  Future<void> bootstrap() async {
    try {
      final OnboardingSnapshot snapshot = await _storage.read();
      state = OnboardingState(
        isInitialized: true,
        completed: snapshot.completed,
        intent: snapshot.intent,
        pendingInviteCode: snapshot.pendingInviteCode,
      );
    } on Object {
      state = const OnboardingState(isInitialized: true, completed: false);
    } finally {
      if (!_bootstrapCompleter.isCompleted) _bootstrapCompleter.complete();
    }
  }

  Future<bool> savePendingInviteCode(String code) async {
    final String? normalized = normalizePendingInviteCode(code);
    if (normalized == null) return false;
    await _bootstrapCompleter.future;
    try {
      await _storage.savePendingInviteCode(normalized);
      state = state.copyWith(pendingInviteCode: normalized, clearError: true);
      return true;
    } on Object {
      return false;
    }
  }

  Future<void> clearPendingInviteCode() async {
    await _bootstrapCompleter.future;
    try {
      await _storage.clearPendingInviteCode();
      state = state.copyWith(clearPendingInvite: true, clearError: true);
    } on Object {
      // Keep the code so a later successful action can retry clearing it.
    }
  }

  Future<bool> complete({OnboardingIntent? intent}) async {
    if (state.isSaving) return false;
    state = state.copyWith(isSaving: true, clearError: true);
    try {
      await _storage.complete(intent: intent);
      state = state.copyWith(
        completed: true,
        intent: intent,
        isSaving: false,
        clearError: true,
      );
      return true;
    } on Object {
      state = state.copyWith(
        isSaving: false,
        errorMessage: '온보딩 정보를 저장하지 못했습니다. 다시 시도해주세요.',
      );
      return false;
    }
  }

  Future<void> consumeIntent() async {
    if (state.intent == null) return;
    try {
      await _storage.consumeIntent();
      state = state.copyWith(clearIntent: true, clearError: true);
    } on Object {
      // Keep the intent so a later visit can retry consuming it safely.
    }
  }
}
