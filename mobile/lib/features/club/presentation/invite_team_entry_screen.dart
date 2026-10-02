import 'package:bowlingmanager_mobile/core/storage/onboarding_storage.dart';
import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/onboarding/application/onboarding_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class InviteTeamEntryScreen extends ConsumerStatefulWidget {
  const InviteTeamEntryScreen({required this.rawCode, super.key});

  final String rawCode;

  @override
  ConsumerState<InviteTeamEntryScreen> createState() =>
      _InviteTeamEntryScreenState();
}

class _InviteTeamEntryScreenState extends ConsumerState<InviteTeamEntryScreen> {
  bool _captureStarted = false;
  bool _captured = false;
  bool _navigating = false;
  String? _code;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _capture());
  }

  Future<void> _capture() async {
    if (_captureStarted) return;
    _captureStarted = true;
    final String? code = normalizePendingInviteCode(widget.rawCode);
    if (code == null) {
      if (!mounted) return;
      setState(() {
        _errorMessage = '유효하지 않은 초대 링크입니다.';
        _captureStarted = false;
      });
      return;
    }

    final bool saved = await ref
        .read(onboardingControllerProvider.notifier)
        .savePendingInviteCode(code);
    if (!mounted) return;
    setState(() {
      _code = saved ? code : null;
      _captured = saved;
      _errorMessage = saved ? null : '초대 링크를 저장하지 못했습니다. 다시 시도해주세요.';
      _captureStarted = false;
    });
  }

  void _continueWhenReady() {
    if (!_captured || _navigating || _code == null) return;
    final authState = ref.read(authControllerProvider);
    final onboardingState = ref.read(onboardingControllerProvider);
    if (authState.isBootstrapping ||
        authState.isLoading ||
        !onboardingState.isInitialized) {
      return;
    }
    _navigating = true;
    final String destination = authState.isAuthenticated
        ? '/club/join?code=${_code!}'
        : onboardingState.completed
        ? '/login'
        : '/welcome';
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.go(destination);
    });
  }

  void _openFallback() {
    final authState = ref.read(authControllerProvider);
    final onboardingState = ref.read(onboardingControllerProvider);
    if (authState.isBootstrapping ||
        authState.isLoading ||
        !onboardingState.isInitialized) {
      return;
    }
    context.go(
      authState.isAuthenticated
          ? '/club/join'
          : onboardingState.completed
          ? '/login'
          : '/welcome',
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(authControllerProvider);
    ref.watch(onboardingControllerProvider);
    _continueWhenReady();

    return Scaffold(
      key: const Key('invite-team-entry-screen'),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: _errorMessage == null
                ? const Column(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      CircularProgressIndicator(),
                      SizedBox(height: 18),
                      Text('초대 링크를 확인하고 있어요.'),
                    ],
                  )
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      const Icon(
                        Icons.link_off_rounded,
                        color: AppColors.error,
                        size: 48,
                      ),
                      const SizedBox(height: 18),
                      Text(
                        _errorMessage!,
                        key: const Key('invite-team-entry-error'),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 20),
                      if (normalizePendingInviteCode(widget.rawCode) != null)
                        FilledButton(
                          onPressed: _captureStarted ? null : _capture,
                          child: const Text('다시 시도'),
                        )
                      else
                        FilledButton(
                          onPressed: _openFallback,
                          child: const Text('직접 코드 입력하기'),
                        ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
