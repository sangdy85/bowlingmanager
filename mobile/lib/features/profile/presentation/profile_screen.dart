import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:flutter/material.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  static const List<_ProfileMenuItem> _items = <_ProfileMenuItem>[
    _ProfileMenuItem('내 정보', Icons.badge_outlined),
    _ProfileMenuItem('핸디캡', Icons.tune_rounded),
    _ProfileMenuItem('알림 설정', Icons.notifications_outlined),
    _ProfileMenuItem('앱 설정', Icons.settings_outlined),
  ];

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
      children: <Widget>[
        const Text('프로필', style: AppTextStyles.headline),
        const SizedBox(height: 24),
        const Card(
          child: Padding(
            padding: EdgeInsets.all(22),
            child: Row(
              children: <Widget>[
                CircleAvatar(
                  radius: 34,
                  backgroundColor: AppColors.surfaceElevated,
                  child: Icon(
                    Icons.person_rounded,
                    color: AppColors.primaryBright,
                    size: 38,
                  ),
                ),
                SizedBox(width: 17),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text('볼러님', style: AppTextStyles.title),
                      SizedBox(height: 5),
                      Text(
                        'user@example.com',
                        style: TextStyle(color: AppColors.textSecondary),
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
          onPressed: null,
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
            foregroundColor: AppColors.error,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          icon: const Icon(Icons.logout_rounded),
          label: const Text('로그아웃'),
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
