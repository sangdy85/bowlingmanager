import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
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
    final AsyncValue<ClubTeamProfile> profile = ref.watch(
      clubTeamProfileProvider((userId: user.id, teamId: teamId)),
    );
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
                    if (profile.value?.notice
                        case final String notice) ...<Widget>[
                      const SizedBox(height: 16),
                      Text('공지 · $notice'),
                    ],
                    if (profile.value?.description
                        case final String description) ...<Widget>[
                      const SizedBox(height: 10),
                      Text(
                        description,
                        style: const TextStyle(color: AppColors.textSecondary),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            _ClubMenuCard(
              tileKey: const Key('club-records-link'),
              icon: Icons.query_stats_rounded,
              title: '동호회 기록',
              subtitle: '종합 순위, 종합 기록, 상세 기록',
              onTap: () =>
                  context.push('/club/${Uri.encodeComponent(teamId)}/records'),
            ),
            const SizedBox(height: 12),
            _ClubMenuCard(
              tileKey: const Key('club-events-link'),
              icon: Icons.event_note_rounded,
              title: '일정',
              subtitle: '참석 조사, 게스트, 레인 좌석 추첨',
              onTap: () =>
                  context.push('/club/${Uri.encodeComponent(teamId)}/events'),
            ),
            const SizedBox(height: 12),
            _ClubMenuCard(
              tileKey: const Key('club-members-link'),
              icon: Icons.people_outline_rounded,
              title: '전체 회원 보기',
              subtitle: '${club.memberCount}명의 회원',
              onTap: () =>
                  context.push('/club/${Uri.encodeComponent(teamId)}/members'),
            ),
            const SizedBox(height: 12),
            _ClubMenuCard(
              tileKey: const Key('club-board-link'),
              icon: Icons.forum_outlined,
              title: '게시판',
              subtitle: '동호회 게시글',
              onTap: () =>
                  context.push('/club/${Uri.encodeComponent(teamId)}/board'),
            ),
            if (club.myRole == ClubRole.owner ||
                club.myRole == ClubRole.manager) ...<Widget>[
              const SizedBox(height: 12),
              _ClubMenuCard(
                tileKey: const Key('club-management-link'),
                icon: Icons.admin_panel_settings_outlined,
                title: '관리',
                subtitle: '점수 기록, 기록 관리, 팀원 관리',
                onTap: () =>
                    context.push('/club/${Uri.encodeComponent(teamId)}/manage'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ClubMenuCard extends StatelessWidget {
  const _ClubMenuCard({
    required this.tileKey,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final Key tileKey;
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: SizedBox(
      height: 88,
      child: ListTile(
        key: tileKey,
        minTileHeight: 88,
        contentPadding: const EdgeInsets.symmetric(horizontal: 20),
        leading: Icon(icon, size: 24, color: AppColors.primaryBright),
        title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis),
        trailing: const Icon(Icons.chevron_right_rounded),
        onTap: onTap,
      ),
    ),
  );
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
