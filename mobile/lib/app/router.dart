import 'package:bowlingmanager_mobile/features/auth/presentation/login_screen.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_state.dart';
import 'package:bowlingmanager_mobile/features/admin/presentation/super_admin_screens.dart';
import 'package:bowlingmanager_mobile/features/capture/presentation/capture_screen.dart';
import 'package:bowlingmanager_mobile/features/capture/presentation/capture_review_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_detail_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_event_detail_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_event_form_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_events_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_activity_detail_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_activity_edit_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_management_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_manual_score_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_members_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_member_detail_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_board_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_post_detail_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_post_form_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_team_settings_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_records_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_season_ranking_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_season_finals_screen.dart';
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
                CaptureScreen(
                  initialTeamId: state.uri.queryParameters['teamId'],
                ),
          ),
          GoRoute(
            path: '/capture/review',
            builder: (BuildContext context, GoRouterState state) =>
                const CaptureReviewScreen(),
          ),
          GoRoute(
            path: '/club',
            builder: (BuildContext context, GoRouterState state) =>
                const ClubScreen(),
            routes: <RouteBase>[
              GoRoute(
                path: ':teamId',
                builder: (BuildContext context, GoRouterState state) =>
                    ClubDetailScreen(teamId: state.pathParameters['teamId']!),
                routes: <RouteBase>[
                  GoRoute(
                    path: 'members',
                    builder: (BuildContext context, GoRouterState state) =>
                        ClubMembersScreen(
                          teamId: state.pathParameters['teamId']!,
                        ),
                    routes: <RouteBase>[
                      GoRoute(
                        path: ':memberId',
                        builder: (BuildContext context, GoRouterState state) =>
                            ClubMemberDetailScreen(
                              teamId: state.pathParameters['teamId']!,
                              memberId: state.pathParameters['memberId']!,
                            ),
                      ),
                    ],
                  ),
                  GoRoute(
                    path: 'board',
                    builder: (BuildContext context, GoRouterState state) =>
                        ClubBoardScreen(
                          teamId: state.pathParameters['teamId']!,
                        ),
                    routes: <RouteBase>[
                      GoRoute(
                        path: 'new',
                        builder: (BuildContext context, GoRouterState state) =>
                            ClubPostFormScreen(
                              teamId: state.pathParameters['teamId']!,
                            ),
                      ),
                      GoRoute(
                        path: ':postId',
                        builder: (BuildContext context, GoRouterState state) =>
                            ClubPostDetailScreen(
                              teamId: state.pathParameters['teamId']!,
                              postId: state.pathParameters['postId']!,
                            ),
                        routes: <RouteBase>[
                          GoRoute(
                            path: 'edit',
                            builder:
                                (BuildContext context, GoRouterState state) =>
                                    ClubPostFormScreen(
                                      teamId: state.pathParameters['teamId']!,
                                      postId: state.pathParameters['postId']!,
                                    ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  GoRoute(
                    path: 'events',
                    builder: (BuildContext context, GoRouterState state) =>
                        ClubEventsScreen(
                          teamId: state.pathParameters['teamId']!,
                        ),
                    routes: <RouteBase>[
                      GoRoute(
                        path: 'new',
                        builder: (BuildContext context, GoRouterState state) =>
                            ClubEventFormScreen(
                              teamId: state.pathParameters['teamId']!,
                            ),
                      ),
                      GoRoute(
                        path: ':eventId',
                        builder: (BuildContext context, GoRouterState state) =>
                            ClubEventDetailScreen(
                              teamId: state.pathParameters['teamId']!,
                              eventId: state.pathParameters['eventId']!,
                            ),
                        routes: <RouteBase>[
                          GoRoute(
                            path: 'edit',
                            builder:
                                (BuildContext context, GoRouterState state) =>
                                    ClubEventFormScreen(
                                      teamId: state.pathParameters['teamId']!,
                                      eventId: state.pathParameters['eventId']!,
                                    ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  GoRoute(
                    path: 'manage',
                    builder: (BuildContext context, GoRouterState state) =>
                        ClubManagementScreen(
                          teamId: state.pathParameters['teamId']!,
                        ),
                    routes: <RouteBase>[
                      GoRoute(
                        path: 'members',
                        builder: (BuildContext context, GoRouterState state) =>
                            ClubMembersScreen(
                              teamId: state.pathParameters['teamId']!,
                              managementMode: true,
                            ),
                      ),
                      GoRoute(
                        path: 'team',
                        builder: (BuildContext context, GoRouterState state) =>
                            ClubTeamSettingsScreen(
                              teamId: state.pathParameters['teamId']!,
                            ),
                      ),
                      GoRoute(
                        path: 'scores/new',
                        builder: (BuildContext context, GoRouterState state) =>
                            ClubManualScoreScreen(
                              teamId: state.pathParameters['teamId']!,
                            ),
                      ),
                    ],
                  ),
                  GoRoute(
                    path: 'records',
                    builder: (BuildContext context, GoRouterState state) =>
                        ClubRecordsScreen(
                          teamId: state.pathParameters['teamId']!,
                          initialSection:
                              switch (state.uri.queryParameters['section']) {
                                'statistics' => 1,
                                'activities' => 2,
                                _ => 0,
                              },
                        ),
                    routes: <RouteBase>[
                      GoRoute(
                        path: 'season',
                        builder: (BuildContext context, GoRouterState state) =>
                            ClubSeasonRankingScreen(
                              teamId: state.pathParameters['teamId']!,
                            ),
                      ),
                      GoRoute(
                        path: 'season-finals',
                        builder: (BuildContext context, GoRouterState state) =>
                            ClubSeasonFinalsScreen(
                              teamId: state.pathParameters['teamId']!,
                            ),
                        routes: <RouteBase>[
                          GoRoute(
                            path: ':finalId',
                            builder:
                                (BuildContext context, GoRouterState state) =>
                                    ClubSeasonFinalDetailScreen(
                                      teamId: state.pathParameters['teamId']!,
                                      finalId: state.pathParameters['finalId']!,
                                    ),
                          ),
                        ],
                      ),
                      GoRoute(
                        path: ':activityId',
                        builder: (BuildContext context, GoRouterState state) =>
                            ClubActivityDetailScreen(
                              teamId: state.pathParameters['teamId']!,
                              activityId: state.pathParameters['activityId']!,
                            ),
                        routes: <RouteBase>[
                          GoRoute(
                            path: 'edit',
                            builder:
                                (BuildContext context, GoRouterState state) =>
                                    ClubActivityEditScreen(
                                      teamId: state.pathParameters['teamId']!,
                                      activityId:
                                          state.pathParameters['activityId']!,
                                    ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          GoRoute(
            path: '/profile',
            builder: (BuildContext context, GoRouterState state) =>
                const ProfileScreen(),
          ),
          GoRoute(
            path: '/super-admin',
            builder: (BuildContext context, GoRouterState state) =>
                const SuperAdminScreen(),
            routes: <RouteBase>[
              GoRoute(
                path: 'team-features',
                builder: (BuildContext context, GoRouterState state) =>
                    const SuperAdminTeamFeaturesScreen(),
              ),
            ],
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
