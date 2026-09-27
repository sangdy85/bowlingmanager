import 'dart:convert';

import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_expansion_api.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_legacy_csv.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_legacy_import_models.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ClubLegacyImportScreen extends ConsumerStatefulWidget {
  const ClubLegacyImportScreen({super.key, required this.teamId});
  final String teamId;

  @override
  ConsumerState<ClubLegacyImportScreen> createState() =>
      _ClubLegacyImportScreenState();
}

class _ClubLegacyImportScreenState
    extends ConsumerState<ClubLegacyImportScreen> {
  Future<List<ClubLegacyImportBatch>>? _batches;
  String? _loadedSeasonId;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) return const Scaffold(body: SizedBox.shrink());
    final profileRequest = (userId: user.id, teamId: widget.teamId);
    return Scaffold(
      appBar: AppBar(title: const Text('기존 시즌 데이터 가져오기')),
      body: ref
          .watch(clubTeamProfileProvider(profileRequest))
          .when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, _) => Center(child: Text(clubErrorMessage(error))),
            data: (profile) {
              final canManage =
                  profile.myRole == ClubRole.owner ||
                  profile.myRole == ClubRole.manager;
              final season = profile.activeSeason;
              if (!profile.bowlerHiddenEnabled || !canManage) {
                return const Center(child: Text('기존 시즌 데이터를 관리할 권한이 없습니다.'));
              }
              if (season == null) {
                return const Center(child: Text('활성 시즌이 없습니다.'));
              }
              final request = (
                userId: user.id,
                teamId: widget.teamId,
                seasonId: season.id as String?,
                year: null as int?,
                competitionType: 'ALL',
              );
              return ref
                  .watch(clubSeasonRankingProvider(request))
                  .when(
                    loading: () =>
                        const Center(child: CircularProgressIndicator()),
                    error: (error, _) =>
                        Center(child: Text(clubErrorMessage(error))),
                    data: (ranking) {
                      if (ranking.rankingMode != 'DATA') {
                        return const Center(
                          child: Text('데이터 관리 방식의 시즌에서만 사용할 수 있습니다.'),
                        );
                      }
                      _ensureBatches(season.id);
                      return _content(season, ranking, request);
                    },
                  );
            },
          ),
    );
  }

  Widget _content(
    ClubSeason season,
    ClubSeasonRanking ranking,
    ClubSeasonRankingRequest rankingRequest,
  ) => ListView(
    padding: const EdgeInsets.all(16),
    children: <Widget>[
      Text(season.name, style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 4),
      const Text('월별 기록이 있으면 상세 이관을 권장합니다. 이름만으로 회원을 자동 확정하지 않습니다.'),
      const SizedBox(height: 16),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: <Widget>[
          FilledButton.icon(
            key: const Key('legacy-direct-import'),
            onPressed: () =>
                _openStructuredEditor(season, ranking.rows, rankingRequest),
            icon: const Icon(Icons.edit_note),
            label: const Text('직접 입력'),
          ),
          OutlinedButton.icon(
            key: const Key('legacy-csv-import'),
            onPressed: () => _pickCsv(season, ranking.rows, rankingRequest),
            icon: const Icon(Icons.upload_file),
            label: const Text('CSV 가져오기'),
          ),
          OutlinedButton.icon(
            key: const Key('legacy-opening-import'),
            onPressed: () => _openEditor(
              season,
              ranking.rows,
              rankingRequest,
              'OPENING_BALANCE',
              ranking.rows
                  .map((member) => _ImportDraft.opening(member.id))
                  .toList(),
            ),
            icon: const Icon(Icons.account_balance_wallet_outlined),
            label: const Text('현재 포인트만 입력'),
          ),
        ],
      ),
      const Divider(height: 32),
      Text('이관 이력', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 8),
      FutureBuilder<List<ClubLegacyImportBatch>>(
        future: _batches,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(),
              ),
            );
          }
          if (snapshot.hasError) return Text(clubErrorMessage(snapshot.error!));
          final batches = snapshot.data ?? const <ClubLegacyImportBatch>[];
          if (batches.isEmpty) return const Text('등록된 기존 시즌 데이터가 없습니다.');
          return Column(
            children: batches
                .map(
                  (batch) => Card(
                    child: ListTile(
                      title: Text(
                        batch.mode == 'DETAILED' ? '상세 이관' : '기존 누적 포인트',
                      ),
                      subtitle: Text(
                        '${batch.rowCount}행 · ${batch.totalPoints}P · ${batch.enteredByName}'
                        '${batch.reversedAt == null ? '' : '\n취소됨: ${batch.reversalReason}'}',
                      ),
                      trailing: batch.reversedAt == null
                          ? TextButton(
                              onPressed: () =>
                                  _reverse(season.id, batch.id, rankingRequest),
                              child: const Text('취소'),
                            )
                          : const Icon(Icons.history),
                    ),
                  ),
                )
                .toList(),
          );
        },
      ),
    ],
  );

  void _ensureBatches(String seasonId) {
    if (_loadedSeasonId == seasonId) return;
    _loadedSeasonId = seasonId;
    _batches = ref
        .read(clubExpansionApiProvider)
        .fetchSeasonLegacyImports(widget.teamId, seasonId);
  }

  void _reloadBatches(String seasonId) {
    setState(() {
      _loadedSeasonId = seasonId;
      _batches = ref
          .read(clubExpansionApiProvider)
          .fetchSeasonLegacyImports(widget.teamId, seasonId);
    });
  }

  Future<void> _pickCsv(
    ClubSeason season,
    List<ClubSeasonRankingRow> members,
    ClubSeasonRankingRequest request,
  ) async {
    try {
      final file = await FilePicker.pickFile(
        type: FileType.custom,
        allowedExtensions: const <String>['csv'],
      );
      if (file == null || !mounted) return;
      final bytes = await file.readAsBytes();
      final document = parseClubLegacyCsv(utf8.decode(bytes));
      final drafts = document.rows
          .map(
            (row) => _ImportDraft(
              originalMember: row.memberLabel,
              eventDate: row.eventDate ?? '',
              competitionType: row.competitionType ?? 'INDIVIDUAL',
              placement: row.placement?.toString() ?? '',
              points: row.points.toString(),
              note: row.note ?? '',
            ),
          )
          .toList();
      await _openEditor(season, members, request, document.mode, drafts);
    } on FormatException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  Future<void> _openStructuredEditor(
    ClubSeason season,
    List<ClubSeasonRankingRow> members,
    ClubSeasonRankingRequest request,
  ) async {
    try {
      final api = ref.read(clubExpansionApiProvider);
      final competitions = await api.fetchManualCompetitions(
        widget.teamId,
        season.id,
      );
      if (!mounted) return;
      final saved = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => _LegacyStructuredEditor(
            teamId: widget.teamId,
            season: season,
            members: members,
            initialCompetitions: competitions,
            api: api,
          ),
        ),
      );
      if (saved != true || !mounted) return;
      ref.invalidate(clubSeasonRankingProvider(request));
      ref.invalidate(
        clubSeasonManualCompetitionsProvider((
          userId: request.userId,
          teamId: widget.teamId,
          seasonId: season.id,
        )),
      );
      ref.invalidate(clubSeasonMemberProvider);
      _reloadBatches(season.id);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('기존 시즌 구조화 데이터를 저장했습니다.')));
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
      }
    }
  }

  Future<void> _openEditor(
    ClubSeason season,
    List<ClubSeasonRankingRow> members,
    ClubSeasonRankingRequest request,
    String mode,
    List<_ImportDraft> drafts,
  ) async {
    final rows = await Navigator.of(context).push<List<ClubLegacyImportRow>>(
      MaterialPageRoute(
        builder: (_) =>
            _LegacyImportEditor(mode: mode, members: members, drafts: drafts),
      ),
    );
    if (rows == null || !mounted) return;
    try {
      final api = ref.read(clubExpansionApiProvider);
      final preview = await api.previewSeasonLegacyImport(
        widget.teamId,
        season.id,
        mode: mode,
        rows: rows,
      );
      if (!mounted) return;
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('이관 미리보기'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text('전체 ${preview.totalRows}행 · 총 ${preview.totalPoints}P'),
                const SizedBox(height: 12),
                for (final change in preview.memberChanges)
                  Text(
                    '${change.memberName}: ${change.previousPoints} → ${change.totalPoints}P',
                  ),
              ],
            ),
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('취소'),
            ),
            FilledButton(
              key: const Key('confirm-legacy-import'),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('등록'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
      await api.createSeasonLegacyImport(
        widget.teamId,
        season.id,
        mode: mode,
        rows: rows,
        importHash: preview.importHash,
      );
      ref.invalidate(clubSeasonRankingProvider(request));
      ref.invalidate(clubSeasonMemberProvider);
      _reloadBatches(season.id);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('기존 시즌 데이터를 등록했습니다.')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
      }
    }
  }

  Future<void> _reverse(
    String seasonId,
    String batchId,
    ClubSeasonRankingRequest request,
  ) async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('이관 batch 취소'),
        content: TextField(
          controller: controller,
          maxLength: 500,
          decoration: const InputDecoration(labelText: '취소 사유'),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('닫기'),
          ),
          FilledButton(
            onPressed: () {
              final value = controller.text.trim();
              if (value.isNotEmpty) Navigator.pop(context, value);
            },
            child: const Text('취소 기록 남기기'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (reason == null || !mounted) return;
    try {
      await ref
          .read(clubExpansionApiProvider)
          .reverseSeasonLegacyImport(widget.teamId, seasonId, batchId, reason);
      ref.invalidate(clubSeasonRankingProvider(request));
      ref.invalidate(clubSeasonMemberProvider);
      _reloadBatches(seasonId);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
      }
    }
  }
}

class _LegacyStructuredEditor extends StatefulWidget {
  const _LegacyStructuredEditor({
    required this.teamId,
    required this.season,
    required this.members,
    required this.initialCompetitions,
    required this.api,
  });

  final String teamId;
  final ClubSeason season;
  final List<ClubSeasonRankingRow> members;
  final List<ClubSeasonManualCompetition> initialCompetitions;
  final ClubExpansionApi api;

  @override
  State<_LegacyStructuredEditor> createState() =>
      _LegacyStructuredEditorState();
}

class _LegacyStructuredEditorState extends State<_LegacyStructuredEditor> {
  late final List<_StructuredCompetitionDraft> _competitions =
      widget.initialCompetitions
          .map(_StructuredCompetitionDraft.fromModel)
          .toList()
        ..sort(_compareCompetitionDrafts);
  late final Map<String, int> _initialManualPoints = <String, int>{
    for (final member in widget.members)
      member.id: widget.initialCompetitions.fold<int>(
        0,
        (sum, competition) =>
            sum +
            competition.results
                .where((result) => result.memberId == member.id)
                .fold<int>(0, (value, result) => value + result.points),
      ),
  };
  final Map<String, int> _targetTotals = <String, int>{};
  int _draftSequence = 0;
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    final views = _memberViews();
    return Scaffold(
      appBar: AppBar(title: const Text('기존 시즌 순위표 직접 입력')),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  widget.season.name,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                const Text('순위는 최종 포인트로 자동 계산됩니다. 셀을 눌러 순위와 포인트를 입력하세요.'),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  key: const Key('legacy-competition-add'),
                  onPressed: _saving ? null : _addCompetition,
                  icon: const Icon(Icons.add),
                  label: const Text('대회 추가'),
                ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  key: const Key('legacy-structured-table'),
                  headingRowHeight: 64,
                  dataRowMinHeight: 64,
                  dataRowMaxHeight: 76,
                  columns: <DataColumn>[
                    const DataColumn(label: Text('순위')),
                    const DataColumn(label: Text('이름')),
                    const DataColumn(label: Text('총P')),
                    for (final competition in _competitions)
                      DataColumn(
                        label: SizedBox(
                          width: 92,
                          child: Tooltip(
                            message: '${competition.date} ${competition.name}',
                            child: Text(
                              '${_monthLabel(competition.date)}\n${competition.name}',
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ),
                      ),
                  ],
                  rows: views
                      .map(
                        (view) => DataRow(
                          key: ValueKey<String>('legacy-row-${view.member.id}'),
                          cells: <DataCell>[
                            DataCell(Text('${view.rank}')),
                            DataCell(
                              Tooltip(
                                message: view.member.name,
                                child: SizedBox(
                                  width: 92,
                                  child: Text(
                                    view.member.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ),
                            ),
                            DataCell(
                              InkWell(
                                key: Key('legacy-total-${view.member.id}'),
                                onTap: _saving
                                    ? null
                                    : () => _editTargetTotal(view.member),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 12,
                                  ),
                                  child: Text(
                                    '${view.total}P${view.adjustment == 0 ? '' : '\n(${_signed(view.adjustment)})'}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            for (final competition in _competitions)
                              DataCell(
                                InkWell(
                                  key: Key(
                                    'legacy-cell-${view.member.id}-${competition.localId}',
                                  ),
                                  onTap: _saving
                                      ? null
                                      : () =>
                                            _editCell(competition, view.member),
                                  child: SizedBox(
                                    width: 92,
                                    child: Center(
                                      child: Text(
                                        _cellLabel(
                                          competition.results[view.member.id],
                                        ),
                                        textAlign: TextAlign.center,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      )
                      .toList(growable: false),
                ),
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: FilledButton.icon(
          key: const Key('legacy-structured-preview-cta'),
          onPressed: _saving ? null : _previewAndSave,
          icon: _saving
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.fact_check_outlined),
          label: Text(_saving ? '저장 중...' : '입력 내용 확인'),
        ),
      ),
    );
  }

  List<_StructuredMemberView> _memberViews() {
    final views =
        widget.members.map((member) {
          final draftManual = _competitions.fold<int>(
            0,
            (sum, competition) =>
                sum + (competition.results[member.id]?.points ?? 0),
          );
          final projected =
              member.points -
              (_initialManualPoints[member.id] ?? 0) +
              draftManual;
          final total = _targetTotals[member.id] ?? projected;
          return _StructuredMemberView(
            member: member,
            total: total,
            adjustment: total - projected,
          );
        }).toList()..sort(
          (left, right) => right.total.compareTo(left.total) != 0
              ? right.total.compareTo(left.total)
              : left.member.name.compareTo(right.member.name),
        );
    int previousTotal = -1;
    int previousRank = 0;
    for (var index = 0; index < views.length; index += 1) {
      final rank = views[index].total == previousTotal
          ? previousRank
          : index + 1;
      views[index] = views[index].copyWith(rank: rank);
      previousTotal = views[index].total;
      previousRank = rank;
    }
    return views;
  }

  Future<void> _addCompetition() async {
    final name = TextEditingController();
    final date = TextEditingController();
    var type = 'INDIVIDUAL';
    final result = await showDialog<_StructuredCompetitionDraft>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('과거 대회 추가'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              TextField(
                key: const Key('legacy-competition-name'),
                controller: name,
                maxLength: 100,
                decoration: const InputDecoration(labelText: '대회명'),
              ),
              TextField(
                key: const Key('legacy-competition-date'),
                controller: date,
                decoration: const InputDecoration(
                  labelText: '날짜',
                  hintText: '2026-01-05',
                ),
              ),
              DropdownButtonFormField<String>(
                key: const Key('legacy-competition-type'),
                initialValue: type,
                decoration: const InputDecoration(labelText: '유형'),
                items: const <DropdownMenuItem<String>>[
                  DropdownMenuItem(value: 'INDIVIDUAL', child: Text('개인전')),
                  DropdownMenuItem(value: 'TEAM', child: Text('팀전')),
                  DropdownMenuItem(value: 'EVENT', child: Text('이벤트전')),
                ],
                onChanged: (value) => setDialogState(() => type = value!),
              ),
            ],
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('취소'),
            ),
            FilledButton(
              key: const Key('confirm-legacy-competition-add'),
              onPressed: () {
                final parsedDate = DateTime.tryParse(date.text.trim());
                if (name.text.trim().isEmpty ||
                    parsedDate == null ||
                    parsedDate.isBefore(widget.season.startDate) ||
                    parsedDate.isAfter(widget.season.endDate)) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('시즌 기간 안의 대회명과 날짜를 확인해주세요.')),
                  );
                  return;
                }
                Navigator.pop(
                  context,
                  _StructuredCompetitionDraft(
                    localId: 'draft-${_draftSequence++}',
                    name: name.text.trim(),
                    date: date.text.trim(),
                    competitionType: type,
                  ),
                );
              },
              child: const Text('추가'),
            ),
          ],
        ),
      ),
    );
    if (result == null || !mounted) return;
    setState(() {
      _competitions.add(result);
      _competitions.sort(_compareCompetitionDrafts);
    });
  }

  Future<void> _editCell(
    _StructuredCompetitionDraft competition,
    ClubSeasonRankingRow member,
  ) async {
    final current = competition.results[member.id];
    final rank = TextEditingController(text: current?.rank?.toString() ?? '');
    final points = TextEditingController(
      text: current?.points.toString() ?? '0',
    );
    final result = await showDialog<_StructuredResultDraft>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('${member.name} · ${competition.name}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            TextField(
              key: const Key('legacy-cell-rank'),
              controller: rank,
              keyboardType: TextInputType.number,
              inputFormatters: <TextInputFormatter>[
                FilteringTextInputFormatter.digitsOnly,
              ],
              decoration: const InputDecoration(labelText: '순위'),
            ),
            TextField(
              key: const Key('legacy-cell-points'),
              controller: points,
              keyboardType: TextInputType.number,
              inputFormatters: <TextInputFormatter>[
                FilteringTextInputFormatter.digitsOnly,
              ],
              decoration: const InputDecoration(labelText: '포인트'),
            ),
          ],
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('취소'),
          ),
          FilledButton(
            key: const Key('confirm-legacy-cell'),
            onPressed: () {
              final parsedRank = rank.text.trim().isEmpty
                  ? null
                  : int.tryParse(rank.text.trim());
              final parsedPoints = int.tryParse(points.text.trim());
              if ((parsedRank != null &&
                      (parsedRank < 1 || parsedRank > 1000)) ||
                  parsedPoints == null ||
                  parsedPoints < 0 ||
                  parsedPoints > 100000) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('순위와 포인트를 확인해주세요.')),
                );
                return;
              }
              Navigator.pop(
                context,
                _StructuredResultDraft(rank: parsedRank, points: parsedPoints),
              );
            },
            child: const Text('적용'),
          ),
        ],
      ),
    );
    if (result == null || !mounted) return;
    setState(() => competition.results[member.id] = result);
  }

  Future<void> _editTargetTotal(ClubSeasonRankingRow member) async {
    final current = _memberViews().firstWhere(
      (view) => view.member.id == member.id,
    );
    final controller = TextEditingController(text: current.total.toString());
    final target = await showDialog<int>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('${member.name} 총점 보정'),
        content: TextField(
          key: const Key('legacy-target-total'),
          controller: controller,
          keyboardType: TextInputType.number,
          inputFormatters: <TextInputFormatter>[
            FilteringTextInputFormatter.digitsOnly,
          ],
          decoration: const InputDecoration(labelText: '실제 기존 총점'),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('취소'),
          ),
          FilledButton(
            key: const Key('confirm-legacy-target-total'),
            onPressed: () {
              final value = int.tryParse(controller.text.trim());
              if (value != null && value >= 0 && value <= 1000000) {
                Navigator.pop(context, value);
              }
            },
            child: const Text('적용'),
          ),
        ],
      ),
    );
    if (target == null || !mounted) return;
    setState(() => _targetTotals[member.id] = target);
  }

  Future<void> _previewAndSave() async {
    if (_competitions.isEmpty && _targetTotals.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('대회 또는 총점 보정을 입력해주세요.')));
      return;
    }
    if (_competitions.any(
      (competition) => competition.results.values.every(
        (result) => result.rank == null && result.points == 0,
      ),
    )) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('각 대회에 한 명 이상의 순위 또는 포인트를 입력해주세요.')),
      );
      return;
    }
    final views = _memberViews();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('${widget.season.name} 기존 데이터'),
        content: SizedBox(
          width: 420,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  '대회 ${_competitions.length}개 · 회원 ${widget.members.length}명',
                ),
                const SizedBox(height: 12),
                for (final view in views)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      '${view.member.name}\n대회 포인트 ${_manualPoints(view.member.id)}P · '
                      '보정 ${_signed(view.adjustment)}P · 최종 ${view.total}P',
                    ),
                  ),
              ],
            ),
          ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          FilledButton(
            key: const Key('confirm-legacy-structured-save'),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('저장'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _saving = true);
    try {
      await widget.api.saveStructuredSeasonRanking(
        widget.teamId,
        widget.season.id,
        competitions: _competitions
            .map((competition) {
              return <String, Object?>{
                'id': competition.id,
                'name': competition.name,
                'eventDate': competition.date,
                'competitionType': competition.competitionType,
                'results': competition.results.entries
                    .where(
                      (entry) =>
                          entry.value.rank != null || entry.value.points > 0,
                    )
                    .map((entry) {
                      final result = entry.value;
                      return <String, Object?>{
                        'memberId': entry.key,
                        'finalRank': result.rank,
                        'points': result.points,
                      };
                    })
                    .toList(growable: false),
              };
            })
            .toList(growable: false),
        targetTotals: _targetTotals.entries
            .map(
              (entry) => <String, Object>{
                'memberId': entry.key,
                'targetTotal': entry.value,
              },
            )
            .toList(growable: false),
      );
      if (mounted) Navigator.pop(context, true);
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  int _manualPoints(String memberId) => _competitions.fold<int>(
    0,
    (sum, competition) => sum + (competition.results[memberId]?.points ?? 0),
  );
}

class _StructuredCompetitionDraft {
  _StructuredCompetitionDraft({
    this.id,
    required this.localId,
    required this.name,
    required this.date,
    required this.competitionType,
    Map<String, _StructuredResultDraft>? results,
  }) : results = results ?? <String, _StructuredResultDraft>{};

  factory _StructuredCompetitionDraft.fromModel(
    ClubSeasonManualCompetition competition,
  ) => _StructuredCompetitionDraft(
    id: competition.id,
    localId: competition.id,
    name: competition.name,
    date: _dateOnlyKst(competition.eventDate),
    competitionType: competition.competitionType,
    results: <String, _StructuredResultDraft>{
      for (final result in competition.results)
        result.memberId: _StructuredResultDraft(
          rank: result.finalRank,
          points: result.points,
        ),
    },
  );

  final String? id;
  final String localId;
  String name;
  String date;
  String competitionType;
  final Map<String, _StructuredResultDraft> results;
}

class _StructuredResultDraft {
  const _StructuredResultDraft({required this.rank, required this.points});
  final int? rank;
  final int points;
}

class _StructuredMemberView {
  const _StructuredMemberView({
    required this.member,
    required this.total,
    required this.adjustment,
    this.rank = 0,
  });
  final ClubSeasonRankingRow member;
  final int total;
  final int adjustment;
  final int rank;

  _StructuredMemberView copyWith({required int rank}) => _StructuredMemberView(
    member: member,
    total: total,
    adjustment: adjustment,
    rank: rank,
  );
}

int _compareCompetitionDrafts(
  _StructuredCompetitionDraft left,
  _StructuredCompetitionDraft right,
) {
  final date = left.date.compareTo(right.date);
  if (date != 0) return date;
  final name = left.name.compareTo(right.name);
  return name != 0 ? name : left.localId.compareTo(right.localId);
}

String _dateOnlyKst(DateTime value) {
  final kst = value.toUtc().add(const Duration(hours: 9));
  return '${kst.year.toString().padLeft(4, '0')}-${kst.month.toString().padLeft(2, '0')}-${kst.day.toString().padLeft(2, '0')}';
}

String _monthLabel(String date) {
  final parsed = DateTime.tryParse(date);
  return parsed == null ? date : '${parsed.month}월';
}

String _cellLabel(_StructuredResultDraft? result) {
  if (result == null || (result.rank == null && result.points == 0)) return '-';
  return '${result.rank == null ? '-' : '${result.rank}위'}\n${result.points}P';
}

String _signed(int value) => value > 0 ? '+$value' : '$value';

class _ImportDraft {
  _ImportDraft({
    this.memberId,
    this.originalMember,
    this.eventDate = '',
    this.competitionType = 'INDIVIDUAL',
    this.placement = '',
    this.points = '',
    this.note = '',
  });
  factory _ImportDraft.detailed() => _ImportDraft();
  factory _ImportDraft.opening(String memberId) =>
      _ImportDraft(memberId: memberId);
  String? memberId;
  final String? originalMember;
  String eventDate;
  String competitionType;
  String placement;
  String points;
  String note;
}

class _LegacyImportEditor extends StatefulWidget {
  const _LegacyImportEditor({
    required this.mode,
    required this.members,
    required this.drafts,
  });
  final String mode;
  final List<ClubSeasonRankingRow> members;
  final List<_ImportDraft> drafts;
  @override
  State<_LegacyImportEditor> createState() => _LegacyImportEditorState();
}

class _LegacyImportEditorState extends State<_LegacyImportEditor> {
  final _form = GlobalKey<FormState>();
  late final List<_ImportDraft> _rows = widget.drafts;
  bool get _detailed => widget.mode == 'DETAILED';

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(_detailed ? '기존 경기 직접 입력' : '현재 포인트 입력')),
    floatingActionButton: _detailed
        ? FloatingActionButton.small(
            onPressed: () => setState(() => _rows.add(_ImportDraft.detailed())),
            child: const Icon(Icons.add),
          )
        : null,
    body: Form(
      key: _form,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _rows.length,
        itemBuilder: (context, index) => _row(index, _rows[index]),
      ),
    ),
    bottomNavigationBar: SafeArea(
      minimum: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: FilledButton.icon(
        key: const Key('legacy-import-preview-cta'),
        onPressed: _submit,
        icon: const Icon(Icons.fact_check_outlined),
        label: const Text('입력 내용 확인'),
      ),
    ),
  );

  Widget _row(int index, _ImportDraft row) => Card(
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        children: <Widget>[
          if (row.originalMember != null)
            Align(
              alignment: Alignment.centerLeft,
              child: Text('CSV 회원: ${row.originalMember} · 직접 확인 필요'),
            ),
          DropdownButtonFormField<String>(
            key: Key('legacy-member-$index'),
            initialValue: row.memberId,
            decoration: const InputDecoration(labelText: '회원'),
            items: widget.members
                .map(
                  (member) => DropdownMenuItem(
                    value: member.id,
                    child: Text(member.name),
                  ),
                )
                .toList(),
            onChanged: (value) => row.memberId = value,
            validator: (value) => value == null ? '회원을 직접 선택해주세요.' : null,
          ),
          if (_detailed) ...<Widget>[
            TextFormField(
              key: Key('legacy-date-$index'),
              initialValue: row.eventDate,
              decoration: const InputDecoration(
                labelText: '날짜 또는 월',
                hintText: '2026-01 또는 2026-01-15',
              ),
              onChanged: (value) => row.eventDate = value,
              validator: (value) =>
                  RegExp(r'^\d{4}-\d{2}(-\d{2})?$').hasMatch(value ?? '')
                  ? null
                  : 'YYYY-MM 또는 YYYY-MM-DD 형식으로 입력해주세요.',
            ),
            DropdownButtonFormField<String>(
              initialValue: row.competitionType,
              decoration: const InputDecoration(labelText: '경기 종류'),
              items: const <DropdownMenuItem<String>>[
                DropdownMenuItem(value: 'INDIVIDUAL', child: Text('개인전')),
                DropdownMenuItem(value: 'TEAM', child: Text('팀전')),
                DropdownMenuItem(value: 'EVENT', child: Text('이벤트전')),
              ],
              onChanged: (value) => row.competitionType = value!,
            ),
            TextFormField(
              key: Key('legacy-placement-$index'),
              initialValue: row.placement,
              decoration: const InputDecoration(labelText: '순위'),
              keyboardType: TextInputType.number,
              inputFormatters: <TextInputFormatter>[
                FilteringTextInputFormatter.digitsOnly,
              ],
              onChanged: (value) => row.placement = value,
              validator: (value) => (int.tryParse(value ?? '') ?? 0) < 1
                  ? '1 이상의 순위를 입력해주세요.'
                  : null,
            ),
          ],
          TextFormField(
            key: Key('legacy-points-$index'),
            initialValue: row.points,
            decoration: InputDecoration(
              labelText: _detailed ? '획득 포인트' : '기존 누적 포인트',
            ),
            keyboardType: TextInputType.number,
            inputFormatters: <TextInputFormatter>[
              FilteringTextInputFormatter.digitsOnly,
            ],
            onChanged: (value) => row.points = value,
            validator: (value) {
              final points = int.tryParse(value ?? '');
              if (!_detailed && (value ?? '').isEmpty) return null;
              return points == null || points < 1 || points > 100000
                  ? '1~100000 포인트를 입력해주세요.'
                  : null;
            },
          ),
          if (_detailed)
            TextFormField(
              initialValue: row.note,
              maxLength: 500,
              decoration: const InputDecoration(labelText: '메모 (선택)'),
              onChanged: (value) => row.note = value,
            ),
          if (_detailed && _rows.length > 1)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => setState(() => _rows.removeAt(index)),
                child: const Text('행 삭제'),
              ),
            ),
        ],
      ),
    ),
  );

  void _submit() {
    if (!_form.currentState!.validate()) return;
    final selected = _rows
        .where((row) => _detailed || row.points.isNotEmpty)
        .toList();
    if (selected.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('입력한 포인트가 없습니다.')));
      return;
    }
    Navigator.pop(
      context,
      selected
          .map(
            (row) => ClubLegacyImportRow(
              memberId: row.memberId!,
              points: int.parse(row.points),
              eventDate: _detailed ? row.eventDate : null,
              competitionType: _detailed ? row.competitionType : null,
              placement: _detailed ? int.parse(row.placement) : null,
              note: row.note.trim().isEmpty ? null : row.note.trim(),
            ),
          )
          .toList(),
    );
  }
}
