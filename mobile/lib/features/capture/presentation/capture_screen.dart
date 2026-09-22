import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/capture/application/capture_providers.dart';
import 'package:bowlingmanager_mobile/features/capture/application/capture_state.dart';
import 'package:bowlingmanager_mobile/features/capture/data/capture_image_picker.dart';
import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class CaptureScreen extends ConsumerStatefulWidget {
  const CaptureScreen({this.initialTeamId, super.key});

  final String? initialTeamId;

  @override
  ConsumerState<CaptureScreen> createState() => _CaptureScreenState();
}

class _CaptureScreenState extends ConsumerState<CaptureScreen> {
  bool _appliedInitialTeam = false;

  @override
  Widget build(BuildContext context) {
    final AuthUser? user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final provider = captureControllerProvider(user.id);
    final AsyncValue<CaptureState> value = ref.watch(provider);
    final CaptureState? current = value.value;
    if (!_appliedInitialTeam &&
        widget.initialTeamId != null &&
        current != null &&
        current.options.teams.any((team) => team.id == widget.initialTeamId)) {
      _appliedInitialTeam = true;
      if (current.selectedTeamId != widget.initialTeamId) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            ref.read(provider.notifier).selectTeam(widget.initialTeamId!);
          }
        });
      }
    }
    return value.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (Object error, StackTrace stackTrace) => _LoadError(
        message: error is ApiException
            ? error.userMessage
            : '촬영 정보를 불러오지 못했습니다.',
        onRetry: () => ref.invalidate(provider),
      ),
      data: (CaptureState state) => _CaptureContent(
        state: state,
        controller: ref.read(provider.notifier),
      ),
    );
  }
}

class _CaptureContent extends StatelessWidget {
  const _CaptureContent({required this.state, required this.controller});

  final CaptureState state;
  final CaptureController controller;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
      children: <Widget>[
        const Text('점수판 촬영', style: AppTextStyles.headline),
        const SizedBox(height: 6),
        const Text(
          '점수판을 촬영하거나 사진을 선택해 점수를 인식하세요.',
          style: TextStyle(color: AppColors.textSecondary),
        ),
        const SizedBox(height: 24),
        if (state.options.teams.isEmpty)
          const _NoTeamCard()
        else ...<Widget>[
          DropdownButtonFormField<String>(
            key: const Key('capture-team'),
            initialValue: state.selectedTeamId,
            decoration: const InputDecoration(labelText: '팀'),
            items: state.options.teams
                .map(
                  (CaptureTeam team) => DropdownMenuItem<String>(
                    value: team.id,
                    child: Text(team.name),
                  ),
                )
                .toList(growable: false),
            onChanged: state.isAnalyzing
                ? null
                : (String? value) {
                    if (value != null) controller.selectTeam(value);
                  },
          ),
          const SizedBox(height: 18),
          Container(
            height: 250,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.divider),
            ),
            child: state.image == null
                ? const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Icon(
                          Icons.document_scanner_outlined,
                          size: 64,
                          color: AppColors.primaryBright,
                        ),
                        SizedBox(height: 12),
                        Text(
                          '점수판 이미지가 선택되지 않았습니다.',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  )
                : Image.memory(
                    state.image!.bytes,
                    key: const Key('capture-preview'),
                    fit: BoxFit.contain,
                    errorBuilder:
                        (BuildContext context, Object _, StackTrace? _) {
                          return const Center(child: Text('이미지를 표시할 수 없습니다.'));
                        },
                  ),
          ),
          const SizedBox(height: 18),
          Row(
            children: <Widget>[
              Expanded(
                child: FilledButton.icon(
                  key: const Key('capture-camera'),
                  onPressed: state.isAnalyzing
                      ? null
                      : () => controller.selectImage(CaptureImageSource.camera),
                  icon: const Icon(Icons.camera_alt_outlined),
                  label: const Text('카메라 촬영'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  key: const Key('capture-gallery'),
                  onPressed: state.isAnalyzing
                      ? null
                      : () =>
                            controller.selectImage(CaptureImageSource.gallery),
                  icon: const Icon(Icons.photo_library_outlined),
                  label: const Text('갤러리 선택'),
                ),
              ),
            ],
          ),
          if (state.errorMessage != null) ...<Widget>[
            const SizedBox(height: 14),
            Text(
              state.errorMessage!,
              key: const Key('capture-error'),
              style: const TextStyle(color: Colors.redAccent),
              textAlign: TextAlign.center,
            ),
          ],
          const SizedBox(height: 18),
          FilledButton(
            key: const Key('capture-analyze'),
            onPressed: state.canAnalyze
                ? () async {
                    final bool success = await controller.analyze();
                    if (success && context.mounted) {
                      await context.push('/capture/review');
                    }
                  }
                : null,
            child: state.isAnalyzing
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('점수 분석'),
          ),
        ],
      ],
    );
  }
}

class _NoTeamCard extends StatelessWidget {
  const _NoTeamCard();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          '점수를 등록할 수 있는 팀이 없습니다. 팀장 또는 매니저 권한을 확인해주세요.',
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}

class _LoadError extends StatelessWidget {
  const _LoadError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('다시 시도')),
          ],
        ),
      ),
    );
  }
}
