import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_season_date_field.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/features/records/application/records_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubTeamSettingsScreen extends ConsumerStatefulWidget {
  const ClubTeamSettingsScreen({
    required this.teamId,
    this.seasonId,
    super.key,
  });
  final String teamId;
  final String? seasonId;
  @override
  ConsumerState<ClubTeamSettingsScreen> createState() =>
      _ClubTeamSettingsScreenState();
}

class _ClubTeamSettingsScreenState
    extends ConsumerState<ClubTeamSettingsScreen> {
  final _description = TextEditingController();
  final _notice = TextEditingController();
  final _seasonName = TextEditingController();
  final _start = TextEditingController();
  final _end = TextEditingController();
  List<int> _individualPoints = <int>[];
  List<int> _teamPoints = <int>[];
  List<int> _eventPoints = <int>[];
  bool _initialized = false;
  bool _ranking = false;
  bool _saving = false;
  String _mode = 'PODIUM';
  String _rankingMode = 'DATA';
  @override
  void dispose() {
    for (final c in <TextEditingController>[
      _description,
      _notice,
      _seasonName,
      _start,
      _end,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final request = (userId: user.id, teamId: widget.teamId);
    final provider = clubTeamProfileProvider(request);
    return ref
        .watch(provider)
        .when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(
            child: ClubErrorCard(
              message: clubErrorMessage(error),
              onRetry: () async {
                ref.invalidate(provider);
              },
            ),
          ),
          data: (ClubTeamProfile profile) {
            final selectedRequest = (
              userId: user.id,
              teamId: widget.teamId,
              seasonId: widget.seasonId,
              year: null as int?,
              competitionType: 'ALL',
            );
            final selectedValue = widget.seasonId == null
                ? null
                : ref.watch(clubSeasonRankingProvider(selectedRequest));
            if (selectedValue?.isLoading == true) {
              return const Center(child: CircularProgressIndicator());
            }
            if (selectedValue?.hasError == true) {
              return Center(
                child: ClubErrorCard(
                  message: clubErrorMessage(selectedValue!.error!),
                  onRetry: () async {
                    ref.invalidate(clubSeasonRankingProvider(selectedRequest));
                  },
                ),
              );
            }
            final managedSeason = widget.seasonId == null
                ? profile.activeSeason
                : selectedValue?.value?.season;
            if (widget.seasonId != null && managedSeason == null) {
              return const Center(child: Text('선택한 시즌을 찾을 수 없습니다.'));
            }
            if (!_initialized) {
              _description.text = profile.description ?? '';
              _notice.text = profile.notice ?? '';
              _ranking = profile.bowlerHiddenEnabled
                  ? true
                  : profile.seasonRankingEnabled;
              final season = managedSeason;
              if (season != null) {
                _seasonName.text = season.name;
                _start.text = _date(season.startDate);
                _end.text = _date(season.endDate);
                _mode = season.scoringMode;
                _rankingMode = season.rankingMode;
                _individualPoints = profile.bowlerHiddenEnabled
                    ? _formatPoints(season.individualPoints)
                    : <int>[...season.points];
                _teamPoints = _formatPoints(season.teamPoints);
                _eventPoints = _formatPoints(season.eventPoints);
              }
              _initialized = true;
            }
            final canManage =
                profile.myRole == ClubRole.owner ||
                profile.myRole == ClubRole.manager;
            return ListView(
              key: const Key('club-team-settings'),
              padding: const EdgeInsets.all(20),
              children: <Widget>[
                Row(
                  children: <Widget>[
                    IconButton(
                      onPressed: context.pop,
                      icon: const Icon(Icons.arrow_back_rounded),
                    ),
                    Text(widget.seasonId == null ? '팀 관리' : '시즌 관리'),
                  ],
                ),
                const SizedBox(height: 18),
                TextField(
                  controller: _description,
                  maxLength: 2000,
                  minLines: 3,
                  maxLines: 6,
                  decoration: const InputDecoration(labelText: '팀 소개'),
                ),
                TextField(
                  controller: _notice,
                  maxLength: 2000,
                  minLines: 2,
                  maxLines: 5,
                  decoration: const InputDecoration(labelText: '공지 사항'),
                ),
                if (canManage) ...<Widget>[
                  if (!profile.bowlerHiddenEnabled)
                    SwitchListTile(
                      title: const Text('시즌제 순위표 활성화'),
                      value: _ranking,
                      onChanged: (value) => setState(() => _ranking = value),
                    ),
                  if (_ranking) ...<Widget>[
                    Text(
                      '기본 정보',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    if (managedSeason != null)
                      Text(
                        '${managedSeason.name} · ${_seasonLifecycleLabel(managedSeason.lifecycleStatus)}',
                      ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _seasonName,
                      decoration: const InputDecoration(labelText: '시즌 이름'),
                    ),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: ClubSeasonDateField(
                            key: const Key('season-start-date'),
                            controller: _start,
                            label: '시작일',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: ClubSeasonDateField(
                            key: const Key('season-end-date'),
                            controller: _end,
                            label: '종료일',
                          ),
                        ),
                      ],
                    ),
                    if (profile.bowlerHiddenEnabled) ...<Widget>[
                      const SizedBox(height: 12),
                      Text(
                        '순위 관리 방식',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      RadioGroup<String>(
                        groupValue: _rankingMode,
                        onChanged: (value) {
                          if (value != null) {
                            _changeRankingMode(managedSeason, request, value);
                          }
                        },
                        child: const Column(
                          children: <Widget>[
                            RadioListTile<String>(
                              key: Key('ranking-mode-data'),
                              value: 'DATA',
                              title: Text('데이터로 관리'),
                              subtitle: Text('자동 경기 + 수동 입력을 함께 사용할 수 있습니다.'),
                            ),
                            RadioListTile<String>(
                              key: Key('ranking-mode-image'),
                              value: 'IMAGE',
                              title: Text('순위표 이미지로 관리'),
                              subtitle: Text('업로드한 순위표 이미지만 표시합니다.'),
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (!profile.bowlerHiddenEnabled)
                      DropdownButtonFormField<String>(
                        key: const Key('season-scoring-mode'),
                        initialValue: _mode,
                        items: const <DropdownMenuItem<String>>[
                          DropdownMenuItem(
                            value: 'PODIUM',
                            child: Text('입상 포인트'),
                          ),
                          DropdownMenuItem(
                            value: 'FULL_RANK',
                            child: Text('전체 순위 포인트'),
                          ),
                        ],
                        onChanged: (value) {
                          if (value != null) setState(() => _mode = value);
                        },
                        decoration: const InputDecoration(labelText: '점수 방식'),
                      ),
                    if (!profile.bowlerHiddenEnabled || _rankingMode == 'DATA')
                      _SeasonPointTableEditor(
                        key: Key(
                          profile.bowlerHiddenEnabled
                              ? 'season-individual-points'
                              : 'season-general-points',
                        ),
                        title: profile.bowlerHiddenEnabled
                            ? '개인전 시즌 순위 포인트'
                            : '시즌 순위 포인트',
                        points: _individualPoints,
                        onChanged: (value) =>
                            setState(() => _individualPoints = value),
                      ),
                    if (profile.bowlerHiddenEnabled &&
                        _rankingMode == 'DATA') ...<Widget>[
                      const SizedBox(height: 16),
                      Text(
                        '시즌 데이터',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      _SeasonPointTableEditor(
                        key: const Key('season-team-points'),
                        title: '팀전 시즌 순위 포인트',
                        points: _teamPoints,
                        onChanged: (value) =>
                            setState(() => _teamPoints = value),
                      ),
                      _SeasonPointTableEditor(
                        key: const Key('season-event-points'),
                        title: '이벤트전 시즌 순위 포인트',
                        points: _eventPoints,
                        onChanged: (value) =>
                            setState(() => _eventPoints = value),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        key: const Key('season-point-management-link'),
                        onPressed: managedSeason == null
                            ? null
                            : () => context.push(
                                '/club/${Uri.encodeComponent(widget.teamId)}/manage/team/season-points?seasonId=${Uri.encodeQueryComponent(managedSeason.id)}',
                              ),
                        icon: const Icon(Icons.tune),
                        label: const Text('포인트 관리'),
                      ),
                      OutlinedButton.icon(
                        key: const Key('season-legacy-import-link'),
                        onPressed: managedSeason == null
                            ? null
                            : () => context.push(
                                '/club/${Uri.encodeComponent(widget.teamId)}/manage/team/season-import?seasonId=${Uri.encodeQueryComponent(managedSeason.id)}',
                              ),
                        icon: const Icon(Icons.upload_file),
                        label: const Text('기존 시즌 데이터 가져오기'),
                      ),
                      OutlinedButton.icon(
                        key: const Key('season-manual-competition-add'),
                        onPressed: managedSeason == null
                            ? null
                            : () =>
                                  _addManualCompetition(managedSeason, request),
                        icon: const Icon(Icons.add_chart),
                        label: const Text('수동 대회 추가'),
                      ),
                      if (managedSeason != null)
                        _ManualCompetitionList(
                          request: (
                            userId: request.userId,
                            teamId: request.teamId,
                            seasonId: managedSeason.id,
                          ),
                          onEdit: (competition) => _editManualCompetition(
                            managedSeason,
                            request,
                            competition,
                          ),
                        ),
                      if (managedSeason != null) ...<Widget>[
                        const SizedBox(height: 8),
                        OutlinedButton.icon(
                          key: const Key('managed-season-ranking-link'),
                          onPressed: () => context.push(
                            '/club/${Uri.encodeComponent(widget.teamId)}/records/season?seasonId=${Uri.encodeQueryComponent(managedSeason.id)}',
                          ),
                          icon: const Icon(Icons.leaderboard_outlined),
                          label: const Text('현재 종합순위 및 최종순위 관리'),
                        ),
                      ],
                    ],
                    if (profile.bowlerHiddenEnabled &&
                        _rankingMode == 'IMAGE') ...<Widget>[
                      const SizedBox(height: 8),
                      _RankingImageManager(
                        teamId: widget.teamId,
                        season: managedSeason,
                        request: request,
                      ),
                    ],
                  ],
                ],
                const SizedBox(height: 18),
                FilledButton(
                  key: const Key('team-settings-save'),
                  onPressed: _saving
                      ? null
                      : () => _save(profile, managedSeason, request),
                  child: Text(_saving ? '저장 중...' : '저장'),
                ),
              ],
            );
          },
        );
  }

  Future<void> _changeRankingMode(
    ClubSeason? season,
    ClubExpansionRequest request,
    String next,
  ) async {
    if (next == _rankingMode) return;
    if (season == null) {
      setState(() => _rankingMode = next);
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('순위 관리 방식 변경'),
        content: Text(
          next == 'IMAGE'
              ? '현재 시즌에는 자동/수동 순위 데이터가 있을 수 있습니다. 이미지 관리 방식으로 변경하면 기존 데이터는 삭제되지 않지만 종합순위에서는 표시되지 않습니다.'
              : '현재 시즌에 등록된 순위표 이미지는 삭제되지 않습니다. 데이터 관리 방식으로 변경하면 종합순위에는 구조화된 데이터만 표시됩니다.',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          FilledButton(
            key: const Key('ranking-mode-confirm'),
            onPressed: () => Navigator.pop(context, true),
            child: Text(next == 'IMAGE' ? '이미지 방식으로 변경' : '데이터 방식으로 변경'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await ref
          .read(clubExpansionApiProvider)
          .updateSeasonRankingMode(
            widget.teamId,
            season.id,
            next,
            confirmed: true,
          );
      if (!mounted) return;
      setState(() => _rankingMode = next);
      ref.invalidate(clubTeamProfileProvider(request));
      ref.invalidate(clubSeasonRankingProvider);
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
      }
    }
  }

  Future<void> _addManualCompetition(
    ClubSeason season,
    ClubExpansionRequest request,
  ) async {
    try {
      final ranking = await ref.read(
        clubSeasonRankingProvider((
          userId: request.userId,
          teamId: request.teamId,
          seasonId: season.id,
          year: null,
          competitionType: 'ALL',
        )).future,
      );
      if (!mounted) return;
      final body = await showModalBottomSheet<Map<String, Object>>(
        context: context,
        isScrollControlled: true,
        builder: (_) =>
            _ManualCompetitionEditor(members: ranking.rows, season: season),
      );
      if (body == null) return;
      await ref
          .read(clubExpansionApiProvider)
          .createManualCompetition(widget.teamId, season.id, body);
      ref.invalidate(clubSeasonRankingProvider);
      ref.invalidate(clubSeasonManualCompetitionsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('수동 대회를 저장했습니다.')));
      }
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
      }
    }
  }

  Future<void> _editManualCompetition(
    ClubSeason season,
    ClubExpansionRequest request,
    ClubSeasonManualCompetition competition,
  ) async {
    try {
      final ranking = await ref.read(
        clubSeasonRankingProvider((
          userId: request.userId,
          teamId: request.teamId,
          seasonId: season.id,
          year: null,
          competitionType: 'ALL',
        )).future,
      );
      if (!mounted) return;
      final body = await showModalBottomSheet<Map<String, Object>>(
        context: context,
        isScrollControlled: true,
        builder: (_) => _ManualCompetitionEditor(
          members: ranking.rows,
          season: season,
          initial: competition,
        ),
      );
      if (body == null) return;
      await ref
          .read(clubExpansionApiProvider)
          .updateManualCompetition(
            widget.teamId,
            season.id,
            competition.id,
            body,
          );
      ref.invalidate(clubSeasonRankingProvider);
      ref.invalidate(clubSeasonManualCompetitionsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('수동 대회를 수정했습니다.')));
      }
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
      }
    }
  }

  Future<void> _save(
    ClubTeamProfile profile,
    ClubSeason? managedSeason,
    ClubExpansionRequest request,
  ) async {
    setState(() => _saving = true);
    try {
      final body = <String, dynamic>{
        'description': _description.text.trim(),
        'notice': _notice.text.trim(),
      };
      if (profile.myRole == ClubRole.owner ||
          profile.myRole == ClubRole.manager) {
        body['seasonRankingEnabled'] = profile.bowlerHiddenEnabled
            ? true
            : _ranking;
        if (_ranking) {
          body['season'] = <String, dynamic>{
            if (managedSeason != null) 'id': managedSeason.id,
            'name': _seasonName.text.trim(),
            'startDate': _start.text.trim(),
            'endDate': _end.text.trim(),
            'scoringMode': _mode,
            'rankingMode': _rankingMode,
            if (profile.bowlerHiddenEnabled)
              'pointTables': <String, Object>{
                'individual': _pointRows(_individualPoints),
                'team': _pointRows(_teamPoints),
                'event': _pointRows(_eventPoints),
              }
            else
              'points': _individualPoints,
          };
        }
      }
      await ref
          .read(clubExpansionApiProvider)
          .updateProfile(widget.teamId, body);
      ref.invalidate(clubTeamProfileProvider(request));
      ref.invalidate(clubSeasonRankingProvider);
      ref.invalidate(dashboardProvider(request.userId));
      ref.invalidate(recordsControllerProvider(request.userId));
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('팀과 시즌 설정을 저장했습니다.')));
        context.pop();
      }
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

String _date(DateTime value) => formatClubDate(value);

String _seasonLifecycleLabel(String value) => switch (value) {
  'UPCOMING' => '예정',
  'ENDED' => '종료',
  _ => '진행 중',
};

List<int> _formatPoints(List<ClubSeasonRankPoint> points) =>
    points.map((item) => item.points).toList();

List<Map<String, int>> _pointRows(List<int> points) =>
    List<Map<String, int>>.generate(
      points.length,
      (int index) => <String, int>{'rank': index + 1, 'points': points[index]},
    );

class _ManualCompetitionList extends ConsumerWidget {
  const _ManualCompetitionList({required this.request, required this.onEdit});
  final ClubSeasonManagementRequest request;
  final ValueChanged<ClubSeasonManualCompetition> onEdit;

  @override
  Widget build(BuildContext context, WidgetRef ref) => ref
      .watch(clubSeasonManualCompetitionsProvider(request))
      .when(
        loading: () => const Padding(
          padding: EdgeInsets.all(12),
          child: Center(child: CircularProgressIndicator()),
        ),
        error: (error, _) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(clubErrorMessage(error)),
        ),
        data: (competitions) {
          if (competitions.isEmpty) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text('등록된 수동 대회가 없습니다.'),
            );
          }
          return Card(
            child: Column(
              children: competitions
                  .map(
                    (competition) => ListTile(
                      key: Key('manual-competition-${competition.id}'),
                      title: Text(competition.name),
                      subtitle: Text(
                        '${_date(competition.eventDate)} · ${_competitionTypeLabel(competition.competitionType)} · ${competition.results.length}명',
                      ),
                      trailing: const Icon(Icons.edit_outlined),
                      onTap: () => onEdit(competition),
                    ),
                  )
                  .toList(growable: false),
            ),
          );
        },
      );
}

String _competitionTypeLabel(String value) => switch (value) {
  'TEAM' => '팀전',
  'EVENT' => '이벤트전',
  _ => '개인전',
};

class _SeasonPointTableEditor extends StatelessWidget {
  const _SeasonPointTableEditor({
    super.key,
    required this.title,
    required this.points,
    required this.onChanged,
  });

  final String title;
  final List<int> points;
  final ValueChanged<List<int>> onChanged;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
          for (int index = 0; index < points.length; index++)
            Row(
              children: <Widget>[
                SizedBox(width: 54, child: Text('${index + 1}위')),
                Expanded(
                  child: TextFormField(
                    key: ValueKey<String>('$title-${index + 1}'),
                    initialValue: '${points[index]}',
                    keyboardType: TextInputType.number,
                    inputFormatters: <TextInputFormatter>[
                      FilteringTextInputFormatter.digitsOnly,
                    ],
                    decoration: const InputDecoration(labelText: '포인트'),
                    onChanged: (String value) {
                      final int? point = int.tryParse(value);
                      if (point == null || point < 0 || point > 1000) return;
                      final next = <int>[...points]..[index] = point;
                      onChanged(next);
                    },
                  ),
                ),
                IconButton(
                  tooltip: '순위 삭제',
                  onPressed: points.length <= 1
                      ? null
                      : () => onChanged(<int>[...points]..removeAt(index)),
                  icon: const Icon(Icons.remove_circle_outline),
                ),
              ],
            ),
          TextButton.icon(
            onPressed: points.length >= 100
                ? null
                : () => onChanged(<int>[...points, 0]),
            icon: const Icon(Icons.add),
            label: const Text('순위 추가'),
          ),
        ],
      ),
    ),
  );
}

class _ManualCompetitionEditor extends StatefulWidget {
  const _ManualCompetitionEditor({
    required this.members,
    required this.season,
    this.initial,
  });
  final List<ClubSeasonRankingRow> members;
  final ClubSeason season;
  final ClubSeasonManualCompetition? initial;

  @override
  State<_ManualCompetitionEditor> createState() =>
      _ManualCompetitionEditorState();
}

class _ManualCompetitionEditorState extends State<_ManualCompetitionEditor> {
  final _name = TextEditingController();
  final _date = TextEditingController();
  final Map<String, TextEditingController> _ranks =
      <String, TextEditingController>{};
  final Map<String, TextEditingController> _points =
      <String, TextEditingController>{};
  String _type = 'INDIVIDUAL';
  String? _error;

  @override
  void initState() {
    super.initState();
    final initial = widget.initial;
    if (initial != null) {
      _name.text = initial.name;
      _date.text =
          '${initial.eventDate.year}-${initial.eventDate.month.toString().padLeft(2, '0')}-${initial.eventDate.day.toString().padLeft(2, '0')}';
      _type = initial.competitionType;
    }
    for (final member in widget.members) {
      ClubSeasonManualResult? result;
      for (final item in initial?.results ?? const <ClubSeasonManualResult>[]) {
        if (item.memberId == member.id) {
          result = item;
          break;
        }
      }
      _ranks[member.id] = TextEditingController(
        text: result?.finalRank?.toString() ?? '',
      );
      _points[member.id] = TextEditingController(
        text: result?.points.toString() ?? '',
      );
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _date.dispose();
    for (final controller in <TextEditingController>[
      ..._ranks.values,
      ..._points.values,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        20,
        20,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * .78,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              widget.initial == null ? '수동 대회 추가' : '수동 대회 수정',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            TextField(
              key: const Key('manual-competition-name'),
              controller: _name,
              maxLength: 100,
              decoration: const InputDecoration(labelText: '대회명'),
            ),
            TextField(
              key: const Key('manual-competition-date'),
              controller: _date,
              decoration: const InputDecoration(labelText: '날짜 YYYY-MM-DD'),
            ),
            DropdownButtonFormField<String>(
              key: const Key('manual-competition-type'),
              initialValue: _type,
              items: const <DropdownMenuItem<String>>[
                DropdownMenuItem(value: 'INDIVIDUAL', child: Text('개인전')),
                DropdownMenuItem(value: 'TEAM', child: Text('팀전')),
                DropdownMenuItem(value: 'EVENT', child: Text('이벤트전')),
              ],
              onChanged: (value) => setState(() => _type = value ?? _type),
              decoration: const InputDecoration(labelText: '대회 유형'),
            ),
            const SizedBox(height: 12),
            const Text('회원 결과', style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Expanded(
              child: ListView(
                children: widget.members
                    .map(
                      (member) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Row(
                          children: <Widget>[
                            Expanded(
                              flex: 3,
                              child: Text(
                                member.name,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextField(
                                key: Key('manual-rank-${member.id}'),
                                controller: _ranks[member.id],
                                keyboardType: TextInputType.number,
                                inputFormatters: <TextInputFormatter>[
                                  FilteringTextInputFormatter.digitsOnly,
                                ],
                                decoration: const InputDecoration(
                                  labelText: '순위',
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextField(
                                key: Key('manual-points-${member.id}'),
                                controller: _points[member.id],
                                keyboardType: TextInputType.number,
                                inputFormatters: <TextInputFormatter>[
                                  FilteringTextInputFormatter.digitsOnly,
                                ],
                                decoration: const InputDecoration(
                                  labelText: 'P',
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                    .toList(growable: false),
              ),
            ),
            if (_error != null)
              Text(_error!, style: const TextStyle(color: Colors.redAccent)),
            const SizedBox(height: 8),
            FilledButton(
              key: const Key('manual-competition-save'),
              onPressed: _submit,
              child: const Text('저장'),
            ),
          ],
        ),
      ),
    ),
  );

  void _submit() {
    final date = DateTime.tryParse(_date.text.trim());
    final results = <Map<String, Object?>>[];
    for (final member in widget.members) {
      final rankText = _ranks[member.id]!.text.trim();
      final pointsText = _points[member.id]!.text.trim();
      if (rankText.isEmpty && pointsText.isEmpty) continue;
      final rank = rankText.isEmpty ? null : int.tryParse(rankText);
      final points = int.tryParse(pointsText);
      if ((rankText.isNotEmpty && rank == null) || points == null) {
        setState(() => _error = '입력한 순위와 포인트를 확인해주세요.');
        return;
      }
      results.add(<String, Object?>{
        'memberId': member.id,
        'finalRank': rank,
        'points': points,
      });
    }
    if (_name.text.trim().isEmpty ||
        date == null ||
        date.isBefore(widget.season.startDate) ||
        date.isAfter(widget.season.endDate) ||
        results.isEmpty) {
      setState(() => _error = '대회명, 시즌 내 날짜와 한 명 이상의 결과를 입력해주세요.');
      return;
    }
    Navigator.pop(context, <String, Object>{
      'name': _name.text.trim(),
      'eventDate': _date.text.trim(),
      'competitionType': _type,
      'results': results,
    });
  }
}

class _RankingImageManager extends ConsumerStatefulWidget {
  const _RankingImageManager({
    required this.teamId,
    required this.season,
    required this.request,
  });
  final String teamId;
  final ClubSeason? season;
  final ClubExpansionRequest request;

  @override
  ConsumerState<_RankingImageManager> createState() =>
      _RankingImageManagerState();
}

class _RankingImageManagerState extends ConsumerState<_RankingImageManager> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final season = widget.season;
    if (season == null) return const Text('시즌을 먼저 저장해주세요.');
    final rankingRequest = (
      userId: widget.request.userId,
      teamId: widget.teamId,
      seasonId: season.id,
      year: null as int?,
      competitionType: 'ALL',
    );
    final ranking = ref.watch(clubSeasonRankingProvider(rankingRequest));
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            const Text(
              '시즌 순위표 이미지',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            ranking.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => Text(clubErrorMessage(error)),
              data: (data) => Column(
                children: data.rankingImages
                    .map(
                      (image) => ListTile(
                        key: Key('ranking-image-${image.id}'),
                        leading: _RankingImageThumbnail(
                          request: (
                            userId: widget.request.userId,
                            teamId: widget.teamId,
                            seasonId: season.id,
                            imageId: image.id,
                          ),
                        ),
                        title: Text('순위표 ${image.displayOrder + 1}'),
                        subtitle: Text('${(image.size / 1024).ceil()}KB'),
                        onTap: () => _showImage(season.id, image.id),
                        trailing: IconButton(
                          tooltip: '삭제',
                          onPressed: _busy
                              ? null
                              : () => _delete(
                                  rankingRequest,
                                  season.id,
                                  image.id,
                                ),
                          icon: const Icon(Icons.delete_outline),
                        ),
                      ),
                    )
                    .toList(growable: false),
              ),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              key: const Key('ranking-image-upload'),
              onPressed: _busy
                  ? null
                  : () => _upload(rankingRequest, season.id),
              icon: const Icon(Icons.add_photo_alternate_outlined),
              label: Text(_busy ? '처리 중...' : '순위표 이미지 추가'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _upload(
    ClubSeasonRankingRequest request,
    String seasonId,
  ) async {
    final images = await ref.read(clubPostImagePickerProvider).pickImages();
    if (images.isEmpty || !mounted) return;
    if (images.any((image) => image.bytes.lengthInBytes > 5 * 1024 * 1024)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('순위표 이미지는 파일당 5MB 이하여야 합니다.')),
      );
      return;
    }
    setState(() => _busy = true);
    try {
      for (final image in images) {
        await ref
            .read(clubExpansionApiProvider)
            .uploadRankingImage(widget.teamId, seasonId, image);
      }
      ref.invalidate(clubSeasonRankingProvider(request));
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('순위표 이미지를 등록했습니다.')));
      }
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete(
    ClubSeasonRankingRequest request,
    String seasonId,
    String imageId,
  ) async {
    setState(() => _busy = true);
    try {
      await ref
          .read(clubExpansionApiProvider)
          .deleteRankingImage(widget.teamId, seasonId, imageId);
      ref.invalidate(clubSeasonRankingProvider(request));
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _showImage(String seasonId, String imageId) async {
    try {
      final bytes = await ref.read(
        clubRankingImageProvider((
          userId: widget.request.userId,
          teamId: widget.teamId,
          seasonId: seasonId,
          imageId: imageId,
        )).future,
      );
      if (!mounted) return;
      await showDialog<void>(
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
      );
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
      }
    }
  }
}

class _RankingImageThumbnail extends ConsumerWidget {
  const _RankingImageThumbnail({required this.request});

  final ClubRankingImageRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final image = ref.watch(clubRankingImageProvider(request));
    return SizedBox(
      width: 52,
      height: 52,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: image.when(
          loading: () => const ColoredBox(
            color: Color(0x11000000),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
          error: (_, _) => const ColoredBox(
            color: Color(0x11000000),
            child: Icon(Icons.broken_image_outlined),
          ),
          data: (bytes) => Image.memory(bytes, fit: BoxFit.cover),
        ),
      ),
    );
  }
}
