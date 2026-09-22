import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_state.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  String? _profileRefreshError;

  @override
  Widget build(BuildContext context) {
    final AuthState authState = ref.watch(authControllerProvider);
    final AuthUser? user = authState.user;
    final bool isLoggingOut =
        authState.isLoading && authState.operation == AuthOperation.logout;

    if (user == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final provider = clubListProvider(user.id);
    final AsyncValue<List<ClubSummary>> clubs = ref.watch(provider);

    return RefreshIndicator(
      onRefresh: () => _refresh(user.id),
      child: ListView(
        key: const Key('profile-list'),
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
        children: <Widget>[
          const Text('MY', style: AppTextStyles.headline),
          const SizedBox(height: 6),
          const Text(
            '계정과 동호회 정보를 확인하세요.',
            style: TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 24),
          _ProfileCard(user: user),
          const SizedBox(height: 16),
          _BowlingInfoCard(handicap: user.handicap, clubs: clubs),
          if (_profileRefreshError case final String message) ...<Widget>[
            const SizedBox(height: 16),
            _InlineError(message: message),
          ],
          const SizedBox(height: 24),
          const Text('가입 동호회', style: AppTextStyles.title),
          const SizedBox(height: 12),
          _ClubSummarySection(
            clubs: clubs,
            onRetry: () async {
              final Future<List<ClubSummary>> refresh = ref.refresh(
                provider.future,
              );
              try {
                await refresh;
              } on Object {
                // The provider error remains visible in this section.
              }
            },
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            key: const Key('profile-logout'),
            onPressed: isLoggingOut
                ? null
                : () => ref.read(authControllerProvider.notifier).logout(),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              foregroundColor: AppColors.error,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            icon: isLoggingOut
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.logout_rounded),
            label: Text(isLoggingOut ? '로그아웃 중' : '로그아웃'),
          ),
        ],
      ),
    );
  }

  Future<void> _refresh(String userId) async {
    String? profileError;
    try {
      await ref.read(authControllerProvider.notifier).refreshCurrentUser();
    } on Object catch (error) {
      profileError = _profileErrorMessage(error);
    }

    final Future<List<ClubSummary>> clubsRefresh = ref.refresh(
      clubListProvider(userId).future,
    );
    try {
      await clubsRefresh;
    } on Object {
      // Club errors are rendered independently while profile data stays visible.
    }

    if (!mounted || ref.read(authControllerProvider).user?.id != userId) return;
    setState(() => _profileRefreshError = profileError);
  }
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({required this.user});

  final AuthUser user;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Row(
          children: <Widget>[
            const CircleAvatar(
              radius: 34,
              backgroundColor: AppColors.surfaceElevated,
              child: Icon(
                Icons.person_rounded,
                color: AppColors.primaryBright,
                size: 38,
              ),
            ),
            const SizedBox(width: 17),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    user.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.title,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _displayEmail(user.email),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BowlingInfoCard extends StatelessWidget {
  const _BowlingInfoCard({required this.handicap, required this.clubs});

  final int? handicap;
  final AsyncValue<List<ClubSummary>> clubs;

  @override
  Widget build(BuildContext context) {
    final String clubCount = clubs.when(
      data: (List<ClubSummary> value) => '${value.length}개',
      loading: () => '불러오는 중',
      error: (Object error, StackTrace stackTrace) => '확인 필요',
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: <Widget>[
            _InfoRow(label: '핸디캡', value: handicap?.toString() ?? '미설정'),
            const Divider(height: 28),
            _InfoRow(label: '가입 동호회 수', value: clubCount),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: <Widget>[
        Text(label, style: const TextStyle(color: AppColors.textSecondary)),
        Flexible(
          child: Text(
            value,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }
}

class _ClubSummarySection extends StatelessWidget {
  const _ClubSummarySection({required this.clubs, required this.onRetry});

  final AsyncValue<List<ClubSummary>> clubs;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return clubs.when(
      loading: () => const Card(
        child: Padding(
          padding: EdgeInsets.all(28),
          child: Center(child: CircularProgressIndicator()),
        ),
      ),
      error: (Object error, StackTrace stackTrace) => Card(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: <Widget>[
              Text(clubErrorMessage(error), textAlign: TextAlign.center),
              const SizedBox(height: 12),
              TextButton.icon(
                key: const Key('profile-clubs-retry'),
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('다시 시도'),
              ),
            ],
          ),
        ),
      ),
      data: (List<ClubSummary> value) {
        if (value.isEmpty) {
          return const Card(
            child: Padding(
              padding: EdgeInsets.all(28),
              child: Center(child: Text('가입한 동호회가 없습니다.')),
            ),
          );
        }
        return Column(
          children: <Widget>[
            for (final ClubSummary club in value) ...<Widget>[
              Card(
                clipBehavior: Clip.antiAlias,
                child: ListTile(
                  key: Key('profile-club-${club.id}'),
                  minTileHeight: 68,
                  leading: const Icon(
                    Icons.groups_rounded,
                    color: AppColors.primaryBright,
                  ),
                  title: Text(
                    club.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  subtitle: Text(
                    '${club.myRole.label} · 회원 ${club.memberCount}명',
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () =>
                      context.push('/club/${Uri.encodeComponent(club.id)}'),
                ),
              ),
              const SizedBox(height: 10),
            ],
          ],
        );
      },
    );
  }
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.error),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Text(message, textAlign: TextAlign.center),
      ),
    );
  }
}

String _displayEmail(String? email) {
  final String normalized = email?.trim() ?? '';
  return normalized.isEmpty ? '이메일 정보 없음' : normalized;
}

String _profileErrorMessage(Object error) {
  if (error is ApiException) return error.userMessage;
  return '내 정보를 새로고침하지 못했습니다. 잠시 후 다시 시도해주세요.';
}
