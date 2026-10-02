import 'package:bowlingmanager_mobile/core/storage/onboarding_storage.dart';
import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/onboarding/application/onboarding_providers.dart';
import 'package:bowlingmanager_mobile/features/onboarding/application/onboarding_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class WelcomeScreen extends ConsumerStatefulWidget {
  const WelcomeScreen({super.key});

  @override
  ConsumerState<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends ConsumerState<WelcomeScreen> {
  OnboardingIntent? _selectedIntent;

  Future<void> _start() async {
    final OnboardingIntent? intent = _selectedIntent;
    if (intent == null) return;
    await ref
        .read(onboardingControllerProvider.notifier)
        .complete(intent: intent);
  }

  Future<void> _login() async {
    await ref.read(onboardingControllerProvider.notifier).complete();
  }

  @override
  Widget build(BuildContext context) {
    final OnboardingState onboarding = ref.watch(onboardingControllerProvider);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  const Icon(
                    Icons.sports_score_rounded,
                    color: AppColors.primaryBright,
                    size: 48,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'BowlingManager',
                    textAlign: TextAlign.center,
                    style: AppTextStyles.headline,
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    '내 기록부터 우리 동호회까지,\n볼링을 더 편하게 관리하세요.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 15,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 28),
                  _IntentCard(
                    title: '개인 기록',
                    description: '점수와 에버리지 변화를 기록하고 확인해요.',
                    icon: Icons.insights_rounded,
                    selected: _selectedIntent == OnboardingIntent.personal,
                    onTap: onboarding.isSaving
                        ? null
                        : () => setState(
                            () => _selectedIntent = OnboardingIntent.personal,
                          ),
                  ),
                  const SizedBox(height: 12),
                  _IntentCard(
                    title: '동호회 가입',
                    description: '정모 일정, 점수와 시즌 순위를 함께 확인해요.',
                    icon: Icons.groups_rounded,
                    selected: _selectedIntent == OnboardingIntent.joinClub,
                    onTap: onboarding.isSaving
                        ? null
                        : () => setState(
                            () => _selectedIntent = OnboardingIntent.joinClub,
                          ),
                  ),
                  const SizedBox(height: 12),
                  _IntentCard(
                    title: '동호회 운영',
                    description: '회원, 일정, 참석, 점수와 순위를 관리해요.',
                    icon: Icons.admin_panel_settings_rounded,
                    selected: _selectedIntent == OnboardingIntent.manageClub,
                    onTap: onboarding.isSaving
                        ? null
                        : () => setState(
                            () => _selectedIntent = OnboardingIntent.manageClub,
                          ),
                  ),
                  if (onboarding.errorMessage != null) ...<Widget>[
                    const SizedBox(height: 12),
                    Text(
                      onboarding.errorMessage!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.error),
                    ),
                  ],
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: onboarding.isSaving || _selectedIntent == null
                        ? null
                        : _start,
                    child: onboarding.isSaving
                        ? const SizedBox.square(
                            dimension: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('시작하기'),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: <Widget>[
                      const Text(
                        '이미 계정이 있나요?',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                      TextButton(
                        onPressed: onboarding.isSaving ? null : _login,
                        child: const Text('로그인'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _IntentCard extends StatelessWidget {
  const _IntentCard({
    required this.title,
    required this.description,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String description;
  final IconData icon;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      child: Material(
        color: selected ? AppColors.surfaceElevated : AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: selected ? AppColors.primaryBright : AppColors.divider,
                width: selected ? 2 : 1,
              ),
            ),
            child: Row(
              children: <Widget>[
                Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: selected
                        ? AppColors.primary.withValues(alpha: 0.22)
                        : AppColors.background,
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Icon(icon, color: AppColors.primaryBright),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(title, style: AppTextStyles.title),
                      const SizedBox(height: 4),
                      Text(
                        description,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Icon(
                  selected
                      ? Icons.check_circle_rounded
                      : Icons.radio_button_unchecked_rounded,
                  color: selected
                      ? AppColors.primaryBright
                      : AppColors.textSecondary,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
