import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:flutter/material.dart';

class ClubScreen extends StatelessWidget {
  const ClubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
      children: <Widget>[
        const Text('나의 동호회', style: AppTextStyles.headline),
        const SizedBox(height: 6),
        const Text(
          '함께하는 볼링을 한곳에서 관리하세요.',
          style: TextStyle(color: AppColors.textSecondary),
        ),
        const SizedBox(height: 26),
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: <Color>[Color(0xFF193B61), AppColors.surface],
            ),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFF28527C)),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  CircleAvatar(
                    radius: 27,
                    backgroundColor: AppColors.primary,
                    child: Icon(
                      Icons.bolt_rounded,
                      color: Colors.white,
                      size: 30,
                    ),
                  ),
                  SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text('STRIKE CLUB', style: AppTextStyles.title),
                        SizedBox(height: 4),
                        Text(
                          '멤버 24명',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.textSecondary,
                  ),
                ],
              ),
              SizedBox(height: 24),
              Divider(),
              SizedBox(height: 18),
              Text('최근 정기전', style: AppTextStyles.label),
              SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  Text(
                    '2026.09.14',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    '내 평균 194.3',
                    style: TextStyle(
                      color: AppColors.primaryBright,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: <Widget>[
                const Icon(
                  Icons.calendar_month_outlined,
                  color: AppColors.primaryBright,
                  size: 28,
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text('다음 일정', style: AppTextStyles.title),
                      SizedBox(height: 4),
                      Text(
                        '동호회 일정 API 연결 예정',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  color: AppColors.textSecondary,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
