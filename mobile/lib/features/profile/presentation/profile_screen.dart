import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_state.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  static const List<_ProfileMenuItem> _items = <_ProfileMenuItem>[
    _ProfileMenuItem('내 정보', Icons.badge_outlined),
    _ProfileMenuItem('핸디캡', Icons.tune_rounded),
    _ProfileMenuItem('알림 설정', Icons.notifications_outlined),
    _ProfileMenuItem('앱 설정', Icons.settings_outlined),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthState authState = ref.watch(authControllerProvider);
    final AuthUser? user = authState.user;
    final bool isLoggingOut =
        authState.isLoading && authState.operation == AuthOperation.logout;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
      children: <Widget>[
        const Text('프로필', style: AppTextStyles.headline),
        const SizedBox(height: 24),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Row(
              children: <Widget>[
                const CircleAvatar(
                  radius: 34,
                  backgroundColor: AppColors.surfaceElevated,
                  child: Icon(
                    Icons.person_rounded,
                    color: AppColors.primaryBright,
                    size: 38,
                  ),
                ),
                const SizedBox(width: 17),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        user?.displayName ?? '볼러님',
                        style: AppTextStyles.title,
                      ),
                      const SizedBox(height: 5),
                      Text(
                        user?.email ?? '',
                        style: const TextStyle(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),
        Card(
          child: Column(
            children: _items.map((_ProfileMenuItem item) {
              return ListTile(
                minTileHeight: 58,
                leading: Icon(item.icon, color: AppColors.textSecondary),
                title: Text(item.label),
                trailing: const Icon(
                  Icons.chevron_right_rounded,
                  color: AppColors.textSecondary,
                ),
                onTap: () {
                  // A later phase will connect profile settings routes.
                },
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 18),
        OutlinedButton.icon(
          onPressed: isLoggingOut
              ? null
              : () => ref.read(authControllerProvider.notifier).logout(),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
            foregroundColor: AppColors.error,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          icon: isLoggingOut
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.logout_rounded),
          label: Text(isLoggingOut ? '로그아웃 중' : '로그아웃'),
        ),
      ],
    );
  }
}

class _ProfileMenuItem {
  const _ProfileMenuItem(this.label, this.icon);

  final String label;
  final IconData icon;
}
