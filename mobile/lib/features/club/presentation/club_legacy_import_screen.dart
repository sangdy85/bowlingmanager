import 'dart:convert';

import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
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
                      _ensureBatches(season.id);
                      return _content(season, ranking.rows, request);
                    },
                  );
            },
          ),
    );
  }

  Widget _content(
    ClubSeason season,
    List<ClubSeasonRankingRow> members,
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
            onPressed: () => _openEditor(
              season,
              members,
              rankingRequest,
              'DETAILED',
              <_ImportDraft>[_ImportDraft.detailed()],
            ),
            icon: const Icon(Icons.edit_note),
            label: const Text('직접 입력'),
          ),
          OutlinedButton.icon(
            key: const Key('legacy-csv-import'),
            onPressed: () => _pickCsv(season, members, rankingRequest),
            icon: const Icon(Icons.upload_file),
            label: const Text('CSV 가져오기'),
          ),
          OutlinedButton.icon(
            key: const Key('legacy-opening-import'),
            onPressed: () => _openEditor(
              season,
              members,
              rankingRequest,
              'OPENING_BALANCE',
              members.map((member) => _ImportDraft.opening(member.id)).toList(),
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
    appBar: AppBar(
      title: Text(_detailed ? '기존 경기 직접 입력' : '현재 포인트 입력'),
      actions: <Widget>[
        TextButton(onPressed: _submit, child: const Text('미리보기')),
      ],
    ),
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
