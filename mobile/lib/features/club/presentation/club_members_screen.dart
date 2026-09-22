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

class ClubMembersScreen extends ConsumerStatefulWidget {
  const ClubMembersScreen({required this.teamId, super.key});

  final String teamId;

  @override
  ConsumerState<ClubMembersScreen> createState() => _ClubMembersScreenState();
}

class _ClubMembersScreenState extends ConsumerState<ClubMembersScreen> {
  final Set<String> _pendingMemberActions = <String>{};

  @override
  Widget build(BuildContext context) {
    final AuthUser? user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final ClubRequest request = (userId: user.id, teamId: widget.teamId);
    final provider = clubMembersProvider(request);
    final AsyncValue<List<ClubMember>> members = ref.watch(provider);
    final AsyncValue<ClubDetail> detail = ref.watch(
      clubDetailProvider(request),
    );
    Future<void> refresh() => ref.refresh(provider.future);

    if (detail.isLoading) {
      return const _MembersFrame(
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (detail.hasError) {
      return _MembersFrame(
        child: ClubErrorCard(
          message: clubErrorMessage(detail.error!),
          onRetry: () => ref.refresh(clubDetailProvider(request).future),
        ),
      );
    }
    final ClubRole myRole = detail.requireValue.myRole;
    return members.when(
      loading: () => const _MembersFrame(
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (Object error, StackTrace stackTrace) => _MembersFrame(
        child: ClubErrorCard(
          message: clubErrorMessage(error),
          onRetry: refresh,
        ),
      ),
      data: (List<ClubMember> data) => RefreshIndicator(
        onRefresh: refresh,
        child: ListView(
          key: const Key('club-members-list'),
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
          children: <Widget>[
            const _MembersHeader(),
            const SizedBox(height: 20),
            if (data.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: Text('표시할 회원이 없습니다.')),
                ),
              )
            else
              for (final ClubMember member in data) ...<Widget>[
                _MemberCard(
                  member: member,
                  myRole: myRole,
                  busy: _pendingMemberActions.any(
                    (String action) => action.endsWith(':${member.id}'),
                  ),
                  onRemove: () => _removeMember(context, user.id, member),
                  onRoleChange: (ClubRole role) =>
                      _changeRole(context, user.id, member, role),
                ),
                const SizedBox(height: 10),
              ],
          ],
        ),
      ),
    );
  }

  Future<void> _removeMember(
    BuildContext context,
    String userId,
    ClubMember member,
  ) async {
    final String actionKey = 'remove:${member.id}';
    if (_pendingMemberActions.contains(actionKey)) return;
    setState(() => _pendingMemberActions.add(actionKey));
    try {
      final bool confirmed =
          await showDialog<bool>(
            context: context,
            builder: (dialogContext) => AlertDialog(
              title: const Text('팀원 제거'),
              content: Text(
                '${member.name}님을 팀에서 제거할까요?\n기존 점수는 비회원 기록으로 보존됩니다.',
              ),
              actions: <Widget>[
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext, false),
                  child: const Text('취소'),
                ),
                FilledButton(
                  key: const Key('member-remove-confirm'),
                  onPressed: () => Navigator.pop(dialogContext, true),
                  child: const Text('제거'),
                ),
              ],
            ),
          ) ??
          false;
      if (!confirmed) return;
      await ref
          .read(clubRepositoryProvider)
          .removeMember(teamId: widget.teamId, memberId: member.id);
      _invalidate(userId);
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('팀원을 제거했습니다.')));
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
      }
    } finally {
      if (mounted) {
        setState(() => _pendingMemberActions.remove(actionKey));
      }
    }
  }

  Future<void> _changeRole(
    BuildContext context,
    String userId,
    ClubMember member,
    ClubRole role,
  ) async {
    final String actionKey = 'role:${member.id}';
    if (_pendingMemberActions.contains(actionKey)) return;
    setState(() => _pendingMemberActions.add(actionKey));
    final String action = role == ClubRole.manager ? '매니저로 지정' : '매니저 권한을 해제';
    try {
      final bool confirmed =
          await showDialog<bool>(
            context: context,
            builder: (dialogContext) => AlertDialog(
              title: const Text('권한 변경'),
              content: Text(
                '${member.name}님의 역할을 ${member.role.label}에서 ${role.label}(으)로 변경할까요?',
              ),
              actions: <Widget>[
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext, false),
                  child: const Text('취소'),
                ),
                FilledButton(
                  key: const Key('member-role-confirm'),
                  onPressed: () => Navigator.pop(dialogContext, true),
                  child: Text(action),
                ),
              ],
            ),
          ) ??
          false;
      if (!confirmed) return;
      await ref
          .read(clubRepositoryProvider)
          .changeMemberRole(
            teamId: widget.teamId,
            memberId: member.id,
            role: role,
          );
      _invalidate(userId);
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('권한을 변경했습니다.')));
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
      }
    } finally {
      if (mounted) {
        setState(() => _pendingMemberActions.remove(actionKey));
      }
    }
  }

  void _invalidate(String userId) {
    ref.invalidate(
      clubMembersProvider((userId: userId, teamId: widget.teamId)),
    );
    ref.invalidate(clubDetailProvider((userId: userId, teamId: widget.teamId)));
    ref.invalidate(clubListProvider(userId));
    ref.invalidate(clubStatisticsProvider);
    ref.invalidate(clubActivitiesControllerProvider);
    ref.invalidate(clubActivityProvider);
    ref.invalidate(clubActivityEditProvider);
  }
}

class _MembersFrame extends StatelessWidget {
  const _MembersFrame({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
      children: <Widget>[
        const _MembersHeader(),
        const SizedBox(height: 72),
        child,
      ],
    );
  }
}

class _MembersHeader extends StatelessWidget {
  const _MembersHeader();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        IconButton(
          key: const Key('club-members-back'),
          onPressed: context.pop,
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        const SizedBox(width: 6),
        const Text('동호회 회원', style: AppTextStyles.title),
      ],
    );
  }
}

class _MemberCard extends StatelessWidget {
  const _MemberCard({
    required this.member,
    required this.myRole,
    required this.busy,
    required this.onRemove,
    required this.onRoleChange,
  });

  final ClubMember member;
  final ClubRole myRole;
  final bool busy;
  final VoidCallback onRemove;
  final ValueChanged<ClubRole> onRoleChange;

  @override
  Widget build(BuildContext context) {
    return Card(
      key: Key('club-member-${member.id}'),
      child: Column(
        children: <Widget>[
          ListTile(
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 18,
              vertical: 8,
            ),
            leading: const CircleAvatar(
              backgroundColor: AppColors.primary,
              child: Icon(Icons.person_outline_rounded, color: Colors.white),
            ),
            title: Text(member.name),
            subtitle: member.handicap == null
                ? null
                : Text('핸디캡 ${member.handicap}'),
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.surfaceElevated,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppColors.divider),
              ),
              child: Text(
                member.role.label,
                style: const TextStyle(
                  color: AppColors.primaryBright,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          if ((myRole == ClubRole.owner && member.role != ClubRole.owner) ||
              (myRole == ClubRole.manager && member.role == ClubRole.member))
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 12),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: <Widget>[
                  if (myRole == ClubRole.owner)
                    OutlinedButton(
                      key: Key('member-role-${member.id}'),
                      onPressed: busy
                          ? null
                          : () => onRoleChange(
                              member.role == ClubRole.manager
                                  ? ClubRole.member
                                  : ClubRole.manager,
                            ),
                      child: Text(
                        member.role == ClubRole.manager ? '매니저 해제' : '매니저 지정',
                      ),
                    ),
                  OutlinedButton(
                    key: Key('member-remove-${member.id}'),
                    onPressed: busy ? null : onRemove,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.redAccent,
                    ),
                    child: const Text('팀에서 제거'),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
