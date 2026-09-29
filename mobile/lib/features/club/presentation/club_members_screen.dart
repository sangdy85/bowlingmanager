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
  const ClubMembersScreen({
    required this.teamId,
    this.managementMode = false,
    super.key,
  });

  final String teamId;
  final bool managementMode;

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
                  managementMode: widget.managementMode,
                  busy: _pendingMemberActions.any(
                    (String action) => action.endsWith(':${member.id}'),
                  ),
                  onRemove: () => _removeMember(context, user.id, member),
                  onRoleChange: (ClubRole role) =>
                      _changeRole(context, user.id, member, role),
                  onBlindChange: () => _changeBlind(context, user.id, member),
                  onOpen: () => context.push(
                    '/club/${Uri.encodeComponent(widget.teamId)}/members/${Uri.encodeComponent(member.id)}',
                  ),
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

  Future<void> _changeBlind(
    BuildContext context,
    String userId,
    ClubMember member,
  ) async {
    final String actionKey = 'blind:${member.id}';
    if (_pendingMemberActions.contains(actionKey)) return;
    setState(() => _pendingMemberActions.add(actionKey));
    final bool nextBlind = !member.isBlinded;
    try {
      final bool confirmed =
          await showDialog<bool>(
            context: context,
            builder: (dialogContext) => AlertDialog(
              title: Text(nextBlind ? '회원 블라인드' : '블라인드 해제'),
              content: Text(
                nextBlind
                    ? '이 회원을 블라인드 처리하시겠습니까?\n회원 자격과 기존 기록은 유지되며 현재 종합순위에서 숨겨집니다.'
                    : '블라인드를 해제하시겠습니까?\n별도 가입 절차 없이 현재 종합순위에 다시 표시됩니다.',
              ),
              actions: <Widget>[
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext, false),
                  child: const Text('취소'),
                ),
                FilledButton(
                  key: const Key('member-blind-confirm'),
                  onPressed: () => Navigator.pop(dialogContext, true),
                  child: Text(nextBlind ? '블라인드' : '해제'),
                ),
              ],
            ),
          ) ??
          false;
      if (!confirmed) return;
      await ref
          .read(clubRepositoryProvider)
          .setMemberBlind(
            teamId: widget.teamId,
            memberId: member.id,
            blind: nextBlind,
          );
      _invalidate(userId);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(nextBlind ? '블라인드 처리했습니다.' : '블라인드를 해제했습니다.')),
        );
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
      }
    } finally {
      if (mounted) setState(() => _pendingMemberActions.remove(actionKey));
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
    required this.managementMode,
    required this.busy,
    required this.onRemove,
    required this.onRoleChange,
    required this.onBlindChange,
    required this.onOpen,
  });

  final ClubMember member;
  final ClubRole myRole;
  final bool managementMode;
  final bool busy;
  final VoidCallback onRemove;
  final ValueChanged<ClubRole> onRoleChange;
  final VoidCallback onBlindChange;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final canManageRoleOrRemove =
        (myRole == ClubRole.owner && member.role != ClubRole.owner) ||
        (myRole == ClubRole.manager && member.role == ClubRole.member);
    final canManageBlind =
        member.role != ClubRole.owner &&
        (myRole == ClubRole.owner || myRole == ClubRole.manager);
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
            title: Wrap(
              spacing: 8,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: <Widget>[
                Text(member.name),
                if (member.isBlinded)
                  Container(
                    key: Key('member-blind-badge-${member.id}'),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.orange.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Text(
                      '블라인드',
                      style: TextStyle(
                        color: Colors.orangeAccent,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
              ],
            ),
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
            onTap: managementMode ? null : onOpen,
          ),
          if (managementMode && (canManageRoleOrRemove || canManageBlind))
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
                  if (canManageBlind)
                    OutlinedButton(
                      key: Key('member-blind-${member.id}'),
                      onPressed: busy ? null : onBlindChange,
                      child: Text(member.isBlinded ? '블라인드 해제' : '블라인드'),
                    ),
                  if (canManageRoleOrRemove)
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
