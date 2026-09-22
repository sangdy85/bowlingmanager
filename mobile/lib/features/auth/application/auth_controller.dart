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
  int _currentUserRefreshGeneration = 0;

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
    _currentUserRefreshGeneration += 1;
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
    _currentUserRefreshGeneration += 1;
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

  Future<AuthUser> refreshCurrentUser() async {
    final AuthUser? currentUser = state.user;
    if (!state.isAuthenticated || currentUser == null) {
      throw StateError('An authenticated user is required.');
    }

    final int generation = ++_currentUserRefreshGeneration;
    final AuthUser refreshedUser = await _repository.refreshCurrentUser();
    if (refreshedUser.id != currentUser.id) {
      throw ApiException.malformedResponse();
    }
    if (generation == _currentUserRefreshGeneration &&
        state.isAuthenticated &&
        state.user?.id == currentUser.id) {
      state = AuthState.authenticated(refreshedUser);
    }
    return refreshedUser;
  }

  Future<void> logout() async {
    if (state.isLoading) return;
    _currentUserRefreshGeneration += 1;
    state = AuthState.loading(AuthOperation.logout, user: state.user);
    try {
      await _repository.logout();
    } finally {
      state = const AuthState.unauthenticated();
    }
  }

  void authenticationFailed() {
    _currentUserRefreshGeneration += 1;
    state = const AuthState.unauthenticated();
  }
}
