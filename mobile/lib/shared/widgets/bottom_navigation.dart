import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class AppBottomNavigation extends StatelessWidget {
  const AppBottomNavigation({
    required this.currentPath,
    required this.onSelected,
    super.key,
  });

  final String currentPath;
  final ValueChanged<String> onSelected;

  static const List<_NavigationItem> _items = <_NavigationItem>[
    _NavigationItem('/home', '홈', Icons.home_rounded),
    _NavigationItem('/records', '기록', Icons.bar_chart_rounded),
    _NavigationItem('/capture', '촬영', Icons.camera_alt_rounded),
    _NavigationItem('/club', '동호회', Icons.groups_rounded),
    _NavigationItem('/profile', 'MY', Icons.person_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.divider)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 76,
          child: Row(
            children: _items.map((_NavigationItem item) {
              final bool selected =
                  currentPath == item.path ||
                  currentPath.startsWith('${item.path}/');
              final bool emphasized = item.path == '/capture';
              return Expanded(
                child: Semantics(
                  button: true,
                  selected: selected,
                  label: item.label,
                  child: InkWell(
                    onTap: () => onSelected(item.path),
                    child: emphasized
                        ? _CaptureNavigationItem(item: item, selected: selected)
                        : _StandardNavigationItem(
                            item: item,
                            selected: selected,
                          ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}

class _StandardNavigationItem extends StatelessWidget {
  const _StandardNavigationItem({required this.item, required this.selected});

  final _NavigationItem item;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final Color color = selected
        ? AppColors.primaryBright
        : AppColors.textSecondary;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: <Widget>[
        Icon(item.icon, color: color, size: 25),
        const SizedBox(height: 5),
        Text(
          item.label,
          style: TextStyle(
            color: color,
            fontSize: 11,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

class _CaptureNavigationItem extends StatelessWidget {
  const _CaptureNavigationItem({required this.item, required this.selected});

  final _NavigationItem item;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Transform.translate(
      offset: const Offset(0, -10),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: selected ? AppColors.primaryBright : AppColors.primary,
              shape: BoxShape.circle,
              boxShadow: const <BoxShadow>[
                BoxShadow(
                  color: Color(0x553080ED),
                  blurRadius: 16,
                  offset: Offset(0, 6),
                ),
              ],
            ),
            child: Icon(item.icon, color: Colors.white, size: 27),
          ),
          const SizedBox(height: 3),
          const Text(
            '촬영',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _NavigationItem {
  const _NavigationItem(this.path, this.label, this.icon);

  final String path;
  final String label;
  final IconData icon;
}
