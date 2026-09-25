import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/admin/application/super_admin_providers.dart';
import 'package:bowlingmanager_mobile/features/admin/domain/super_admin_team.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class SuperAdminScreen extends ConsumerWidget {
  const SuperAdminScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(authControllerProvider).user?.role != 'SUPER_ADMIN') {
      return const Center(child: Text('접근 권한이 없습니다.'));
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
      children: <Widget>[
        _Header(title: '슈퍼 관리자', onBack: context.pop),
        const SizedBox(height: 20),
        Card(
          clipBehavior: Clip.antiAlias,
          child: ListTile(
            key: const Key('super-admin-team-features'),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 20,
              vertical: 12,
            ),
            leading: const Icon(
              Icons.admin_panel_settings_outlined,
              color: AppColors.primaryBright,
            ),
            title: const Text('동호회 기능 관리'),
            subtitle: const Text('팀별 Bowler Hidden 활성화 상태를 관리합니다.'),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push('/super-admin/team-features'),
          ),
        ),
      ],
    );
  }
}

class SuperAdminTeamFeaturesScreen extends ConsumerStatefulWidget {
  const SuperAdminTeamFeaturesScreen({super.key});

  @override
  ConsumerState<SuperAdminTeamFeaturesScreen> createState() =>
      _SuperAdminTeamFeaturesScreenState();
}

class _SuperAdminTeamFeaturesScreenState
    extends ConsumerState<SuperAdminTeamFeaturesScreen> {
  final Set<String> _updatingTeamIds = <String>{};

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    if (user?.role != 'SUPER_ADMIN') {
      return const Center(child: Text('접근 권한이 없습니다.'));
    }
    final provider = superAdminTeamsProvider(user!.id);
    final AsyncValue<List<SuperAdminTeam>> teams = ref.watch(provider);
    return ListView(
      key: const Key('super-admin-team-list'),
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
      children: <Widget>[
        _Header(title: '동호회 기능 관리', onBack: context.pop),
        const SizedBox(height: 20),
        teams.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(36),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (Object error, StackTrace _) => _ErrorCard(
            message: _safeErrorMessage(error),
            onRetry: () => ref.invalidate(provider),
          ),
          data: (List<SuperAdminTeam> value) => value.isEmpty
              ? const Card(
                  child: Padding(
                    padding: EdgeInsets.all(28),
                    child: Center(child: Text('관리할 동호회가 없습니다.')),
                  ),
                )
              : Column(
                  children: <Widget>[
                    for (final SuperAdminTeam team in value) ...<Widget>[
                      _TeamCard(
                        team: team,
                        updating: _updatingTeamIds.contains(team.id),
                        onChanged: (bool enabled) =>
                            _confirmAndUpdate(team, enabled, user.id),
                      ),
                      const SizedBox(height: 12),
                    ],
                  ],
                ),
        ),
      ],
    );
  }

  Future<void> _confirmAndUpdate(
    SuperAdminTeam team,
    bool enabled,
    String userId,
  ) async {
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext dialogContext) => AlertDialog(
        title: Text(enabled ? 'Bowler Hidden 활성화' : 'Bowler Hidden 비활성화'),
        content: Text(
          enabled
              ? 'Bowler Hidden을 활성화하면 개인전, 팀전, 이벤트전, 통합 시즌 및 Final 기능을 사용할 수 있습니다.'
              : 'Bowler Hidden을 비활성화하면 개인전, 팀전, 이벤트전, 통합 시즌 및 Final 기능을 사용할 수 없습니다.',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('취소'),
          ),
          FilledButton(
            key: const Key('super-admin-toggle-confirm'),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('확인'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _updatingTeamIds.add(team.id));
    try {
      await ref
          .read(superAdminRepositoryProvider)
          .setBowlerHiddenEnabled(teamId: team.id, enabled: enabled);
      ref.invalidate(superAdminTeamsProvider(userId));
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_safeErrorMessage(error))));
      }
    } finally {
      if (mounted) setState(() => _updatingTeamIds.remove(team.id));
    }
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.title, required this.onBack});

  final String title;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) => Row(
    children: <Widget>[
      IconButton(onPressed: onBack, icon: const Icon(Icons.arrow_back_rounded)),
      const SizedBox(width: 6),
      Text(title, style: AppTextStyles.title),
    ],
  );
}

class _TeamCard extends StatelessWidget {
  const _TeamCard({
    required this.team,
    required this.updating,
    required this.onChanged,
  });

  final SuperAdminTeam team;
  final bool updating;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.fromLTRB(18, 16, 10, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(team.name, style: AppTextStyles.title),
          const SizedBox(height: 4),
          Text(
            '팀 코드 ${team.code}',
            style: const TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            children: <Widget>[
              Chip(
                label: Text(
                  'Season ${team.seasonRankingEnabled ? 'ON' : 'OFF'}',
                ),
              ),
              Chip(
                label: Text(
                  'Bowler Hidden ${team.bowlerHiddenEnabled ? 'ON' : 'OFF'}',
                ),
              ),
            ],
          ),
          SwitchListTile(
            key: Key('super-admin-hidden-${team.id}'),
            contentPadding: EdgeInsets.zero,
            title: const Text('Bowler Hidden'),
            value: team.bowlerHiddenEnabled,
            onChanged: updating ? null : onChanged,
          ),
        ],
      ),
    ),
  );
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: <Widget>[
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          TextButton.icon(
            key: const Key('super-admin-teams-retry'),
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('다시 시도'),
          ),
        ],
      ),
    ),
  );
}

String _safeErrorMessage(Object error) {
  if (error is ApiException) return error.userMessage;
  return '동호회 기능 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
}
