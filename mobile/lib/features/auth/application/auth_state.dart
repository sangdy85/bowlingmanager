import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';

enum AuthStatus { loading, authenticated, unauthenticated, error }

enum AuthOperation { bootstrap, login, logout }

class AuthState {
  const AuthState._({
    required this.status,
    this.operation,
    this.user,
    this.errorMessage,
  });

  const AuthState.loading(AuthOperation operation, {AuthUser? user})
    : this._(status: AuthStatus.loading, operation: operation, user: user);

  const AuthState.authenticated(AuthUser user)
    : this._(status: AuthStatus.authenticated, user: user);

  const AuthState.unauthenticated()
    : this._(status: AuthStatus.unauthenticated);

  const AuthState.error(String message)
    : this._(status: AuthStatus.error, errorMessage: message);

  final AuthStatus status;
  final AuthOperation? operation;
  final AuthUser? user;
  final String? errorMessage;

  bool get isLoading => status == AuthStatus.loading;
  bool get isBootstrapping =>
      status == AuthStatus.loading && operation == AuthOperation.bootstrap;
  bool get isAuthenticated => status == AuthStatus.authenticated;
}
