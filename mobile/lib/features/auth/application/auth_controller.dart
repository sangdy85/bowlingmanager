import 'dart:async';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_state.dart';
import 'package:bowlingmanager_mobile/features/auth/data/auth_repository.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AuthController extends Notifier<AuthState> {
  late AuthRepository _repository;
  bool _bootstrapStarted = false;

  @override
  AuthState build() {
    _repository = ref.watch(authRepositoryProvider);
    if (!_bootstrapStarted) {
      _bootstrapStarted = true;
      unawaited(Future<void>.microtask(bootstrap));
    }
    return const AuthState.loading(AuthOperation.bootstrap);
  }

  Future<void> bootstrap() async {
    state = const AuthState.loading(AuthOperation.bootstrap);
    try {
      final AuthUser? user = await _repository.bootstrap();
      state = user == null
          ? const AuthState.unauthenticated()
          : AuthState.authenticated(user);
    } on Object {
      state = const AuthState.unauthenticated();
    }
  }

  Future<void> login(String email, String password) async {
    if (state.isLoading) return;
    state = const AuthState.loading(AuthOperation.login);
    try {
      final AuthUser user = await _repository.login(email.trim(), password);
      state = AuthState.authenticated(user);
    } on ApiException catch (error) {
      state = AuthState.error(error.userMessage);
    } on Object {
      state = const AuthState.error('로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  Future<void> logout() async {
    if (state.isLoading) return;
    state = const AuthState.loading(AuthOperation.logout);
    try {
      await _repository.logout();
    } finally {
      state = const AuthState.unauthenticated();
    }
  }

  void authenticationFailed() {
    state = const AuthState.unauthenticated();
  }
}
