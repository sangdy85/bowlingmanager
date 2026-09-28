import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
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
      year: null as int?,
      competitionType: _competitionType,
    );
    final value = ref.watch(clubSeasonRankingProvider(request));
    final profileRequest = (userId: user.id, teamId: widget.teamId);
    final profile = ref.watch(clubTeamProfileProvider(profileRequest)).value;
    final bool canManage =
        profile?.myRole == ClubRole.owner ||
        profile?.myRole == ClubRole.manager;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          value.value?.bowlerHiddenEnabled == false ? '시즌 순위' : '시즌 종합순위',
        ),
        actions: <Widget>[
          if (value.value case final ClubSeasonRanking ranking)
            IconButton(
              key: const Key('season-list-link'),
              tooltip: '시즌 목록',
              onPressed: () => _showSeasonList(ranking),
              icon: const Icon(Icons.history_rounded),
            ),
          if (canManage)
            IconButton(
              key: const Key('season-create-link'),
              tooltip: '새 시즌 만들기',
              onPressed: () => _createSeason(profileRequest, profile!),
              icon: const Icon(Icons.add_rounded),
            ),
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
        data: (ranking) =>
            _body(user.id, request, ranking, profileRequest, canManage),
      ),
    );
  }

  Widget _body(
    String userId,
    ClubSeasonRankingRequest request,
    ClubSeasonRanking ranking,
    ClubExpansionRequest profileRequest,
    bool canManage,
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
          if (ranking.bowlerHiddenEnabled && ranking.rankingMode == 'DATA')
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
          if (ranking.season case final ClubSeason season) ...<Widget>[
            _SeasonStatusBanner(season: season),
            const SizedBox(height: 12),
            if (ranking.finalRanking
                case final ClubSeasonFinalRanking finalRank)
              _FinalRankingCard(finalRanking: finalRank)
            else if (season.lifecycleStatus == 'ENDED')
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('최종 순위 미확정'),
                ),
              ),
            if (canManage && season.lifecycleStatus == 'ENDED') ...<Widget>[
              const SizedBox(height: 8),
              OutlinedButton.icon(
                key: const Key('finalize-season-ranking'),
                onPressed: () =>
                    _finalizeSeason(request, profileRequest, ranking),
                icon: const Icon(Icons.verified_outlined),
                label: Text(
                  ranking.finalRanking == null ? '최종 순위 확정' : '최종 순위 재확정',
                ),
              ),
              const SizedBox(height: 8),
            ],
          ],
          if (ranking.season == null)
            const _Empty(message: '조회할 시즌이 없습니다.')
          else if (ranking.rankingMode == 'IMAGE')
            ClubRankingImageGallery(
              userId: userId,
              teamId: widget.teamId,
              season: ranking.season!,
              images: ranking.rankingImages,
            )
          else if (ranking.rows.isEmpty)
            const _Empty(message: '발표된 시즌 포인트가 없습니다.')
          else ...<Widget>[
            Text(
              '${ranking.season!.name} · ${ranking.rows.length}명',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 10),
            ClubSeasonRankingGrid(
              rows: ranking.rows,
              competitionColumns: ranking.competitionColumns,
              hidden: ranking.bowlerHiddenEnabled,
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

  Future<void> _showSeasonList(ClubSeasonRanking ranking) async {
    final String? selected = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.symmetric(vertical: 12),
          children: <Widget>[
            const ListTile(
              title: Text(
                '시즌 목록',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
            for (final season in ranking.seasons)
              ListTile(
                key: Key('season-list-${season.id}'),
                selected: season.id == ranking.season?.id,
                title: Text(season.name),
                subtitle: Text(
                  '${_date(season.startDate)} ~ ${_date(season.endDate)} · ${_lifecycle(season.lifecycleStatus)}',
                ),
                onTap: () => Navigator.pop(context, season.id),
              ),
          ],
        ),
      ),
    );
    if (selected != null && mounted) setState(() => _seasonId = selected);
  }

  Future<void> _createSeason(
    ClubExpansionRequest request,
    ClubTeamProfile profile,
  ) async {
    final name = TextEditingController();
    final start = TextEditingController();
    final end = TextEditingController();
    String rankingMode = 'DATA';
    final Map<String, String>? value = await showDialog<Map<String, String>>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('새 시즌 만들기'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                TextField(
                  key: const Key('new-season-name'),
                  controller: name,
                  decoration: const InputDecoration(labelText: '시즌 이름'),
                ),
                TextField(
                  key: const Key('new-season-start'),
                  controller: start,
                  decoration: const InputDecoration(
                    labelText: '시작일 (YYYY-MM-DD)',
                  ),
                ),
                TextField(
                  key: const Key('new-season-end'),
                  controller: end,
                  decoration: const InputDecoration(
                    labelText: '종료일 (YYYY-MM-DD)',
                  ),
                ),
                if (profile.bowlerHiddenEnabled) ...<Widget>[
                  const SizedBox(height: 12),
                  SegmentedButton<String>(
                    key: const Key('new-season-ranking-mode'),
                    segments: const <ButtonSegment<String>>[
                      ButtonSegment(value: 'DATA', label: Text('데이터')),
                      ButtonSegment(value: 'IMAGE', label: Text('이미지')),
                    ],
                    selected: <String>{rankingMode},
                    onSelectionChanged: (values) =>
                        setDialogState(() => rankingMode = values.single),
                  ),
                ],
              ],
            ),
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('취소'),
            ),
            FilledButton(
              key: const Key('create-season-submit'),
              onPressed: () => Navigator.pop(context, <String, String>{
                'name': name.text.trim(),
                'startDate': start.text.trim(),
                'endDate': end.text.trim(),
                'rankingMode': rankingMode,
              }),
              child: const Text('생성'),
            ),
          ],
        ),
      ),
    );
    name.dispose();
    start.dispose();
    end.dispose();
    if (value == null || !mounted) return;
    try {
      final season = await ref
          .read(clubExpansionApiProvider)
          .createSeason(
            widget.teamId,
            name: value['name']!,
            startDate: value['startDate']!,
            endDate: value['endDate']!,
            rankingMode: value['rankingMode']!,
          );
      if (!mounted) return;
      setState(() => _seasonId = season.id);
      ref.invalidate(clubSeasonRankingProvider);
      ref.invalidate(clubTeamProfileProvider(request));
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_message(error))));
      }
    }
  }

  Future<void> _finalizeSeason(
    ClubSeasonRankingRequest request,
    ClubExpansionRequest profileRequest,
    ClubSeasonRanking ranking,
  ) async {
    final season = ranking.season;
    if (season == null) return;
    List<ClubSeasonRankingRow>? ordered;
    if (ranking.rankingMode == 'DATA') {
      final rows = List<ClubSeasonRankingRow>.from(ranking.rows);
      ordered = rows;
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            title: const Text('최종 순위 확정'),
            content: SizedBox(
              width: 420,
              height: 420,
              child: ReorderableListView.builder(
                itemCount: rows.length,
                onReorderItem: (oldIndex, newIndex) => setDialogState(() {
                  final row = rows.removeAt(oldIndex);
                  rows.insert(newIndex, row);
                }),
                itemBuilder: (context, index) {
                  final row = rows[index];
                  return ListTile(
                    key: ValueKey(row.id),
                    leading: Text('${index + 1}위'),
                    title: Text(row.name),
                    trailing: Text('${row.points}P'),
                  );
                },
              ),
            ),
            actions: <Widget>[
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('취소'),
              ),
              FilledButton(
                key: const Key('finalize-season-confirm'),
                onPressed: () => Navigator.pop(context, true),
                child: const Text('이 순위로 확정'),
              ),
            ],
          ),
        ),
      );
      if (confirmed != true) return;
    } else {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('이미지 시즌 종료'),
          content: const Text('등록된 순위표 이미지를 이 시즌의 역사 기록으로 확정할까요?'),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('취소'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('확정'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
    }
    try {
      await ref
          .read(clubExpansionApiProvider)
          .finalizeSeason(
            widget.teamId,
            season.id,
            orderedMemberIds: ordered
                ?.map((row) => row.id)
                .toList(growable: false),
          );
      ref.invalidate(clubSeasonRankingProvider);
      ref.invalidate(clubTeamProfileProvider(profileRequest));
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('최종 순위를 확정했습니다.')));
      }
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_message(error))));
      }
    }
  }
}

class _SeasonStatusBanner extends StatelessWidget {
  const _SeasonStatusBanner({required this.season});
  final ClubSeason season;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: <Widget>[
          const Icon(Icons.calendar_month_outlined),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '${season.name} · ${_date(season.startDate)} ~ ${_date(season.endDate)}',
            ),
          ),
          Text(
            _lifecycle(season.lifecycleStatus),
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    ),
  );
}

class _FinalRankingCard extends StatelessWidget {
  const _FinalRankingCard({required this.finalRanking});
  final ClubSeasonFinalRanking finalRanking;

  @override
  Widget build(BuildContext context) => Card(
    key: const Key('season-final-ranking'),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            '최종 확정 순위 · ${finalRanking.revision}차',
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 4),
          Text(
            '${finalRanking.finalizedByName} · ${_dateTime(finalRanking.finalizedAt)}',
            style: const TextStyle(color: Colors.grey),
          ),
          if (finalRanking.entries.isNotEmpty) ...<Widget>[
            const Divider(height: 24),
            for (final entry in finalRanking.entries)
              Padding(
                padding: const EdgeInsets.only(bottom: 7),
                child: Row(
                  children: <Widget>[
                    SizedBox(width: 42, child: Text('${entry.rank}위')),
                    Expanded(child: Text(entry.displayName)),
                    Text('${entry.totalPoints}P'),
                  ],
                ),
              ),
          ],
        ],
      ),
    ),
  );
}

class ClubSeasonRankingGrid extends StatelessWidget {
  const ClubSeasonRankingGrid({
    required this.rows,
    required this.onMember,
    required this.hidden,
    this.competitionColumns = const <ClubSeasonCompetitionColumn>[],
    super.key,
  });
  final List<ClubSeasonRankingRow> rows;
  final ValueChanged<ClubSeasonRankingRow>? onMember;
  final bool hidden;
  final List<ClubSeasonCompetitionColumn> competitionColumns;

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
                _GridCell(
                  height: 46,
                  child: Text(hidden ? '순위  이름  총P' : '순위  이름  포인트'),
                ),
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
                width: hidden && competitionColumns.isNotEmpty
                    ? competitionColumns.length * 112 + 152
                    : hidden
                    ? 12 * 64 + 176
                    : 12 * 112 + 20,
                child: Column(
                  children: <Widget>[
                    _GridCell(
                      height: 46,
                      child: Row(
                        children: <Widget>[
                          if (hidden && competitionColumns.isNotEmpty)
                            for (final column in competitionColumns)
                              SizedBox(
                                width: 112,
                                child: Text(
                                  '${column.month}월 ${_type(column.competitionType)}\n${column.displayName}',
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 11),
                                ),
                              )
                          else
                            for (int month = 1; month <= 12; month++)
                              SizedBox(
                                width: hidden ? 64 : 112,
                                child: Text('$month월'),
                              ),
                          if (hidden) ...<Widget>[
                            const SizedBox(width: 76, child: Text('기초P')),
                            const SizedBox(width: 76, child: Text('조정P')),
                          ],
                        ],
                      ),
                    ),
                    for (final row in rows)
                      _GridCell(
                        height: rowHeight,
                        child: Row(
                          children: <Widget>[
                            if (hidden && competitionColumns.isNotEmpty)
                              for (final column in competitionColumns)
                                SizedBox(
                                  width: 112,
                                  child: Text(
                                    _competitionCell(row, column.id),
                                    style: const TextStyle(fontSize: 11),
                                  ),
                                )
                            else if (hidden)
                              for (final points in row.monthlyPoints)
                                SizedBox(
                                  width: 64,
                                  child: Text(
                                    points == 0 ? '-' : _signedPoints(points),
                                  ),
                                )
                            else
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
                            if (hidden) ...<Widget>[
                              SizedBox(
                                width: 76,
                                child: Text(
                                  _signedPoints(row.openingBalancePoints),
                                ),
                              ),
                              SizedBox(
                                width: 76,
                                child: Text(
                                  _signedPoints(row.adjustmentPoints),
                                ),
                              ),
                            ],
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

String _competitionCell(ClubSeasonRankingRow row, String columnId) {
  ClubSeasonPointEntry? entry;
  for (final item in row.entries) {
    if (item.columnId == columnId) {
      entry = item;
      break;
    }
  }
  if (entry == null) return '-';
  final rank = entry.finalRank == null ? '순위 없음' : '${entry.finalRank}위';
  return '$rank\n${_signedPoints(entry.points)}P';
}

class ClubRankingImageGallery extends ConsumerWidget {
  const ClubRankingImageGallery({
    super.key,
    required this.userId,
    required this.teamId,
    required this.season,
    required this.images,
  });
  final String userId;
  final String teamId;
  final ClubSeason season;
  final List<ClubSeasonRankingImage> images;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (images.isEmpty) return const _Empty(message: '등록된 시즌 순위표 이미지가 없습니다.');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          '${season.name} 순위표',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 12),
        for (final image in images)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _RankingImageTile(
              request: (
                userId: userId,
                teamId: teamId,
                seasonId: season.id,
                imageId: image.id,
              ),
            ),
          ),
      ],
    );
  }
}

class _RankingImageTile extends ConsumerWidget {
  const _RankingImageTile({required this.request});
  final ClubRankingImageRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(clubRankingImageProvider(request));
    return value.when(
      loading: () => const SizedBox(
        height: 180,
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => const Card(
        child: Padding(
          padding: EdgeInsets.all(20),
          child: Text('이미지를 불러오지 못했습니다.'),
        ),
      ),
      data: (bytes) => Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          key: Key('season-ranking-image-${request.imageId}'),
          onTap: () => showDialog<void>(
            context: context,
            builder: (context) => Dialog.fullscreen(
              child: Stack(
                children: <Widget>[
                  Positioned.fill(
                    child: InteractiveViewer(
                      minScale: .5,
                      maxScale: 5,
                      child: Center(
                        child: Image.memory(bytes, fit: BoxFit.contain),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 12,
                    right: 12,
                    child: IconButton.filled(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close),
                    ),
                  ),
                ],
              ),
            ),
          ),
          child: Image.memory(
            bytes,
            height: 220,
            width: double.infinity,
            fit: BoxFit.contain,
          ),
        ),
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
                  Text('기존 기록 ${member.legacyPoints}P'),
                  Text('조정 ${_signedPoints(member.adjustmentPoints)}P'),
                ],
              ),
              const Divider(height: 28),
              if (member.entries.isEmpty)
                const Text('포인트 획득 내역이 없습니다.')
              else
                for (final entry in member.entries)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(entry.reason ?? entry.competitionTitle),
                    subtitle: Text(
                      entry.sourceType == 'MANUAL_ADJUSTMENT'
                          ? '${entry.month}월 · 수동 조정'
                          : entry.sourceType == 'LEGACY_OPENING_BALANCE'
                          ? '기존 누적 포인트 · 경기 기록 없음'
                          : '${entry.month}월 · ${_type(entry.competitionType)} · '
                                '${entry.finalRank == null ? '순위 없음' : '${entry.finalRank}위'}',
                    ),
                    trailing: Text('${_signedPoints(entry.points)}P'),
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
    entry.sourceType == 'MANUAL_ADJUSTMENT'
    ? '조정(${_signedPoints(entry.points)})'
    : entry.sourceType == 'LEGACY_OPENING_BALANCE'
    ? '기존 누적(${_signedPoints(entry.points)})'
    : entry.sourceType == 'LEGACY_IMPORT'
    ? '기존 ${_type(entry.competitionType)} ${entry.finalRank}위(${_signedPoints(entry.points)})'
    : '${_type(entry.competitionType)} ${entry.finalRank == null ? '-' : '${entry.finalRank}위'}(${_signedPoints(entry.points)})';
String _signedPoints(int value) => value > 0 ? '+$value' : '$value';
String _type(String value) => switch (value) {
  'INDIVIDUAL' => '개인전',
  'TEAM' => '팀전',
  'EVENT' => '이벤트전',
  'MANUAL_ADJUSTMENT' => '수동 조정',
  'LEGACY_OPENING_BALANCE' => '기존 누적 포인트',
  _ => value,
};
String _status(String value) => switch (value) {
  'DRAFT' => '준비',
  'ACTIVE' => '진행',
  'COMPLETED' => '완료',
  _ => value,
};
String _lifecycle(String value) => switch (value) {
  'UPCOMING' => '시즌 예정',
  'ACTIVE' => '시즌 진행 중',
  'ENDED' => '종료',
  _ => value,
};
String _date(DateTime value) =>
    '${value.year}.${value.month.toString().padLeft(2, '0')}.${value.day.toString().padLeft(2, '0')}';
String _dateTime(DateTime value) =>
    '${_date(value)} ${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
String _message(Object error) =>
    error is ApiException ? error.userMessage : '시즌 순위를 불러오지 못했습니다.';
