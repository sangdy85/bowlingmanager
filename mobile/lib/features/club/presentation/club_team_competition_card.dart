import 'dart:async';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_team_competition_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ClubTeamCompetitionCard extends ConsumerStatefulWidget {
  const ClubTeamCompetitionCard({
    required this.userId,
    required this.teamId,
    required this.eventId,
    required this.competitionMode,
    super.key,
  });

  final String userId;
  final String teamId;
  final String eventId;
  final ClubCompetitionMode? competitionMode;

  @override
  ConsumerState<ClubTeamCompetitionCard> createState() =>
      _ClubTeamCompetitionCardState();
}

class _ClubTeamCompetitionCardState
    extends ConsumerState<ClubTeamCompetitionCard>
    with WidgetsBindingObserver {
  Timer? _pollTimer;
  bool _shouldPoll = false;
  bool _working = false;

  ClubEventRequest get _request =>
      (userId: widget.userId, teamId: widget.teamId, eventId: widget.eventId);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _syncPolling(_shouldPoll);
    } else {
      _pollTimer?.cancel();
      _pollTimer = null;
    }
  }

  void _syncPolling(bool enabled) {
    _shouldPoll = enabled;
    if (!enabled) {
      _pollTimer?.cancel();
      _pollTimer = null;
      return;
    }
    if (_pollTimer != null) return;
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (mounted) ref.invalidate(clubTeamCompetitionProvider(_request));
    });
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<ClubTeamCompetitionState> state = ref.watch(
      clubTeamCompetitionProvider(_request),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _syncPolling(state.value?.polling == true);
    });
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: state.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (Object error, StackTrace _) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(clubErrorMessage(error)),
              TextButton(
                onPressed: () =>
                    ref.invalidate(clubTeamCompetitionProvider(_request)),
                child: const Text('다시 시도'),
              ),
            ],
          ),
          data: _content,
        ),
      ),
    );
  }

  Widget _content(ClubTeamCompetitionState state) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: <Widget>[
      Row(
        children: <Widget>[
          const Expanded(
            child: Text(
              'Bowler Hidden · 팀전',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
          Chip(label: Text(widget.competitionMode?.label ?? '모드 미설정')),
        ],
      ),
      if (widget.competitionMode == ClubCompetitionMode.mini)
        const Text('미니 경기 · 시즌 포인트 미지급'),
      const SizedBox(height: 6),
      Text('진행 단계: ${_statusLabel(state.status)} · ${state.generation}차'),
      if (state.currentTurn case final ClubDraftTurn turn) ...<Widget>[
        const SizedBox(height: 8),
        Text(
          '${turn.roundNumber}라운드 · ${turn.pickNumber}번 선택',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        Text('${turn.captainName} 팀장이 선택 중입니다.'),
      ],
      if (state.canManage) ...<Widget>[
        const SizedBox(height: 12),
        _managerActions(state),
      ],
      if (state.isCurrentCaptain &&
          state.remainingParticipants.isNotEmpty) ...<Widget>[
        const Divider(height: 28),
        const Text('내 차례입니다.', style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: state.remainingParticipants
              .map(
                (participant) => ActionChip(
                  label: Text('${participant.name} 선택'),
                  onPressed: _working
                      ? null
                      : () => _run(<String, dynamic>{
                          'action': 'PICK',
                          'memberId': participant.memberId,
                        }),
                ),
              )
              .toList(),
        ),
      ],
      if (state.teams.isNotEmpty) ...<Widget>[
        const Divider(height: 28),
        ...state.teams.map((team) => _teamTile(team, state.canManage)),
      ],
      if (state.history.isNotEmpty) ...<Widget>[
        const Divider(height: 28),
        const Text('드래프트 기록', style: TextStyle(fontWeight: FontWeight.w700)),
        ...state.history.map(
          (item) => ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            leading: CircleAvatar(
              radius: 15,
              child: Text('${item.pickNumber}'),
            ),
            title: Text(
              item.automatic
                  ? '자동 배정 → ${item.selectedDisplayName} → ${item.teamName}'
                  : '${item.teamName} → ${item.selectedDisplayName} 선택',
            ),
            subtitle: item.roundNumber > 0
                ? Text('${item.roundNumber}라운드')
                : null,
          ),
        ),
      ],
      if (state.results.teams.isNotEmpty) ...<Widget>[
        const Divider(height: 28),
        ..._resultWidgets(state),
      ],
    ],
  );

  List<Widget> _resultWidgets(ClubTeamCompetitionState state) {
    final results = state.results;
    return <Widget>[
      const Text('팀 결과', style: TextStyle(fontWeight: FontWeight.w700)),
      if (!results.complete) const Text('일부 경기 점수가 없어 순위를 확정하지 않았습니다.'),
      if (results.effectivePlayerCount != null)
        Text('게임별 유효 인원 ${results.effectivePlayerCount}명'),
      ...results.teams.expand((summary) {
        final individuals = results.individual
            .where((row) => row.competitionTeamId == summary.competitionTeamId)
            .toList();
        final int gameCount = individuals.fold<int>(
          0,
          (count, row) => row.scores.length > count ? row.scores.length : count,
        );
        final gameRows = results.games
            .map(
              (game) => (
                game: game.gameNumber,
                result: game.teams
                    .where(
                      (item) =>
                          item.competitionTeamId == summary.competitionTeamId,
                    )
                    .firstOrNull,
              ),
            )
            .where((item) => item.result != null)
            .toList();
        return <Widget>[
          const SizedBox(height: 10),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: CircleAvatar(
              child: Text(summary.finalRank?.toString() ?? '-'),
            ),
            title: Text(summary.name),
            subtitle: Text(
              'Raw ${summary.rawPins} · Effective ${summary.effectivePins} · '
              '핸디 ${summary.teamHandicap} · 적용 ${summary.appliedPins}',
            ),
            trailing: Text(
              '게임 ${summary.totalPoints}P'
              '${widget.competitionMode == ClubCompetitionMode.mini
                  ? '\n시즌 포인트 미지급'
                  : summary.seasonPoint == null
                  ? ''
                  : '\n시즌 +${summary.seasonPoint}P'}',
              textAlign: TextAlign.end,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
          if (individuals.isNotEmpty)
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                columns: <DataColumn>[
                  const DataColumn(label: Text('순위')),
                  const DataColumn(label: Text('성명')),
                  for (int index = 1; index <= gameCount; index++)
                    DataColumn(label: Text('${index}G'), numeric: true),
                  const DataColumn(label: Text('총점'), numeric: true),
                  const DataColumn(label: Text('AVG'), numeric: true),
                ],
                rows: individuals
                    .map(
                      (row) => DataRow(
                        cells: <DataCell>[
                          DataCell(Text('${row.rank}')),
                          DataCell(Text(row.name)),
                          for (int index = 0; index < gameCount; index++)
                            DataCell(
                              Text(
                                index < row.scores.length
                                    ? '${row.scores[index]}'
                                    : '-',
                              ),
                            ),
                          DataCell(Text('${row.total}')),
                          DataCell(
                            Text(row.average?.toStringAsFixed(1) ?? '-'),
                          ),
                        ],
                      ),
                    )
                    .toList(),
              ),
            ),
          ...gameRows.map((row) {
            final game = row.result!;
            final String excluded = game.excludedScores.isEmpty
                ? ''
                : ' · 제외 ${game.excludedScores.join(', ')}';
            return Text(
              '${row.game}G · Raw ${game.rawTeamTotal ?? '-'} · '
              'Effective ${game.normalizedTeamTotal ?? '-'} · '
              '핸디 ${game.teamHandicap ?? '-'} · 적용 ${game.handicapAppliedTotal ?? '-'}'
              '$excluded · '
              '${game.rank == null ? '미확정' : '${game.rank}위 / ${game.points}P'}',
            );
          }),
        ];
      }),
    ];
  }

  Widget _managerActions(ClubTeamCompetitionState state) {
    final List<Widget> actions = <Widget>[];
    switch (state.status) {
      case 'ATTENDANCE_OPEN':
        actions.add(
          FilledButton(
            onPressed: _working
                ? null
                : () => _run(<String, dynamic>{'action': 'LOCK_ATTENDANCE'}),
            child: const Text('참석 마감'),
          ),
        );
      case 'ATTENDANCE_LOCKED':
        actions.add(
          FilledButton(
            onPressed: _working ? null : () => _configureCaptains(state),
            child: const Text('팀장과 드래프트 순서 지정'),
          ),
        );
      case 'DRAFT_READY':
        actions.add(
          FilledButton(
            onPressed: _working
                ? null
                : () => _run(<String, dynamic>{'action': 'START_DRAFT'}),
            child: const Text('드래프트 시작'),
          ),
        );
      case 'TEAMS_FINALIZED':
        actions.add(
          FilledButton(
            onPressed: _working ? null : () => _assignLanes(state),
            child: const Text('팀별 레인 배정'),
          ),
        );
      case 'LANES_ASSIGNED':
        actions.add(
          FilledButton(
            onPressed: _working ? null : _publish,
            child: const Text('최종 TEAM 결과 발표'),
          ),
        );
      case 'PUBLISHED':
        actions.add(
          OutlinedButton(
            onPressed: _working
                ? null
                : () => _run(<String, dynamic>{'action': 'REOPEN'}),
            child: const Text('발표 결과 다시 열기'),
          ),
        );
    }
    if (state.status != 'ATTENDANCE_OPEN' &&
        state.status != 'ATTENDANCE_LOCKED') {
      actions.add(
        OutlinedButton(
          onPressed: _working ? null : _confirmReset,
          child: const Text('드래프트 초기화'),
        ),
      );
    }
    return Wrap(spacing: 8, runSpacing: 8, children: actions);
  }

  Widget _teamTile(ClubCompetitionTeam team, bool canManage) {
    final bool mine =
        team.id ==
        ref.read(clubTeamCompetitionProvider(_request)).value?.myTeam;
    return ExpansionTile(
      initiallyExpanded: mine,
      tilePadding: EdgeInsets.zero,
      title: Text(mine ? '${team.name} · 내 팀' : team.name),
      subtitle: Text(
        '팀장 ${team.captainName} · 핸디 ${team.teamHandicap}'
        '${team.lanePriority == null ? '' : ' · 레인 우선 ${team.lanePriority}'}',
      ),
      trailing: canManage
          ? IconButton(
              tooltip: '팀 핸디캡 수정',
              onPressed: _working ? null : () => _editHandicap(team),
              icon: const Icon(Icons.edit_outlined),
            )
          : null,
      children: team.members
          .map(
            (member) => ListTile(
              dense: true,
              title: Text(member.name),
              trailing: Text(member.laneSlot ?? '-'),
            ),
          )
          .toList(),
    );
  }

  Future<void> _configureCaptains(ClubTeamCompetitionState state) async {
    final List<String> selected = <String>[];
    final List<String>? memberIds = await showDialog<List<String>>(
      context: context,
      builder: (BuildContext context) => StatefulBuilder(
        builder: (BuildContext context, StateSetter setDialogState) =>
            AlertDialog(
              title: const Text('팀장과 순서 지정'),
              content: SizedBox(
                width: 420,
                child: ListView(
                  shrinkWrap: true,
                  children: state.remainingParticipants.map((participant) {
                    final int order = selected.indexOf(participant.memberId);
                    return CheckboxListTile(
                      value: order >= 0,
                      title: Text(participant.name),
                      subtitle: order >= 0
                          ? Text('드래프트 순서 ${order + 1}')
                          : null,
                      onChanged: (bool? checked) => setDialogState(() {
                        if (checked == true) {
                          selected.add(participant.memberId);
                        } else {
                          selected.remove(participant.memberId);
                        }
                      }),
                    );
                  }).toList(),
                ),
              ),
              actions: <Widget>[
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('취소'),
                ),
                FilledButton(
                  onPressed: selected.length < 2
                      ? null
                      : () =>
                            Navigator.pop(context, List<String>.from(selected)),
                  child: const Text('확정'),
                ),
              ],
            ),
      ),
    );
    if (memberIds == null) return;
    await _run(<String, dynamic>{
      'action': 'CONFIGURE_CAPTAINS',
      'captains': <Map<String, dynamic>>[
        for (int index = 0; index < memberIds.length; index++)
          <String, dynamic>{
            'memberId': memberIds[index],
            'draftOrder': index + 1,
          },
      ],
    });
  }

  Future<void> _assignLanes(ClubTeamCompetitionState state) async {
    final List<ClubCompetitionTeam> teams =
        List<ClubCompetitionTeam>.from(state.teams)..sort(
          (a, b) => (a.lanePriority ?? a.draftOrder).compareTo(
            b.lanePriority ?? b.draftOrder,
          ),
        );
    final Map<String, List<ClubTeamCompetitionParticipant>> members =
        <String, List<ClubTeamCompetitionParticipant>>{
          for (final team in teams)
            team.id: List<ClubTeamCompetitionParticipant>.from(team.members),
        };
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => StatefulBuilder(
        builder: (BuildContext context, StateSetter setDialogState) =>
            AlertDialog(
              title: const Text('팀별 레인 배정'),
              content: SizedBox(
                width: 460,
                height: 520,
                child: ListView.builder(
                  itemCount: teams.length,
                  itemBuilder: (BuildContext context, int teamIndex) {
                    final team = teams[teamIndex];
                    final teamMembers = members[team.id]!;
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Row(
                              children: <Widget>[
                                Expanded(
                                  child: Text('${teamIndex + 1}. ${team.name}'),
                                ),
                                IconButton(
                                  onPressed: teamIndex == 0
                                      ? null
                                      : () => setDialogState(() {
                                          final moved = teams.removeAt(
                                            teamIndex,
                                          );
                                          teams.insert(teamIndex - 1, moved);
                                        }),
                                  icon: const Icon(Icons.arrow_upward),
                                ),
                                IconButton(
                                  onPressed: teamIndex == teams.length - 1
                                      ? null
                                      : () => setDialogState(() {
                                          final moved = teams.removeAt(
                                            teamIndex,
                                          );
                                          teams.insert(teamIndex + 1, moved);
                                        }),
                                  icon: const Icon(Icons.arrow_downward),
                                ),
                              ],
                            ),
                            ...List<Widget>.generate(teamMembers.length, (
                              index,
                            ) {
                              final member = teamMembers[index];
                              return Row(
                                children: <Widget>[
                                  Expanded(
                                    child: Text('${index + 1}. ${member.name}'),
                                  ),
                                  IconButton(
                                    onPressed: index == 0
                                        ? null
                                        : () => setDialogState(() {
                                            final moved = teamMembers.removeAt(
                                              index,
                                            );
                                            teamMembers.insert(
                                              index - 1,
                                              moved,
                                            );
                                          }),
                                    icon: const Icon(Icons.keyboard_arrow_up),
                                  ),
                                  IconButton(
                                    onPressed: index == teamMembers.length - 1
                                        ? null
                                        : () => setDialogState(() {
                                            final moved = teamMembers.removeAt(
                                              index,
                                            );
                                            teamMembers.insert(
                                              index + 1,
                                              moved,
                                            );
                                          }),
                                    icon: const Icon(Icons.keyboard_arrow_down),
                                  ),
                                ],
                              );
                            }),
                          ],
                        ),
                      ),
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
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('이 순서로 배정'),
                ),
              ],
            ),
      ),
    );
    if (confirmed != true) return;
    await _run(<String, dynamic>{
      'action': 'ASSIGN_LANES',
      'teams': <Map<String, dynamic>>[
        for (int index = 0; index < teams.length; index++)
          <String, dynamic>{
            'competitionTeamId': teams[index].id,
            'lanePriority': index + 1,
            'memberIds': members[teams[index].id]!
                .map((member) => member.memberId)
                .toList(),
          },
      ],
    });
  }

  Future<void> _confirmReset() async {
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('드래프트 초기화'),
        content: const Text(
          '현재 팀과 레인 배정을 초기화할까요? 이전 드래프트 기록은 세대별 감사 기록으로 보존됩니다.',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('초기화'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await _run(<String, dynamic>{'action': 'RESET'});
    }
  }

  Future<void> _publish() async {
    await _run(<String, dynamic>{'action': 'PUBLISH'});
  }

  Future<void> _editHandicap(ClubCompetitionTeam team) async {
    final controller = TextEditingController(text: '${team.teamHandicap}');
    final int? value = await showDialog<int>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: Text('${team.name} 핸디캡'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: '0 이상의 정수'),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () {
              final int? parsed = int.tryParse(controller.text.trim());
              if (parsed != null && parsed >= 0) Navigator.pop(context, parsed);
            },
            child: const Text('저장'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (value == null) return;
    await _run(<String, dynamic>{
      'action': 'SET_HANDICAP',
      'competitionTeamId': team.id,
      'teamHandicap': value,
    });
  }

  Future<void> _run(Map<String, dynamic> action) async {
    setState(() => _working = true);
    try {
      await ref
          .read(clubEventsRepositoryProvider)
          .teamCompetitionAction(widget.teamId, widget.eventId, action);
      if (mounted) {
        invalidateClubEvents(ref, widget.userId, widget.teamId, widget.eventId);
        ref.invalidate(clubSeasonRankingProvider);
      }
    } on Object catch (error) {
      if (mounted) {
        final message = error is ApiException
            ? error.userMessage
            : clubErrorMessage(error);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(message)));
      }
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }
}

String _statusLabel(String status) => switch (status) {
  'ATTENDANCE_OPEN' => '참석 조사',
  'ATTENDANCE_LOCKED' => '참석 마감',
  'DRAFT_READY' => '드래프트 준비',
  'DRAFT_IN_PROGRESS' => '드래프트 진행',
  'TEAMS_FINALIZED' => '팀 확정',
  'LANES_ASSIGNED' => '레인 배정 완료',
  'PUBLISHED' => '결과 발표',
  _ => status,
};
