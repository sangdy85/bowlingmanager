import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ClubSeasonPointsScreen extends ConsumerWidget {
  const ClubSeasonPointsScreen({required this.teamId, super.key});

  final String teamId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final profileRequest = (userId: user.id, teamId: teamId);
    final profileValue = ref.watch(clubTeamProfileProvider(profileRequest));
    return Scaffold(
      appBar: AppBar(title: const Text('시즌 포인트 관리')),
      body: profileValue.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: ClubErrorCard(
            message: clubErrorMessage(error),
            onRetry: () async {
              ref.invalidate(clubTeamProfileProvider(profileRequest));
            },
          ),
        ),
        data: (profile) => _body(context, ref, user.id, profile),
      ),
    );
  }

  Widget _body(
    BuildContext context,
    WidgetRef ref,
    String userId,
    ClubTeamProfile profile,
  ) {
    final canManage =
        profile.myRole == ClubRole.owner || profile.myRole == ClubRole.manager;
    if (!profile.bowlerHiddenEnabled || !canManage) {
      return const Center(child: Text('시즌 포인트를 관리할 권한이 없습니다.'));
    }
    final season = profile.activeSeason;
    if (season == null) {
      return const Center(child: Text('활성 시즌이 없습니다.'));
    }
    final request = (
      userId: userId,
      teamId: teamId,
      seasonId: season.id as String?,
      year: null as int?,
      competitionType: 'ALL',
    );
    final ranking = ref.watch(clubSeasonRankingProvider(request));
    return ranking.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: ClubErrorCard(
          message: clubErrorMessage(error),
          onRetry: () async {
            ref.invalidate(clubSeasonRankingProvider(request));
          },
        ),
      ),
      data: (value) => RefreshIndicator(
        onRefresh: () => ref.refresh(clubSeasonRankingProvider(request).future),
        child: ListView(
          key: const Key('season-point-management'),
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: <Widget>[
            Text(season.name, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            const Text('현재 총점을 덮어쓰지 않고 증감 내역을 원장에 추가합니다.'),
            const SizedBox(height: 16),
            for (final member in value.rows)
              Card(
                child: ListTile(
                  title: Text(member.name),
                  subtitle: Text(
                    '자동 ${member.points - member.adjustmentPoints}P · 조정 ${_signed(member.adjustmentPoints)}P',
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Text(
                        '${member.points}P',
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(width: 8),
                      const Icon(Icons.chevron_right),
                    ],
                  ),
                  onTap: () =>
                      _adjust(context, ref, request, season.id, member),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _adjust(
    BuildContext context,
    WidgetRef ref,
    ClubSeasonRankingRequest request,
    String seasonId,
    ClubSeasonRankingRow member,
  ) async {
    final input = await showDialog<_AdjustmentInput>(
      context: context,
      builder: (_) => _AdjustmentDialog(member: member),
    );
    if (input == null || !context.mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('포인트 조정 확인'),
        content: Text(
          '${member.name}에게\n${_signed(input.delta)}P를 적용합니다.\n\n사유:\n${input.reason}',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('취소'),
          ),
          FilledButton(
            key: const Key('confirm-season-adjustment'),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('적용'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    try {
      await ref
          .read(clubExpansionApiProvider)
          .createSeasonPointAdjustment(
            teamId,
            seasonId,
            memberId: member.id,
            delta: input.delta,
            reason: input.reason,
          );
      ref.invalidate(clubSeasonRankingProvider(request));
      ref.invalidate(clubSeasonMemberProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('시즌 포인트 조정을 적용했습니다.')));
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
      }
    }
  }
}

class _AdjustmentInput {
  const _AdjustmentInput(this.delta, this.reason);
  final int delta;
  final String reason;
}

class _AdjustmentDialog extends StatefulWidget {
  const _AdjustmentDialog({required this.member});
  final ClubSeasonRankingRow member;

  @override
  State<_AdjustmentDialog> createState() => _AdjustmentDialogState();
}

class _AdjustmentDialogState extends State<_AdjustmentDialog> {
  final _formKey = GlobalKey<FormState>();
  final _delta = TextEditingController();
  final _reason = TextEditingController();

  @override
  void dispose() {
    _delta.dispose();
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text('${widget.member.name} 포인트 조정'),
    content: Form(
      key: _formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          TextFormField(
            key: const Key('season-adjustment-delta'),
            controller: _delta,
            keyboardType: const TextInputType.numberWithOptions(signed: true),
            inputFormatters: <TextInputFormatter>[
              FilteringTextInputFormatter.allow(RegExp(r'^[-+]?\d*$')),
            ],
            decoration: const InputDecoration(
              labelText: '증감 포인트',
              hintText: '+20 또는 -10',
            ),
            validator: (value) {
              final parsed = int.tryParse((value ?? '').replaceFirst('+', ''));
              return parsed == null || parsed == 0 || parsed.abs() > 100000
                  ? '0이 아닌 증감 포인트를 입력해주세요.'
                  : null;
            },
          ),
          TextFormField(
            key: const Key('season-adjustment-reason'),
            controller: _reason,
            maxLength: 500,
            decoration: const InputDecoration(labelText: '사유'),
            validator: (value) =>
                (value ?? '').trim().isEmpty ? '조정 사유를 입력해주세요.' : null,
          ),
        ],
      ),
    ),
    actions: <Widget>[
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('취소'),
      ),
      FilledButton(
        key: const Key('review-season-adjustment'),
        onPressed: () {
          if (!_formKey.currentState!.validate()) return;
          Navigator.pop(
            context,
            _AdjustmentInput(
              int.parse(_delta.text.replaceFirst('+', '')),
              _reason.text.trim(),
            ),
          );
        },
        child: const Text('조정 적용'),
      ),
    ],
  );
}

String _signed(int value) => value > 0 ? '+$value' : '$value';
