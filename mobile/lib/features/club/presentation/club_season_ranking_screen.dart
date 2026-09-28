import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_season_date_field.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/features/records/application/records_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubSeasonRankingScreen extends ConsumerStatefulWidget {
  const ClubSeasonRankingScreen({
    required this.teamId,
    this.initialSeasonId,
    super.key,
  });
  final String teamId;
  final String? initialSeasonId;

  @override
  ConsumerState<ClubSeasonRankingScreen> createState() =>
      _ClubSeasonRankingScreenState();
}

class _ClubSeasonRankingScreenState
    extends ConsumerState<ClubSeasonRankingScreen> {
  String? _seasonId;
  int? _historyYear;
  final Set<int> _knownYears = <int>{};
  String _competitionType = 'ALL';

  @override
  void initState() {
    super.initState();
    _seasonId = widget.initialSeasonId;
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) return const Scaffold(body: SizedBox.shrink());
    final request = (
      userId: user.id,
      teamId: widget.teamId,
      seasonId: _seasonId,
      year: _historyYear,
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
            TextButton.icon(
              key: const Key('season-list-link'),
              onPressed: () => _showSeasonList(ranking),
              icon: const Icon(Icons.history_rounded),
              label: const Text('시즌 목록'),
            ),
          if (canManage)
            TextButton.icon(
              key: const Key('season-management-link'),
              onPressed: value.value == null
                  ? null
                  : () => _showSeasonManagement(
                      value.value!,
                      profileRequest,
                      profile!,
                    ),
              icon: const Icon(Icons.settings_outlined),
              label: const Text('시즌 관리'),
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
        data: (ranking) => _body(
          user.id,
          request,
          ranking,
          profileRequest,
          profile,
          canManage,
        ),
      ),
    );
  }

  Widget _body(
    String userId,
    ClubSeasonRankingRequest request,
    ClubSeasonRanking ranking,
    ClubExpansionRequest profileRequest,
    ClubTeamProfile? profile,
    bool canManage,
  ) {
    if (!ranking.enabled) {
      return const Center(child: Text('시즌 순위표가 비활성화되어 있습니다.'));
    }
    for (final season in ranking.seasons) {
      for (
        int year = season.startDate.year;
        year <= season.endDate.year;
        year++
      ) {
        _knownYears.add(year);
      }
    }
    final List<int> historyYears = _knownYears.toList()
      ..sort((left, right) => right.compareTo(left));
    final historySeasons = _historyYear == null
        ? const <ClubSeason>[]
        : ranking.seasons
              .where(
                (season) =>
                    season.startDate.year <= _historyYear! &&
                    season.endDate.year >= _historyYear!,
              )
              .toList(growable: false);
    return RefreshIndicator(
      onRefresh: () => ref.refresh(clubSeasonRankingProvider(request).future),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: <Widget>[
          DropdownButtonFormField<String>(
            key: const Key('season-history-year'),
            initialValue: _historyYear?.toString() ?? 'CURRENT',
            decoration: const InputDecoration(labelText: '연도 선택'),
            items: <DropdownMenuItem<String>>[
              const DropdownMenuItem<String>(
                value: 'CURRENT',
                child: Text('현재 진행 시즌'),
              ),
              ...historyYears.map(
                (year) => DropdownMenuItem<String>(
                  value: '$year',
                  child: Text('$year년과 겹치는 시즌'),
                ),
              ),
            ],
            onChanged: (value) => setState(() {
              _historyYear = value == 'CURRENT' ? null : int.parse(value!);
              _seasonId = null;
              _competitionType = 'ALL';
            }),
          ),
          const SizedBox(height: 12),
          if (_historyYear != null && _seasonId == null) ...<Widget>[
            Text(
              '$_historyYear년 시즌',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            if (historySeasons.isEmpty)
              const _Empty(message: '이 연도와 겹치는 시즌이 없습니다.')
            else
              for (final season in historySeasons)
                Card(
                  child: ListTile(
                    key: Key('history-season-${season.id}'),
                    title: Text(season.name),
                    subtitle: Text(
                      '${_date(season.startDate)} ~ ${_date(season.endDate)}\n${_lifecycle(season.lifecycleStatus)} · ${season.rankingMode}',
                    ),
                    isThreeLine: true,
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => setState(() => _seasonId = season.id),
                  ),
                ),
            const SizedBox(height: 8),
          ] else ...<Widget>[
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
          ],
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
          if (_historyYear != null && _seasonId == null)
            const SizedBox.shrink()
          else if (ranking.season == null) ...<Widget>[
            const _Empty(message: '현재 진행 중인 시즌이 없습니다.'),
            if (canManage) ...<Widget>[
              const SizedBox(height: 12),
              FilledButton.icon(
                key: const Key('empty-season-create'),
                onPressed: () => _createSeason(profileRequest, profile!),
                icon: const Icon(Icons.add_rounded),
                label: const Text('시즌 만들기'),
              ),
            ],
          ] else if (ranking.rankingMode == 'IMAGE')
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                ClubRankingImageGallery(
                  userId: userId,
                  teamId: widget.teamId,
                  season: ranking.season!,
                  images: ranking.rankingImages,
                ),
                if (canManage) ...<Widget>[
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    key: const Key('ranking-image-management-link'),
                    onPressed: () => context.push(
                      '/club/${Uri.encodeComponent(widget.teamId)}/manage/team?seasonId=${Uri.encodeQueryComponent(ranking.season!.id)}',
                    ),
                    icon: const Icon(Icons.photo_library_outlined),
                    label: const Text('순위표 이미지 관리'),
                  ),
                ],
              ],
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
              currentMemberId: ranking.myMemberId,
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

  Future<void> _showSeasonManagement(
    ClubSeasonRanking ranking,
    ClubExpansionRequest request,
    ClubTeamProfile profile,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: DraggableScrollableSheet(
          expand: false,
          initialChildSize: .72,
          maxChildSize: .92,
          builder: (context, controller) => ListView(
            controller: controller,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: <Widget>[
              ListTile(
                title: const Text(
                  '시즌 관리',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                trailing: FilledButton.icon(
                  key: const Key('season-create-link'),
                  onPressed: () async {
                    Navigator.pop(sheetContext);
                    await _createSeason(request, profile);
                  },
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('시즌 만들기'),
                ),
              ),
              for (final season in ranking.seasons)
                Card(
                  child: ListTile(
                    key: Key('manage-season-${season.id}'),
                    title: Text(season.name),
                    subtitle: Text(
                      '${_date(season.startDate)} ~ ${_date(season.endDate)}\n${_lifecycle(season.lifecycleStatus)} · ${season.rankingMode}',
                    ),
                    isThreeLine: true,
                    trailing: IconButton(
                      key: Key('edit-season-${season.id}'),
                      tooltip: '기본 정보 및 데이터 관리',
                      onPressed: () {
                        Navigator.pop(sheetContext);
                        context.push(
                          '/club/${Uri.encodeComponent(widget.teamId)}/manage/team?seasonId=${Uri.encodeQueryComponent(season.id)}',
                        );
                      },
                      icon: const Icon(Icons.edit_outlined),
                    ),
                    onTap: () {
                      Navigator.pop(sheetContext);
                      setState(() {
                        _historyYear = null;
                        _seasonId = season.id;
                      });
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
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
                ClubSeasonDateField(
                  key: const Key('new-season-start'),
                  controller: start,
                  label: '시작일',
                ),
                ClubSeasonDateField(
                  key: const Key('new-season-end'),
                  controller: end,
                  label: '종료일',
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
    final startDate = parseClubDate(value['startDate'] ?? '');
    final endDate = parseClubDate(value['endDate'] ?? '');
    if ((value['name'] ?? '').isEmpty || startDate == null || endDate == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('시즌 이름과 시작일·종료일을 확인해주세요.')));
      return;
    }
    if (!startDate.isBefore(endDate)) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('종료일은 시작일보다 이후여야 합니다.')));
      return;
    }
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
      setState(() {
        _historyYear = null;
        _seasonId = null;
      });
      ref.invalidate(clubSeasonRankingProvider);
      ref.invalidate(clubTeamProfileProvider(request));
      ref.invalidate(dashboardProvider(request.userId));
      ref.invalidate(recordsControllerProvider(request.userId));
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('${season.name}을(를) 만들었습니다.')));
      final updated = await ref.read(
        clubSeasonRankingProvider((
          userId: request.userId,
          teamId: request.teamId,
          seasonId: null,
          year: null,
          competitionType: 'ALL',
        )).future,
      );
      if (mounted) await _showSeasonManagement(updated, request, profile);
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
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
      final edited = await showDialog<bool>(
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
                    subtitle: Text('계산 ${row.rank}위 → 최종 ${index + 1}위'),
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
                child: const Text('순위 편집 완료'),
              ),
            ],
          ),
        ),
      );
      if (edited != true) return;
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
    if (!mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('최종순위 확정'),
        content: Text('${season.name}의 최종순위를 확정하시겠습니까?'),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          FilledButton(
            key: const Key('finalize-season-submit'),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('최종순위 확정'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
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
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
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

class ClubSeasonRankingGrid extends StatefulWidget {
  const ClubSeasonRankingGrid({
    required this.rows,
    required this.onMember,
    required this.hidden,
    this.competitionColumns = const <ClubSeasonCompetitionColumn>[],
    this.currentMemberId,
    super.key,
  });
  final List<ClubSeasonRankingRow> rows;
  final ValueChanged<ClubSeasonRankingRow>? onMember;
  final bool hidden;
  final List<ClubSeasonCompetitionColumn> competitionColumns;
  final String? currentMemberId;

  @override
  State<ClubSeasonRankingGrid> createState() => _ClubSeasonRankingGridState();
}

class _ClubSeasonRankingGridState extends State<ClubSeasonRankingGrid> {
  static const double _rankWidth = 44;
  static const double _nameWidth = 82;
  static const double _pointsWidth = 56;
  static const double _competitionWidth = 88;
  static const double _supplementWidth = 72;
  static const double _headerHeight = 58;
  static const double _rowHeight = 64;
  final ScrollController _horizontalController = ScrollController();

  @override
  void dispose() {
    _horizontalController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    final double rightWidth =
        widget.hidden && widget.competitionColumns.isNotEmpty
        ? widget.competitionColumns.length * _competitionWidth +
              2 * _supplementWidth
        : widget.hidden
        ? 12 * 64 + 2 * _supplementWidth
        : 12 * 112;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: _rankWidth + _nameWidth + _pointsWidth,
            child: Column(
              children: <Widget>[
                _GridCell(
                  height: _headerHeight,
                  color: colors.surfaceContainerHighest,
                  padding: EdgeInsets.zero,
                  child: const Row(
                    children: <Widget>[
                      _RankingColumnHeader(width: _rankWidth, label: '순위'),
                      _RankingColumnHeader(width: _nameWidth, label: '이름'),
                      _RankingColumnHeader(width: _pointsWidth, label: '총P'),
                    ],
                  ),
                ),
                for (final row in widget.rows)
                  InkWell(
                    onTap: widget.onMember == null
                        ? null
                        : () => widget.onMember!(row),
                    child: _GridCell(
                      height: _rowHeight,
                      color: row.id == widget.currentMemberId
                          ? colors.primaryContainer.withValues(alpha: .42)
                          : null,
                      padding: EdgeInsets.zero,
                      child: Row(
                        children: <Widget>[
                          SizedBox(
                            width: _rankWidth,
                            child: Text(
                              '${row.rank}위',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontWeight: row.rank <= 3
                                    ? FontWeight.w800
                                    : FontWeight.w600,
                                color: row.rank <= 3 ? colors.primary : null,
                              ),
                            ),
                          ),
                          SizedBox(
                            width: _nameWidth,
                            child: Text(
                              row.name,
                              textAlign: TextAlign.center,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          SizedBox(
                            width: _pointsWidth,
                            child: Text(
                              '${row.points}P',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: Scrollbar(
              controller: _horizontalController,
              thumbVisibility: true,
              scrollbarOrientation: ScrollbarOrientation.bottom,
              child: SingleChildScrollView(
                controller: _horizontalController,
                scrollDirection: Axis.horizontal,
                child: SizedBox(
                  width: rightWidth,
                  child: Column(
                    children: <Widget>[
                      _GridCell(
                        height: _headerHeight,
                        color: colors.surfaceContainerHighest,
                        padding: EdgeInsets.zero,
                        child: Row(
                          children: <Widget>[
                            if (widget.hidden &&
                                widget.competitionColumns.isNotEmpty)
                              for (final column in widget.competitionColumns)
                                SizedBox(
                                  width: _competitionWidth,
                                  child: Text(
                                    '${column.month}월 · ${_type(column.competitionType)}\n${column.displayName}',
                                    textAlign: TextAlign.center,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                )
                            else
                              for (int month = 1; month <= 12; month++)
                                SizedBox(
                                  width: widget.hidden ? 64 : 112,
                                  child: Text(
                                    '$month월',
                                    textAlign: TextAlign.center,
                                  ),
                                ),
                            if (widget.hidden) ...<Widget>[
                              const _RankingColumnHeader(
                                width: _supplementWidth,
                                label: '기초P',
                              ),
                              const _RankingColumnHeader(
                                width: _supplementWidth,
                                label: '조정P',
                              ),
                            ],
                          ],
                        ),
                      ),
                      for (final row in widget.rows)
                        _GridCell(
                          height: _rowHeight,
                          color: row.id == widget.currentMemberId
                              ? colors.primaryContainer.withValues(alpha: .42)
                              : null,
                          padding: EdgeInsets.zero,
                          child: Row(
                            children: <Widget>[
                              if (widget.hidden &&
                                  widget.competitionColumns.isNotEmpty)
                                for (final column in widget.competitionColumns)
                                  SizedBox(
                                    width: _competitionWidth,
                                    child: Text(
                                      _competitionCell(row, column.id),
                                      textAlign: TextAlign.center,
                                      maxLines: 2,
                                      style: const TextStyle(fontSize: 11),
                                    ),
                                  )
                              else if (widget.hidden)
                                for (final points in row.monthlyPoints)
                                  SizedBox(
                                    width: 64,
                                    child: Text(
                                      points == 0 ? '-' : _signedPoints(points),
                                      textAlign: TextAlign.center,
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
                                      textAlign: TextAlign.center,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontSize: 11),
                                    ),
                                  ),
                              if (widget.hidden) ...<Widget>[
                                SizedBox(
                                  width: _supplementWidth,
                                  child: Text(
                                    _signedPoints(row.openingBalancePoints),
                                    textAlign: TextAlign.center,
                                  ),
                                ),
                                SizedBox(
                                  width: _supplementWidth,
                                  child: Text(
                                    _signedPoints(row.adjustmentPoints),
                                    textAlign: TextAlign.center,
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
          ),
        ],
      ),
    );
  }
}

class _RankingColumnHeader extends StatelessWidget {
  const _RankingColumnHeader({required this.width, required this.label});
  final double width;
  final String label;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: width,
    child: Text(
      label,
      textAlign: TextAlign.center,
      style: const TextStyle(fontWeight: FontWeight.w800),
    ),
  );
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
  const _GridCell({
    required this.height,
    required this.child,
    this.color,
    this.padding = const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
  });
  final double height;
  final Widget child;
  final Color? color;
  final EdgeInsetsGeometry padding;
  @override
  Widget build(BuildContext context) => Container(
    height: height,
    padding: padding,
    decoration: BoxDecoration(
      color: color,
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
