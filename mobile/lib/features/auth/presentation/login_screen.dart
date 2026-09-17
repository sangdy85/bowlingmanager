import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _obscurePassword = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  const Icon(
                    Icons.sports_score_rounded,
                    color: AppColors.primaryBright,
                    size: 52,
                  ),
                  const SizedBox(height: 22),
                  Text(
                    '다시 만나 반가워요',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'BowlingManager 계정으로 로그인하세요',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 36),
                  const TextField(
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: <String>[AutofillHints.email],
                    decoration: InputDecoration(
                      labelText: '이메일',
                      prefixIcon: Icon(Icons.mail_outline_rounded),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    obscureText: _obscurePassword,
                    autofillHints: const <String>[AutofillHints.password],
                    decoration: InputDecoration(
                      labelText: '비밀번호',
                      prefixIcon: const Icon(Icons.lock_outline_rounded),
                      suffixIcon: IconButton(
                        tooltip: _obscurePassword ? '비밀번호 표시' : '비밀번호 숨기기',
                        onPressed: () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 22),
                  FilledButton(
                    // Phase 4 will replace this debug-only preview navigation
                    // with the mobile login API and secure token persistence.
                    onPressed: kDebugMode ? () => context.go('/home') : null,
                    child: const Text('로그인'),
                  ),
                  if (kDebugMode) ...<Widget>[
                    const SizedBox(height: 10),
                    const Text(
                      '개발 미리보기: 로그인 버튼은 홈 화면으로만 이동합니다.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.warning, fontSize: 12),
                    ),
                  ],
                  const SizedBox(height: 18),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: <Widget>[
                      TextButton(onPressed: null, child: const Text('회원가입')),
                      const Text(
                        '·',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                      TextButton(onPressed: null, child: const Text('비밀번호 찾기')),
                    ],
                  ),
                  const SizedBox(height: 22),
                  const Row(
                    children: <Widget>[
                      Expanded(child: Divider()),
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 14),
                        child: Text(
                          '간편 로그인 준비 중',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ),
                      Expanded(child: Divider()),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: <Widget>[
                      _OAuthPlaceholder(label: 'G', semanticLabel: 'Google'),
                      SizedBox(width: 14),
                      _OAuthPlaceholder(label: 'N', semanticLabel: 'Naver'),
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

class _OAuthPlaceholder extends StatelessWidget {
  const _OAuthPlaceholder({required this.label, required this.semanticLabel});

  final String label;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$semanticLabel 로그인 준비 중',
      child: Container(
        width: 48,
        height: 48,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.divider),
        ),
        child: Text(
          label,
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 18,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}
