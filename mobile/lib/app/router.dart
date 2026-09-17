import 'package:bowlingmanager_mobile/features/auth/presentation/login_screen.dart';
import 'package:bowlingmanager_mobile/features/capture/presentation/capture_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_screen.dart';
import 'package:bowlingmanager_mobile/features/home/presentation/home_screen.dart';
import 'package:bowlingmanager_mobile/features/profile/presentation/profile_screen.dart';
import 'package:bowlingmanager_mobile/features/records/presentation/records_screen.dart';
import 'package:bowlingmanager_mobile/features/splash/presentation/splash_screen.dart';
import 'package:bowlingmanager_mobile/shared/widgets/app_scaffold.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/splash',
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
