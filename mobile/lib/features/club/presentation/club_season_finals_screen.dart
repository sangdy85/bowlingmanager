import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_season_final_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubSeasonFinalsScreen extends ConsumerWidget {
  const ClubSeasonFinalsScreen({required this.teamId, super.key});
  final String teamId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) return const Scaffold(body: SizedBox.shrink());
    final request = (userId: user.id, teamId: teamId);
    final value = ref.watch(clubSeasonFinalsProvider(request));
    return Scaffold(
      appBar: AppBar(title: const Text('시즌 최종전')),
      floatingActionButton: value.value?.canManage == true
          ? FloatingActionButton.extended(
              onPressed: () => _create(context, ref, user.id, request),
              icon: const Icon(Icons.add),
              label: const Text('최종전 만들기'),
            )
          : null,
      body: value.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _Failure(
          message: _message(error),
          onRetry: () => ref.invalidate(clubSeasonFinalsProvider(request)),
        ),
        data: (data) => RefreshIndicator(
          onRefresh: () =>
              ref.refresh(clubSeasonFinalsProvider(request).future),
          child: data.items.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: const <Widget>[
                    SizedBox(height: 180),
                    Center(child: Text('생성된 시즌 최종전이 없습니다.')),
                  ],
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                  itemCount: data.items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (_, index) {
                    final item = data.items[index];
                    return Card(
                      child: ListTile(
                        title: Text(item.name),
                        subtitle: Text(
                          '${_status(item.status)} · ${item.competitionMode == 'MINI' ? 'MINI · 공식 시즌 순위 미반영' : '본경기'}',
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.push(
                          '/club/${Uri.encodeComponent(teamId)}/records/season-finals/${Uri.encodeComponent(item.id)}',
                        ),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }

  Future<void> _create(
    BuildContext context,
    WidgetRef ref,
    String userId,
    ClubExpansionRequest finalsRequest,
  ) async {
    final rankingRequest = (
      userId: userId,
      teamId: teamId,
      seasonId: null as String?,
      competitionType: 'ALL',
    );
    final ranking = await ref.read(
      clubSeasonRankingProvider(rankingRequest).future,
    );
    if (!context.mounted) return;
    String? seasonId =
        ranking.season?.id ??
        (ranking.seasons.isEmpty ? null : ranking.seasons.first.id);
    final controller = TextEditingController(
      text: ranking.season == null ? '시즌 최종전' : '${ranking.season!.name} 최종전',
    );
    String competitionMode = 'OFFICIAL';
    final created = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('시즌 최종전 만들기'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              DropdownButtonFormField<String>(
                initialValue: seasonId,
                decoration: const InputDecoration(labelText: '시즌'),
                items: ranking.seasons
                    .map(
                      (item) => DropdownMenuItem(
                        value: item.id,
                        child: Text(item.name),
                      ),
                    )
                    .toList(),
                onChanged: (value) => setState(() => seasonId = value),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                decoration: const InputDecoration(labelText: '최종전 이름'),
              ),
              const SizedBox(height: 12),
              SegmentedButton<String>(
                segments: const <ButtonSegment<String>>[
                  ButtonSegment(value: 'OFFICIAL', label: Text('본경기')),
                  ButtonSegment(value: 'MINI', label: Text('MINI')),
                ],
                selected: <String>{competitionMode},
                onSelectionChanged: (value) =>
                    setState(() => competitionMode = value.single),
              ),
            ],
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('취소'),
            ),
            FilledButton(
              onPressed: seasonId == null
                  ? null
                  : () async {
                      try {
                        await ref
                            .read(clubExpansionApiProvider)
                            .createSeasonFinal(
                              teamId,
                              seasonId!,
                              controller.text,
                              competitionMode,
                            );
                        if (dialogContext.mounted) {
                          Navigator.pop(dialogContext, true);
                        }
                      } on Object catch (error) {
                        if (dialogContext.mounted) {
                          ScaffoldMessenger.of(dialogContext).showSnackBar(
                            SnackBar(content: Text(_message(error))),
                          );
                        }
                      }
                    },
              child: const Text('생성'),
            ),
          ],
        ),
      ),
    );
    controller.dispose();
    if (created == true) {
      ref.invalidate(clubSeasonFinalsProvider(finalsRequest));
    }
  }
}

class ClubSeasonFinalDetailScreen extends ConsumerWidget {
  const ClubSeasonFinalDetailScreen({
    required this.teamId,
    required this.finalId,
    super.key,
  });
  final String teamId;
  final String finalId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) return const Scaffold(body: SizedBox.shrink());
    final request = (userId: user.id, teamId: teamId, finalId: finalId);
    final value = ref.watch(clubSeasonFinalProvider(request));
    return Scaffold(
      appBar: AppBar(title: const Text('최종전 진행 상황')),
      body: value.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _Failure(
          message: _message(error),
          onRetry: () => ref.invalidate(clubSeasonFinalProvider(request)),
        ),
        data: (data) => RefreshIndicator(
          onRefresh: () => ref.refresh(clubSeasonFinalProvider(request).future),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: <Widget>[
              Text(data.name, style: Theme.of(context).textTheme.headlineSmall),
              Text('${data.seasonName} · ${_status(data.status)}'),
              if (data.competitionMode == 'MINI')
                const Padding(
                  padding: EdgeInsets.only(top: 6),
                  child: Text(
                    '미니 최종전 · 공식 Champion/Season placement 미반영',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              const SizedBox(height: 16),
              if (data.participants.isNotEmpty)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        const Text(
                          'Seed snapshot',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 8),
                        for (final item in data.participants)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 3),
                            child: Row(
                              children: <Widget>[
                                SizedBox(
                                  width: 42,
                                  child: Text('#${item.seed}'),
                                ),
                                Expanded(child: Text(item.name)),
                                Text(
                                  item.placement == null
                                      ? '${item.points}P'
                                      : '${item.placement}위',
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: 8),
              for (final node in data.nodes) _NodeCard(node: node),
              if (data.nodes.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 80),
                  child: Center(child: Text('관리자가 대진 구조를 준비 중입니다.')),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NodeCard extends StatelessWidget {
  const _NodeCard({required this.node});
  final ClubSeasonFinalNode node;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  node.name,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Chip(label: Text(_status(node.status))),
            ],
          ),
          Text('${_type(node.type)} · ${node.gameCount}게임'),
          const SizedBox(height: 8),
          if (node.results.isNotEmpty)
            for (final result in node.results)
              Builder(
                builder: (_) {
                  final participant = node.entries
                      .where((item) => item.id == result.participantId)
                      .firstOrNull;
                  return ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(child: Text('${result.rank}')),
                    title: Text(participant?.name ?? '참가자'),
                    trailing: Text(
                      '${result.totalPins} / ${result.average.toStringAsFixed(1)}',
                    ),
                  );
                },
              )
          else if (node.entries.isEmpty)
            const Text('진출 참가자 대기 중')
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: node.entries
                  .map(
                    (item) => Chip(label: Text('${item.seed}. ${item.name}')),
                  )
                  .toList(),
            ),
        ],
      ),
    ),
  );
}

class _Failure extends StatelessWidget {
  const _Failure({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text(message),
        const SizedBox(height: 12),
        FilledButton(onPressed: onRetry, child: const Text('다시 시도')),
      ],
    ),
  );
}

String _message(Object error) =>
    error is ApiException ? error.userMessage : '시즌 최종전을 불러오지 못했습니다.';
String _status(String value) => switch (value) {
  'DRAFT' => '준비',
  'LOCKED' => '확정',
  'READY' => '경기 대기',
  'IN_PROGRESS' => '진행 중',
  'COMPLETED' => '완료',
  _ => value,
};
String _type(String value) => switch (value) {
  'WILDCARD' => '와일드카드',
  'ROUND' => '라운드',
  'FINAL' => '결승',
  'LOSER_REVIVAL' => '패자부활전',
  'PLACEMENT' => '순위결정전',
  'SPECIAL' => '특별전',
  _ => value,
};
