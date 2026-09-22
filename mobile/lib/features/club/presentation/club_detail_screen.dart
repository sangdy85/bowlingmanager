import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubDetailScreen extends ConsumerWidget {
  const ClubDetailScreen({required this.teamId, super.key});

  final String teamId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthUser? user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final ClubRequest request = (userId: user.id, teamId: teamId);
    final provider = clubDetailProvider(request);
    final AsyncValue<ClubDetail> detail = ref.watch(provider);
    Future<void> refresh() => ref.refresh(provider.future);

    return detail.when(
      loading: () =>
          const _DetailFrame(child: Center(child: CircularProgressIndicator())),
      error: (Object error, StackTrace stackTrace) => _DetailFrame(
        child: ClubErrorCard(
          message: clubErrorMessage(error),
          onRetry: refresh,
        ),
      ),
      data: (ClubDetail club) => RefreshIndicator(
        onRefresh: refresh,
        child: ListView(
          key: const Key('club-detail'),
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
          children: <Widget>[
            const _BackHeader(title: '동호회 상세'),
            const SizedBox(height: 22),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(22),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(club.name, style: AppTextStyles.headline),
                    const SizedBox(height: 18),
                    _DetailRow(label: '내 역할', value: club.myRole.label),
                    const SizedBox(height: 12),
                    _DetailRow(label: '회원 수', value: '${club.memberCount}명'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              clipBehavior: Clip.antiAlias,
              child: ListTile(
                key: const Key('club-records-link'),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 10,
                ),
                leading: const Icon(
                  Icons.query_stats_rounded,
                  color: AppColors.primaryBright,
                ),
                title: const Text('기록 및 활동 일지'),
                subtitle: const Text('연도별 팀 통계와 경기 결과'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => context.push(
                  '/club/${Uri.encodeComponent(teamId)}/records',
                ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              clipBehavior: Clip.antiAlias,
              child: ListTile(
                key: const Key('club-members-link'),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 10,
                ),
                leading: const Icon(
                  Icons.people_outline_rounded,
                  color: AppColors.primaryBright,
                ),
                title: const Text('전체 회원 보기'),
                subtitle: Text('${club.memberCount}명의 회원'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => context.push(
                  '/club/${Uri.encodeComponent(teamId)}/members',
                ),
              ),
            ),
            if (club.myRole == ClubRole.owner ||
                club.myRole == ClubRole.manager) ...<Widget>[
              const SizedBox(height: 12),
              Card(
                clipBehavior: Clip.antiAlias,
                child: ListTile(
                  key: const Key('club-management-link'),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 10,
                  ),
                  leading: const Icon(
                    Icons.admin_panel_settings_outlined,
                    color: AppColors.primaryBright,
                  ),
                  title: const Text('관리'),
                  subtitle: const Text('점수 기록, 기록 관리, 팀원 관리'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => context.push(
                    '/club/${Uri.encodeComponent(teamId)}/manage',
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _DetailFrame extends StatelessWidget {
  const _DetailFrame({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
      children: <Widget>[
        const _BackHeader(title: '동호회 상세'),
        const SizedBox(height: 72),
        child,
      ],
    );
  }
}

class _BackHeader extends StatelessWidget {
  const _BackHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        IconButton(
          key: const Key('club-back'),
          onPressed: context.pop,
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        const SizedBox(width: 6),
        Text(title, style: AppTextStyles.title),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: <Widget>[
        Text(label, style: const TextStyle(color: AppColors.textSecondary)),
        Text(
          value,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
