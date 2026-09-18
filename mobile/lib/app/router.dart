import 'package:bowlingmanager_mobile/features/auth/presentation/login_screen.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_state.dart';
import 'package:bowlingmanager_mobile/features/capture/presentation/capture_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_screen.dart';
import 'package:bowlingmanager_mobile/features/home/presentation/home_screen.dart';
import 'package:bowlingmanager_mobile/features/profile/presentation/profile_screen.dart';
import 'package:bowlingmanager_mobile/features/records/presentation/records_screen.dart';
import 'package:bowlingmanager_mobile/features/splash/presentation/splash_screen.dart';
import 'package:bowlingmanager_mobile/shared/widgets/app_scaffold.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

final Provider<GoRouter> appRouterProvider = Provider<GoRouter>((Ref ref) {
  final _RouterRefreshNotifier refreshNotifier = _RouterRefreshNotifier();
  ref.listen<AuthState>(authControllerProvider, (
    AuthState? previous,
    AuthState next,
  ) {
    refreshNotifier.refresh();
  });

  final GoRouter router = GoRouter(
    initialLocation: '/splash',
    refreshListenable: refreshNotifier,
    redirect: (BuildContext context, GoRouterState routerState) {
      final AuthState authState = ref.read(authControllerProvider);
      final String location = routerState.matchedLocation;
      final bool isSplash = location == '/splash';
      final bool isLogin = location == '/login';

      if (authState.isBootstrapping) return isSplash ? null : '/splash';
      if (authState.isLoading) return null;
      if (authState.isAuthenticated) {
        return isSplash || isLogin ? '/home' : null;
      }
      return isLogin ? null : '/login';
    },
    routes: <RouteBase>[
      GoRoute(
        path: '/splash',
        builder: (BuildContext context, GoRouterState state) =>
            const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (BuildContext context, GoRouterState state) =>
            const LoginScreen(),
      ),
      ShellRoute(
        builder: (BuildContext context, GoRouterState state, Widget child) {
          return AppScaffold(currentPath: state.uri.path, child: child);
        },
        routes: <RouteBase>[
          GoRoute(
            path: '/home',
            builder: (BuildContext context, GoRouterState state) =>
                const HomeScreen(),
          ),
          GoRoute(
            path: '/records',
            builder: (BuildContext context, GoRouterState state) =>
                const RecordsScreen(),
          ),
          GoRoute(
            path: '/capture',
            builder: (BuildContext context, GoRouterState state) =>
                const CaptureScreen(),
          ),
          GoRoute(
            path: '/club',
            builder: (BuildContext context, GoRouterState state) =>
                const ClubScreen(),
          ),
          GoRoute(
            path: '/profile',
            builder: (BuildContext context, GoRouterState state) =>
                const ProfileScreen(),
          ),
        ],
      ),
    ],
  );

  ref.onDispose(() {
    refreshNotifier.dispose();
    router.dispose();
  });
  return router;
});

class _RouterRefreshNotifier extends ChangeNotifier {
  void refresh() => notifyListeners();
}
