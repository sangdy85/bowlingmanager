import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubScreen extends ConsumerWidget {
  const ClubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthUser? user = ref.watch(authControllerProvider).user;
    if (user == null) return const _ClubLoading();

    final provider = clubListProvider(user.id);
    final AsyncValue<List<ClubSummary>> clubs = ref.watch(provider);
    Future<void> refresh() => ref.refresh(provider.future);

    return clubs.when(
      loading: _ClubLoading.new,
      error: (Object error, StackTrace stackTrace) =>
          _ClubError(message: clubErrorMessage(error), onRetry: refresh),
      data: (List<ClubSummary> data) => RefreshIndicator(
        onRefresh: refresh,
        child: ListView(
          key: const Key('club-list'),
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
          children: <Widget>[
            const _ClubHeader(),
            const SizedBox(height: 24),
            if (data.isEmpty)
              const _EmptyClubs()
            else
              for (final ClubSummary club in data) ...<Widget>[
                _ClubCard(club: club),
                const SizedBox(height: 12),
              ],
          ],
        ),
      ),
    );
  }
}

class _ClubHeader extends StatelessWidget {
  const _ClubHeader();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text('나의 동호회', style: AppTextStyles.headline),
        SizedBox(height: 6),
        Text(
          '가입한 동호회와 회원 정보를 확인하세요.',
          style: TextStyle(color: AppColors.textSecondary),
        ),
      ],
    );
  }
}

class _ClubCard extends StatelessWidget {
  const _ClubCard({required this.club});

  final ClubSummary club;

  @override
  Widget build(BuildContext context) {
    return Card(
      key: Key('club-${club.id}'),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/club/${Uri.encodeComponent(club.id)}'),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Row(
            children: <Widget>[
              const CircleAvatar(
                radius: 25,
                backgroundColor: AppColors.primary,
                child: Icon(Icons.groups_rounded, color: Colors.white),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(club.name, style: AppTextStyles.title),
                    const SizedBox(height: 6),
                    Text(
                      '${club.myRole.label} · 회원 ${club.memberCount}명',
                      style: const TextStyle(color: AppColors.textSecondary),
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
    );
  }
}

class _EmptyClubs extends StatelessWidget {
  const _EmptyClubs();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 24, vertical: 44),
        child: Column(
          children: <Widget>[
            Icon(
              Icons.group_off_outlined,
              color: AppColors.textSecondary,
              size: 42,
            ),
            SizedBox(height: 14),
            Text(
              '가입한 동호회가 없습니다.',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ClubLoading extends StatelessWidget {
  const _ClubLoading();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
      children: const <Widget>[
        _ClubHeader(),
        SizedBox(height: 96),
        Center(child: CircularProgressIndicator()),
      ],
    );
  }
}

class _ClubError extends StatelessWidget {
  const _ClubError({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
      children: <Widget>[
        const _ClubHeader(),
        const SizedBox(height: 36),
        ClubErrorCard(message: message, onRetry: onRetry),
      ],
    );
  }
}

class ClubErrorCard extends StatelessWidget {
  const ClubErrorCard({
    required this.message,
    required this.onRetry,
    super.key,
  });

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: <Widget>[
            const Icon(
              Icons.cloud_off_rounded,
              color: AppColors.textSecondary,
              size: 34,
            ),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('다시 시도'),
            ),
          ],
        ),
      ),
    );
  }
}
