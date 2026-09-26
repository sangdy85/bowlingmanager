import 'dart:async';

import 'package:bowlingmanager_mobile/app/router.dart';
import 'package:bowlingmanager_mobile/core/theme/app_theme.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/notifications/application/notification_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class BowlingManagerApp extends ConsumerWidget {
  const BowlingManagerApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    final notifications = ref.watch(notificationCoordinatorProvider);
    notifications.initialize(router.go);
    unawaited(notifications.handleAuthState(ref.watch(authControllerProvider)));
    return MaterialApp.router(
      title: 'BowlingManager',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      routerConfig: router,
    );
  }
}
