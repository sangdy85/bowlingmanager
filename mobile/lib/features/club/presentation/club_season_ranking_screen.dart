import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubSeasonRankingScreen extends ConsumerStatefulWidget {
  const ClubSeasonRankingScreen({required this.teamId, super.key});
  final String teamId;

  @override
  ConsumerState<ClubSeasonRankingScreen> createState() =>
      _ClubSeasonRankingScreenState();
}

class _ClubSeasonRankingScreenState
    extends ConsumerState<ClubSeasonRankingScreen> {
  String? _seasonId;
  String _competitionType = 'ALL';

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) return const Scaffold(body: SizedBox.shrink());
    final request = (
      userId: user.id,
      teamId: widget.teamId,
      seasonId: _seasonId,
      competitionType: _competitionType,
    );
    final value = ref.watch(clubSeasonRankingProvider(request));
    return Scaffold(
      appBar: AppBar(
        title: Text(
          value.value?.bowlerHiddenEnabled == false ? '시즌 순위' : '시즌 종합순위',
        ),
        actions: <Widget>[
          if (value.value?.bowlerHiddenEnabled == true)
            IconButton(
              key: const Key('season-finals-link'),
              tooltip: '시즌 최종전',
              onPressed: () => context.push(
                '/club/${Uri.encodeComponent(widget.teamId)}/records/season-finals',
              ),
              icon: const Icon(Icons.emoji_events_outlined),
            ),
        ],
      ),
      body: value.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(_message(error), textAlign: TextAlign.center),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () =>
                      ref.invalidate(clubSeasonRankingProvider(request)),
                  child: const Text('다시 시도'),
                ),
              ],
            ),
          ),
        ),
        data: (ranking) => _body(user.id, request, ranking),
      ),
    );
  }

  Widget _body(
    String userId,
    ClubSeasonRankingRequest request,
    ClubSeasonRanking ranking,
  ) {
    if (!ranking.enabled) {
      return const Center(child: Text('시즌 순위표가 비활성화되어 있습니다.'));
    }
    return RefreshIndicator(
      onRefresh: () => ref.refresh(clubSeasonRankingProvider(request).future),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: <Widget>[
          DropdownButtonFormField<String?>(
            key: ValueKey<String?>(ranking.season?.id),
            initialValue: ranking.season?.id,
            decoration: const InputDecoration(labelText: '시즌'),
            items: ranking.seasons
                .map(
                  (season) => DropdownMenuItem<String?>(
                    value: season.id,
                    child: Text('${season.name} · ${_status(season.status)}'),
                  ),
                )
                .toList(),
            onChanged: (value) => setState(() => _seasonId = value),
          ),
          const SizedBox(height: 12),
          if (ranking.bowlerHiddenEnabled)
            SegmentedButton<String>(
              key: const Key('hidden-competition-filter'),
              segments: const <ButtonSegment<String>>[
                ButtonSegment(value: 'ALL', label: Text('전체')),
                ButtonSegment(value: 'INDIVIDUAL', label: Text('개인전')),
                ButtonSegment(value: 'TEAM', label: Text('팀전')),
                ButtonSegment(value: 'EVENT', label: Text('이벤트전')),
              ],
              selected: <String>{_competitionType},
              onSelectionChanged: (value) =>
                  setState(() => _competitionType = value.single),
            ),
          const SizedBox(height: 16),
          if (ranking.season == null)
            const _Empty(message: '조회할 시즌이 없습니다.')
          else if (ranking.rows.isEmpty)
            const _Empty(message: '발표된 시즌 포인트가 없습니다.')
          else ...<Widget>[
            Text(
              '${ranking.season!.name} · ${ranking.rows.length}명',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 10),
            _RankingGrid(
              rows: ranking.rows,
              onMember: ranking.bowlerHiddenEnabled
                  ? (row) => _showMember(userId, ranking, row)
                  : null,
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _showMember(
    String userId,
    ClubSeasonRanking ranking,
    ClubSeasonRankingRow row,
  ) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _SeasonMemberSheet(
      request: (
        userId: userId,
        teamId: widget.teamId,
        memberId: row.id,
        seasonId: ranking.season?.id,
        competitionType: _competitionType,
      ),
    ),
  );
}

class _RankingGrid extends StatelessWidget {
  const _RankingGrid({required this.rows, required this.onMember});
  final List<ClubSeasonRankingRow> rows;
  final ValueChanged<ClubSeasonRankingRow>? onMember;

  @override
  Widget build(BuildContext context) {
    const rowHeight = 58.0;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: 176,
            child: Column(
              children: <Widget>[
                const _GridCell(height: 46, child: Text('순위  이름  포인트')),
                for (final row in rows)
                  InkWell(
                    onTap: onMember == null ? null : () => onMember!(row),
                    child: _GridCell(
                      height: rowHeight,
                      child: Row(
                        children: <Widget>[
                          SizedBox(width: 32, child: Text('${row.rank}')),
                          Expanded(
                            child: Text(
                              row.name,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Text(
                            '${row.points}P',
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SizedBox(
                width: 12 * 112 + 20,
                child: Column(
                  children: <Widget>[
                    _GridCell(
                      height: 46,
                      child: Row(
                        children: <Widget>[
                          for (int month = 1; month <= 12; month++)
                            SizedBox(width: 112, child: Text('$month월')),
                        ],
                      ),
                    ),
                    for (final row in rows)
                      _GridCell(
                        height: rowHeight,
                        child: Row(
                          children: <Widget>[
                            for (final entries in row.monthlyHistory)
                              SizedBox(
                                width: 112,
                                child: Text(
                                  entries.isEmpty
                                      ? '-'
                                      : entries.map(_entryLabel).join('\n'),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 11),
                                ),
                              ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GridCell extends StatelessWidget {
  const _GridCell({required this.height, required this.child});
  final double height;
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    height: height,
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(
      border: Border(bottom: BorderSide(color: Theme.of(context).dividerColor)),
    ),
    alignment: Alignment.centerLeft,
    child: child,
  );
}

class _SeasonMemberSheet extends ConsumerWidget {
  const _SeasonMemberSheet({required this.request});
  final ClubSeasonMemberRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(clubSeasonMemberProvider(request));
    return SafeArea(
      child: FractionallySizedBox(
        heightFactor: .85,
        child: value.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(child: Text(_message(error))),
          data: (member) => ListView(
            padding: const EdgeInsets.all(20),
            children: <Widget>[
              Text(
                member.name,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              Text('${member.points}P · ${member.competitionsPlayed}경기'),
              const SizedBox(height: 8),
              Wrap(
                spacing: 12,
                children: <Widget>[
                  Text('개인 ${member.individualPoints}P'),
                  Text('팀 ${member.teamPoints}P'),
                  Text('이벤트 ${member.eventPoints}P'),
                ],
              ),
              const Divider(height: 28),
              if (member.entries.isEmpty)
                const Text('포인트 획득 내역이 없습니다.')
              else
                for (final entry in member.entries)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(entry.competitionTitle),
                    subtitle: Text(
                      '${entry.month}월 · ${_type(entry.competitionType)} · '
                      '${entry.finalRank == null ? '순위 없음' : '${entry.finalRank}위'}',
                    ),
                    trailing: Text('+${entry.points}P'),
                    onTap: entry.eventId == null
                        ? null
                        : () {
                            Navigator.pop(context);
                            context.push(
                              '/club/${Uri.encodeComponent(request.teamId)}/events/${Uri.encodeComponent(entry.eventId!)}',
                            );
                          },
                  ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 48),
    child: Center(child: Text(message)),
  );
}

String _entryLabel(ClubSeasonPointEntry entry) =>
    '${_type(entry.competitionType)} ${entry.finalRank == null ? '-' : '${entry.finalRank}위'}(+${entry.points})';
String _type(String value) => switch (value) {
  'INDIVIDUAL' => '개인전',
  'TEAM' => '팀전',
  'EVENT' => '이벤트전',
  _ => value,
};
String _status(String value) => switch (value) {
  'DRAFT' => '준비',
  'ACTIVE' => '진행',
  'COMPLETED' => '완료',
  _ => value,
};
String _message(Object error) =>
    error is ApiException ? error.userMessage : '시즌 순위를 불러오지 못했습니다.';
