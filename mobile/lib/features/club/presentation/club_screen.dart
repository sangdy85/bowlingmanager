import 'package:bowlingmanager_mobile/core/config/app_web_urls.dart';
import 'package:bowlingmanager_mobile/core/storage/onboarding_storage.dart';
import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/onboarding/application/onboarding_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

typedef ClubWebLauncher = Future<bool> Function(Uri uri);

Future<bool> launchClubWebPage(Uri uri) =>
    launchUrl(uri, mode: LaunchMode.externalApplication);

class ClubScreen extends ConsumerWidget {
  const ClubScreen({this.webLauncher = launchClubWebPage, super.key});

  final ClubWebLauncher webLauncher;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthUser? user = ref.watch(authControllerProvider).user;
    if (user == null) return const _ClubLoading();

    final provider = clubListProvider(user.id);
    final AsyncValue<List<ClubSummary>> clubs = ref.watch(provider);
    final bool showManageActivation =
        ref.watch(onboardingControllerProvider).intent ==
        OnboardingIntent.manageClub;
    Future<void> refresh() => ref.refresh(provider.future);

    Future<void> consumeManageIntent() async {
      if (ref.read(onboardingControllerProvider).intent !=
          OnboardingIntent.manageClub) {
        return;
      }
      await ref.read(onboardingControllerProvider.notifier).consumeIntent();
    }

    Future<void> openClub(ClubSummary club) async {
      await consumeManageIntent();
      if (context.mounted) {
        context.push('/club/${Uri.encodeComponent(club.id)}');
      }
    }

    Future<void> joinClub() async {
      await consumeManageIntent();
      if (context.mounted) context.push('/club/join');
    }

    Future<void> createClub() async {
      await consumeManageIntent();
      try {
        final bool opened = await webLauncher(AppWebUrls.teamCreation);
        if (!opened && context.mounted) _showWebUrlError(context);
      } on Object {
        if (context.mounted) _showWebUrlError(context);
      }
    }

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
            if (showManageActivation) ...<Widget>[
              _ManageClubActivationCard(onLater: consumeManageIntent),
              const SizedBox(height: 16),
            ],
            if (data.isEmpty)
              _EmptyClubs(onJoin: joinClub, onCreate: createClub)
            else
              for (final ClubSummary club in data) ...<Widget>[
                _ClubCard(club: club, onTap: () => openClub(club)),
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

class _ManageClubActivationCard extends StatelessWidget {
  const _ManageClubActivationCard({required this.onLater});

  final Future<void> Function() onLater;

  @override
  Widget build(BuildContext context) {
    return Card(
      key: const Key('manage-club-activation-card'),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Icon(
              Icons.admin_panel_settings_rounded,
              color: AppColors.primaryBright,
              size: 30,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  const Text('운영할 동호회를 선택하세요', style: AppTextStyles.title),
                  const SizedBox(height: 6),
                  const Text(
                    '회원, 일정, 점수와 순위를 관리할 수 있습니다.',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    key: const Key('manage-club-activation-later'),
                    onPressed: onLater,
                    child: const Text('나중에'),
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

class _ClubCard extends StatelessWidget {
  const _ClubCard({required this.club, required this.onTap});

  final ClubSummary club;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      key: Key('club-${club.id}'),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
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
  const _EmptyClubs({required this.onJoin, required this.onCreate});

  final Future<void> Function() onJoin;
  final Future<void> Function() onCreate;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
        child: Column(
          children: <Widget>[
            const Icon(
              Icons.group_off_outlined,
              color: AppColors.textSecondary,
              size: 42,
            ),
            const SizedBox(height: 14),
            const Text(
              '가입한 동호회가 없습니다.',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              '초대 코드로 가입하거나 웹에서 새 동호회를 만들 수 있습니다.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary, height: 1.45),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                key: const Key('empty-club-join'),
                onPressed: onJoin,
                icon: const Icon(Icons.group_add_outlined),
                label: const Text('초대 코드로 가입'),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                key: const Key('empty-club-create'),
                onPressed: onCreate,
                icon: const Icon(Icons.open_in_new_rounded),
                label: const Text('새 동호회 만들기'),
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              '새 동호회 만들기는 웹에서 진행됩니다.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

void _showWebUrlError(BuildContext context) {
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content: Text('웹 페이지를 열지 못했습니다. 잠시 후 다시 시도해주세요.')),
  );
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
