import 'package:bowlingmanager_mobile/app/router.dart';
import 'package:bowlingmanager_mobile/core/theme/app_theme.dart';
import 'package:flutter/material.dart';

class BowlingManagerApp extends StatelessWidget {
  const BowlingManagerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'BowlingManager',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      routerConfig: appRouter,
    );
  }
}
