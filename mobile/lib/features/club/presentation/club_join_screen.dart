import 'package:bowlingmanager_mobile/core/storage/onboarding_storage.dart';
import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/features/onboarding/application/onboarding_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubJoinScreen extends ConsumerStatefulWidget {
  const ClubJoinScreen({super.key});

  @override
  ConsumerState<ClubJoinScreen> createState() => _ClubJoinScreenState();
}

class _ClubJoinScreenState extends ConsumerState<ClubJoinScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _codeController = TextEditingController();
  bool _isJoining = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final state = ref.read(onboardingControllerProvider);
      if (state.intent == OnboardingIntent.joinClub) {
        ref.read(onboardingControllerProvider.notifier).consumeIntent();
      }
    });
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _join() async {
    if (_isJoining || _formKey.currentState?.validate() != true) return;
    setState(() {
      _isJoining = true;
      _errorMessage = null;
    });
    try {
      final ClubJoinResult result = await ref
          .read(clubRepositoryProvider)
          .joinClub(_codeController.text);
      final userId = ref.read(authControllerProvider).user?.id;
      if (userId != null) {
        ref.invalidate(clubListProvider(userId));
        ref.invalidate(dashboardProvider(userId));
      }
      if (!mounted) return;
      context.go('/club/${Uri.encodeComponent(result.team.id)}');
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = clubErrorMessage(error));
    } finally {
      if (mounted) setState(() => _isJoining = false);
    }
  }

  @override
  Widget build(BuildContext context) => ListView(
    key: const Key('club-join-screen'),
    padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
    children: <Widget>[
      Text('동호회 가입', style: AppTextStyles.headline),
      const SizedBox(height: 8),
      const Text(
        '전달받은 초대 코드 6자리를 입력하세요.',
        style: TextStyle(color: AppColors.textSecondary),
      ),
      const SizedBox(height: 28),
      Form(
        key: _formKey,
        child: TextFormField(
          key: const Key('club-code-field'),
          controller: _codeController,
          enabled: !_isJoining,
          textCapitalization: TextCapitalization.characters,
          inputFormatters: <TextInputFormatter>[
            FilteringTextInputFormatter.allow(RegExp('[A-Za-z0-9]')),
            LengthLimitingTextInputFormatter(6),
            _UpperCaseTextFormatter(),
          ],
          decoration: const InputDecoration(
            labelText: '초대 코드',
            hintText: 'A1B2C3',
          ),
          validator: (String? value) =>
              RegExp(r'^[A-Z0-9]{6}$')
                  .hasMatch(value?.trim().toUpperCase() ?? '')
              ? null
              : '영문과 숫자 6자리 코드를 입력해주세요.',
          onFieldSubmitted: (_) => _join(),
        ),
      ),
      if (_errorMessage != null) ...<Widget>[
        const SizedBox(height: 14),
        Text(
          _errorMessage!,
          key: const Key('club-join-error'),
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.error),
        ),
      ],
      const SizedBox(height: 20),
      FilledButton(
        key: const Key('club-join-submit'),
        onPressed: _isJoining ? null : _join,
        child: _isJoining
            ? const SizedBox.square(
                dimension: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Text('가입하기'),
      ),
    ],
  );
}

class _UpperCaseTextFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) => newValue.copyWith(text: newValue.text.toUpperCase());
}
