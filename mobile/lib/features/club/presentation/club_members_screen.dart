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

class ClubMembersScreen extends ConsumerWidget {
  const ClubMembersScreen({required this.teamId, super.key});

  final String teamId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthUser? user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final ClubRequest request = (userId: user.id, teamId: teamId);
    final provider = clubMembersProvider(request);
    final AsyncValue<List<ClubMember>> members = ref.watch(provider);
    Future<void> refresh() => ref.refresh(provider.future);

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
                _MemberCard(member: member),
                const SizedBox(height: 10),
              ],
          ],
        ),
      ),
    );
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
  const _MemberCard({required this.member});

  final ClubMember member;

  @override
  Widget build(BuildContext context) {
    return Card(
      key: Key('club-member-${member.id}'),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
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
    );
  }
}
