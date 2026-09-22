import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubManagementScreen extends ConsumerWidget {
  const ClubManagementScreen({required this.teamId, super.key});

  final String teamId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final request = (userId: user.id, teamId: teamId);
    return ref
        .watch(clubDetailProvider(request))
        .when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(child: Text(clubErrorMessage(error))),
          data: (ClubDetail club) {
            final bool canManage =
                club.myRole == ClubRole.owner ||
                club.myRole == ClubRole.manager;
            if (!canManage) return const Center(child: Text('관리 권한이 없습니다.'));
            return ListView(
              key: const Key('club-management'),
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
              children: <Widget>[
                Row(
                  children: <Widget>[
                    IconButton(
                      onPressed: context.pop,
                      icon: const Icon(Icons.arrow_back_rounded),
                    ),
                    const SizedBox(width: 6),
                    const Text('동호회 관리', style: AppTextStyles.title),
                  ],
                ),
                const SizedBox(height: 20),
                _ManagementLink(
                  key: const Key('management-manual-link'),
                  icon: Icons.edit_note_rounded,
                  title: '점수 직접 입력',
                  subtitle: '참가자와 게임별 점수를 직접 기록합니다.',
                  onTap: () => context.push(
                    '/club/${Uri.encodeComponent(teamId)}/manage/scores/new',
                  ),
                ),
                const SizedBox(height: 12),
                _ManagementLink(
                  key: const Key('management-capture-link'),
                  icon: Icons.document_scanner_outlined,
                  title: '점수판 촬영',
                  subtitle: '기존 OCR 검수 및 저장 흐름을 사용합니다.',
                  onTap: () => context.push(
                    '/capture?teamId=${Uri.encodeQueryComponent(teamId)}',
                  ),
                ),
                const SizedBox(height: 12),
                _ManagementLink(
                  key: const Key('management-records-link'),
                  icon: Icons.event_note_outlined,
                  title: '기록 관리',
                  subtitle: '활동 상세에서 기록을 수정하거나 삭제합니다.',
                  onTap: () => context.push(
                    '/club/${Uri.encodeComponent(teamId)}/records',
                  ),
                ),
                const SizedBox(height: 12),
                _ManagementLink(
                  key: const Key('management-members-link'),
                  icon: Icons.manage_accounts_outlined,
                  title: '팀원 관리',
                  subtitle: club.myRole == ClubRole.owner
                      ? '팀원 제거와 매니저 권한을 관리합니다.'
                      : '일반 팀원을 관리합니다.',
                  onTap: () => context.push(
                    '/club/${Uri.encodeComponent(teamId)}/members',
                  ),
                ),
              ],
            );
          },
        );
  }
}

class _ManagementLink extends StatelessWidget {
  const _ManagementLink({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    super.key,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      leading: Icon(icon, color: AppColors.primaryBright),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: onTap,
    ),
  );
}
