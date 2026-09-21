import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/capture/application/capture_providers.dart';
import 'package:bowlingmanager_mobile/features/capture/application/capture_state.dart';
import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class CaptureReviewScreen extends ConsumerWidget {
  const CaptureReviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthUser? user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final provider = captureControllerProvider(user.id);
    final AsyncValue<CaptureState> value = ref.watch(provider);
    return value.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => Center(
        child: FilledButton(
          onPressed: () => context.go('/capture'),
          child: const Text('촬영 화면으로 돌아가기'),
        ),
      ),
      data: (CaptureState state) {
        if (state.players.isEmpty) {
          return Center(
            child: FilledButton(
              onPressed: () => context.go('/capture'),
              child: const Text('분석할 이미지를 선택해주세요.'),
            ),
          );
        }
        return _ReviewContent(
          state: state,
          controller: ref.read(provider.notifier),
        );
      },
    );
  }
}

class _ReviewContent extends StatelessWidget {
  const _ReviewContent({required this.state, required this.controller});

  final CaptureState state;
  final CaptureController controller;

  @override
  Widget build(BuildContext context) {
    final CaptureTeam team = state.options.teams.firstWhere(
      (CaptureTeam value) => value.id == state.selectedTeamId,
    );
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 36),
      children: <Widget>[
        Row(
          children: <Widget>[
            IconButton(
              onPressed: state.isSaving ? null : () => context.pop(),
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            const SizedBox(width: 4),
            const Text('인식 결과 확인', style: AppTextStyles.headline),
          ],
        ),
        const SizedBox(height: 8),
        const Text(
          '이름과 점수를 확인한 뒤 저장하세요.',
          style: TextStyle(color: AppColors.textSecondary),
        ),
        const SizedBox(height: 22),
        _MetadataCard(state: state, team: team, controller: controller),
        const SizedBox(height: 20),
        for (int index = 0; index < state.players.length; index++) ...<Widget>[
          _PlayerCard(
            key: ValueKey<String>('player-$index-${state.players[index].name}'),
            index: index,
            player: state.players[index],
            enabled: !state.isSaving,
            controller: controller,
          ),
          const SizedBox(height: 14),
        ],
        if (state.errorMessage != null) ...<Widget>[
          Text(
            state.errorMessage!,
            key: const Key('review-error'),
            style: const TextStyle(color: Colors.redAccent),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
        ],
        FilledButton.icon(
          key: const Key('review-save'),
          onPressed: state.isSaving
              ? null
              : () async {
                  final BulkSaveResult? result = await controller.save();
                  if (result != null && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('${result.createdCount}개 점수를 저장했습니다.'),
                      ),
                    );
                    context.go('/records');
                  }
                },
          icon: state.isSaving
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.save_outlined),
          label: const Text('점수 저장'),
        ),
      ],
    );
  }
}

class _MetadataCard extends StatelessWidget {
  const _MetadataCard({
    required this.state,
    required this.team,
    required this.controller,
  });

  final CaptureState state;
  final CaptureTeam team;
  final CaptureController controller;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text('팀: ${team.name}', style: AppTextStyles.title),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              key: const Key('review-date'),
              onPressed: state.isSaving
                  ? null
                  : () async {
                      final DateTime? date = await showDatePicker(
                        context: context,
                        initialDate: state.gameDate,
                        firstDate: DateTime(2000),
                        lastDate: DateTime.now().add(const Duration(days: 1)),
                      );
                      if (date != null) controller.setGameDate(date);
                    },
              icon: const Icon(Icons.calendar_today_outlined),
              label: Text(_displayDate(state.gameDate)),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              key: ValueKey<String>('review-game-type-${state.gameType}'),
              initialValue: state.gameType,
              decoration: const InputDecoration(labelText: '경기 분류'),
              items: state.options.gameTypes
                  .map(
                    (String value) => DropdownMenuItem<String>(
                      value: value,
                      child: Text(value),
                    ),
                  )
                  .toList(growable: false),
              onChanged: state.isSaving
                  ? null
                  : (String? value) {
                      if (value != null) controller.setGameType(value);
                    },
            ),
            const SizedBox(height: 12),
            TextFormField(
              key: const Key('review-memo'),
              initialValue: state.memo,
              enabled: !state.isSaving,
              maxLength: 500,
              maxLines: 2,
              decoration: const InputDecoration(labelText: '메모 (선택)'),
              onChanged: controller.setMemo,
            ),
          ],
        ),
      ),
    );
  }
}

class _PlayerCard extends StatelessWidget {
  const _PlayerCard({
    required this.index,
    required this.player,
    required this.enabled,
    required this.controller,
    super.key,
  });

  final int index;
  final CapturePlayerDraft player;
  final bool enabled;
  final CaptureController controller;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: TextFormField(
                    key: ValueKey<String>('player-name-$index'),
                    initialValue: player.name,
                    enabled: enabled,
                    decoration: const InputDecoration(labelText: '선수 이름'),
                    onChanged: (String value) =>
                        controller.updatePlayerName(index, value),
                  ),
                ),
                IconButton(
                  key: ValueKey<String>('remove-player-$index'),
                  onPressed: enabled
                      ? () => controller.removePlayer(index)
                      : null,
                  tooltip: '선수 삭제',
                  icon: const Icon(Icons.delete_outline_rounded),
                ),
              ],
            ),
            if (player.memberId != null) ...<Widget>[
              const SizedBox(height: 8),
              const Align(
                alignment: Alignment.centerLeft,
                child: Chip(label: Text('팀원 일치')),
              ),
            ],
            const SizedBox(height: 12),
            for (
              int scoreIndex = 0;
              scoreIndex < player.scoreTexts.length;
              scoreIndex++
            )
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: TextFormField(
                        key: ValueKey<String>('score-$index-$scoreIndex'),
                        initialValue: player.scoreTexts[scoreIndex],
                        enabled: enabled,
                        keyboardType: TextInputType.number,
                        inputFormatters: <TextInputFormatter>[
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        decoration: InputDecoration(
                          labelText: '${scoreIndex + 1}게임 점수',
                          errorText:
                              _invalidScore(player.scoreTexts[scoreIndex])
                              ? '0~300 정수를 입력하세요.'
                              : null,
                        ),
                        onChanged: (String value) =>
                            controller.updateScore(index, scoreIndex, value),
                      ),
                    ),
                    IconButton(
                      onPressed: enabled && player.scoreTexts.length > 1
                          ? () => controller.removeScore(index, scoreIndex)
                          : null,
                      tooltip: '점수 삭제',
                      icon: const Icon(Icons.remove_circle_outline),
                    ),
                  ],
                ),
              ),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: enabled && player.scoreTexts.length < 12
                    ? () => controller.addScore(index)
                    : null,
                icon: const Icon(Icons.add_rounded),
                label: const Text('게임 추가'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

bool _invalidScore(String value) {
  final int? score = int.tryParse(value.trim());
  return score == null || score < 0 || score > 300;
}

String _displayDate(DateTime value) {
  String twoDigits(int number) => number.toString().padLeft(2, '0');
  return '${value.year}.${twoDigits(value.month)}.${twoDigits(value.day)}';
}
