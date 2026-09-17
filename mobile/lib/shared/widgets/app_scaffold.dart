import 'package:bowlingmanager_mobile/shared/widgets/bottom_navigation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class AppScaffold extends StatelessWidget {
  const AppScaffold({
    required this.currentPath,
    required this.child,
    super.key,
  });

  final String currentPath;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(bottom: false, child: child),
      bottomNavigationBar: AppBottomNavigation(
        currentPath: currentPath,
        onSelected: (String path) {
          if (path != currentPath) {
            context.go(path);
          }
        },
      ),
    );
  }
}
