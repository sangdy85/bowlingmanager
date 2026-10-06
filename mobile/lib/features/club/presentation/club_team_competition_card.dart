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
    this.attendance = const <ClubEventAttendanceItem>[],
    super.key,
  });

  final String userId;
  final String teamId;
  final String eventId;
  final ClubCompetitionMode? competitionMode;
  final List<ClubEventAttendanceItem> attendance;

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
      key: const Key('team-competition-card'),
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
      if (const <String>{
        'TEAMS_FINALIZED',
        'LANES_ASSIGNED',
      }.contains(state.status)) ...<Widget>[
        const SizedBox(height: 8),
        Text(
          state.laneSlots.isEmpty
              ? '사용 레인/자리가 설정되지 않았습니다.'
              : '사용 자리: ${state.laneSlots.length}개 · 레인 ${state.laneNumbers.join(', ')}',
          key: const Key('team-lane-pool-summary'),
        ),
      ],
      if (state.isCurrentCaptain &&
          state.remainingParticipants.isNotEmpty) ...<Widget>[
        const Divider(height: 28),
        const Text('내 차례입니다.', style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        if (state.status == 'LUCKY_DRAW') ...<Widget>[
          Text(
            '남은 참가자: ${state.remainingParticipants.map((participant) => participant.name).join(', ')}',
          ),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: _working
                ? null
                : () => _run(const <String, dynamic>{'action': 'LUCKY_DRAW'}),
            icon: const Icon(Icons.casino_outlined),
            label: const Text('행운권 뽑기'),
          ),
        ] else
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
                            'participantId': participant.participantId,
                          }),
                  ),
                )
                .toList(),
          ),
      ],
      if (state.teams.isNotEmpty) ...<Widget>[
        const Divider(height: 28),
        ...state.teams.map(_teamTile),
      ],
      if (state.history.isNotEmpty) ...<Widget>[
        const Divider(height: 28),
        ExpansionTile(
          key: const Key('team-draft-history'),
          tilePadding: EdgeInsets.zero,
          initiallyExpanded: false,
          title: const Text(
            '드래프트 기록',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          children: state.history
              .map(
                (item) => ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                    radius: 15,
                    child: Text('${item.pickNumber}'),
                  ),
                  title: Text(
                    item.pickType == 'LUCKY_DRAW_MISS'
                        ? '${item.teamName} · 행운권 꽝'
                        : item.pickType == 'LUCKY_DRAW_WIN'
                        ? '${item.teamName} · 행운권 당첨 → ${item.selectedDisplayName}'
                        : item.automatic
                        ? '자동 배정 → ${item.selectedDisplayName} → ${item.teamName}'
                        : '${item.teamName} → ${item.selectedDisplayName} 선택',
                  ),
                  subtitle: item.roundNumber > 0
                      ? Text('${item.roundNumber}라운드')
                      : null,
                ),
              )
              .toList(),
        ),
      ],
      if (state.results.teams.isNotEmpty) ...<Widget>[
        const Divider(height: 28),
        ..._resultWidgets(state),
      ],
      if (state.canManage && state.teams.isNotEmpty) ...<Widget>[
        const Divider(height: 28),
        const Text(
          '기타 설정 · 팀 핸디캡',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        ...state.teams.map(
          (team) => ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            title: Text(team.name),
            subtitle: Text('현재 핸디 ${team.teamHandicap}'),
            trailing: IconButton(
              key: Key('team-handicap-${team.id}'),
              tooltip: '팀 핸디캡 수정',
              onPressed: _working ? null : () => _editHandicap(team),
              icon: const Icon(Icons.edit_outlined),
            ),
          ),
        ),
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
          if (individuals.isNotEmpty)
            ExpansionTile(
              key: Key('team-player-results-${summary.competitionTeamId}'),
              tilePadding: EdgeInsets.zero,
              initiallyExpanded: false,
              title: const Text('선수별 결과'),
              children: <Widget>[
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
              ],
            ),
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
        actions.add(
          OutlinedButton.icon(
            key: const Key('manual-assign-all-teams'),
            onPressed: _working
                ? null
                : () => _configureManualTeams(state),
            icon: const Icon(Icons.groups_2_outlined),
            label: const Text('전체 수동 편성'),
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
      case 'LUCKY_DRAW':
        actions.add(
          FilledButton.tonal(
            onPressed: _working
                ? null
                : () => _run(const <String, dynamic>{
                    'action': 'AUTO_ASSIGN_REMAINDER',
                  }),
            child: const Text('남은 인원 자동 배정'),
          ),
        );
      case 'TEAMS_FINALIZED':
        actions.add(
          OutlinedButton.icon(
            key: const Key('configure-team-lanes'),
            onPressed: _working ? null : () => _configureLanePool(state),
            icon: const Icon(Icons.view_week_outlined),
            label: const Text('사용 레인/인원 설정'),
          ),
        );
        final int participantCount = state.teams.fold<int>(
          0,
          (sum, team) => sum + team.members.length,
        );
        actions.add(
          FilledButton(
            key: const Key('assign-team-lanes'),
            onPressed: _working || state.laneSlots.length < participantCount
                ? null
                : () => _assignLanes(state),
            child: const Text('팀별 레인 배정'),
          ),
        );
      case 'LANES_ASSIGNED':
        actions.add(
          OutlinedButton.icon(
            key: const Key('configure-team-lanes'),
            onPressed: _working ? null : () => _configureLanePool(state),
            icon: const Icon(Icons.view_week_outlined),
            label: const Text('사용 레인/인원 재설정'),
          ),
        );
        actions.add(
          OutlinedButton.icon(
            key: const Key('adjust-team-lanes'),
            onPressed: _working ? null : () => _adjustLanes(state),
            icon: const Icon(Icons.swap_horiz_rounded),
            label: const Text('레인 배정 조정'),
          ),
        );
        actions.add(
          FilledButton(
            onPressed: _working ? null : _publish,
            child: const Text('최종 TEAM 결과 발표'),
          ),
        );
      case 'PUBLISHED':
        break;
    }
    if (const <String>{
      'ATTENDANCE_LOCKED',
      'DRAFT_READY',
      'DRAFT_IN_PROGRESS',
      'LUCKY_DRAW',
      'TEAMS_FINALIZED',
      'LANES_ASSIGNED',
    }.contains(state.status)) {
      actions.add(
        OutlinedButton.icon(
          key: const Key('add-late-participant'),
          onPressed: _working ? null : () => _addLateParticipant(state),
          icon: const Icon(Icons.person_add_alt_1_outlined),
          label: const Text('늦은 참가자 추가'),
        ),
      );
    }
    return Wrap(spacing: 8, runSpacing: 8, children: actions);
  }

  Widget _teamTile(ClubCompetitionTeam team) {
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
                  children: state.remainingParticipants
                      .where((participant) => participant.memberId != null)
                      .map((participant) {
                        final String memberId = participant.memberId!;
                        final int order = selected.indexOf(memberId);
                        return CheckboxListTile(
                          value: order >= 0,
                          title: Text(participant.name),
                          subtitle: order >= 0
                              ? Text('드래프트 순서 ${order + 1}')
                              : null,
                          onChanged: (bool? checked) => setDialogState(() {
                            if (checked == true) {
                              selected.add(memberId);
                            } else {
                              selected.remove(memberId);
                            }
                          }),
                        );
                      })
                      .toList(),
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

  Future<void> _configureManualTeams(ClubTeamCompetitionState state) async {
    final Map<String, dynamic>? action =
        await showDialog<Map<String, dynamic>>(
          context: context,
          builder: (BuildContext context) => _ManualTeamAssignmentDialog(
            participants: state.remainingParticipants,
          ),
        );
    if (action == null || !mounted) return;
    await _run(action);
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
        builder: (BuildContext context, StateSetter setDialogState) => AlertDialog(
          title: const Text('팀별 레인 배정'),
          content: SizedBox(
            width: 460,
            height: 520,
            child: ListView.builder(
              itemCount: teams.length,
              itemBuilder: (BuildContext context, int teamIndex) {
                final team = teams[teamIndex];
                final teamMembers = members[team.id]!;
                final int slotOffset = teams
                    .take(teamIndex)
                    .fold<int>(
                      0,
                      (sum, item) => sum + members[item.id]!.length,
                    );
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
                              key: Key('team-order-up-${team.id}'),
                              onPressed: teamIndex == 0
                                  ? null
                                  : () => setDialogState(() {
                                      final moved = teams.removeAt(teamIndex);
                                      teams.insert(teamIndex - 1, moved);
                                    }),
                              icon: const Icon(Icons.arrow_upward),
                            ),
                            IconButton(
                              key: Key('team-order-down-${team.id}'),
                              onPressed: teamIndex == teams.length - 1
                                  ? null
                                  : () => setDialogState(() {
                                      final moved = teams.removeAt(teamIndex);
                                      teams.insert(teamIndex + 1, moved);
                                    }),
                              icon: const Icon(Icons.arrow_downward),
                            ),
                          ],
                        ),
                        ...List<Widget>.generate(teamMembers.length, (index) {
                          final member = teamMembers[index];
                          return Row(
                            children: <Widget>[
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    Text('${index + 1}. ${member.name}'),
                                    Text(
                                      slotOffset + index <
                                              state.laneSlots.length
                                          ? '→ ${state.laneSlots[slotOffset + index].label}'
                                          : '→ 좌석 부족',
                                      key: Key(
                                        'lane-preview-${member.participantId}',
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              IconButton(
                                key: Key(
                                  'member-order-up-${member.participantId}',
                                ),
                                onPressed: index == 0
                                    ? null
                                    : () => setDialogState(() {
                                        final moved = teamMembers.removeAt(
                                          index,
                                        );
                                        teamMembers.insert(index - 1, moved);
                                      }),
                                icon: const Icon(Icons.keyboard_arrow_up),
                              ),
                              IconButton(
                                key: Key(
                                  'member-order-down-${member.participantId}',
                                ),
                                onPressed: index == teamMembers.length - 1
                                    ? null
                                    : () => setDialogState(() {
                                        final moved = teamMembers.removeAt(
                                          index,
                                        );
                                        teamMembers.insert(index + 1, moved);
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
            'participantIds': members[teams[index].id]!
                .map((member) => member.participantId)
                .toList(),
          },
      ],
    });
  }

  Future<void> _configureLanePool(ClubTeamCompetitionState state) async {
    final bool resetsAssignments = state.status == 'LANES_ASSIGNED';
    if (resetsAssignments) {
      final bool? confirmed = await showDialog<bool>(
        context: context,
        builder: (BuildContext context) => AlertDialog(
          title: const Text('레인 배정 초기화'),
          content: const Text('레인 배정을 다시 설정하면 현재 레인 배정이 초기화됩니다.'),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('취소'),
            ),
            FilledButton(
              key: const Key('confirm-reset-lane-capacity'),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('계속'),
            ),
          ],
        ),
      );
      if (confirmed != true || !mounted) return;
    }
    final int participantCount = state.teams.fold<int>(
      0,
      (sum, team) => sum + team.members.length,
    );
    final Map<int, int>? result = await showDialog<Map<int, int>>(
      context: context,
      builder: (BuildContext context) => _TeamLanePoolDialog(
        participantCount: participantCount,
        initialSlots: state.laneSlots,
      ),
    );
    if (result == null || !mounted) return;
    final ordered = <({int laneNumber, int position})>[
      for (final lane in result.keys.toList()..sort())
        for (int position = 1; position <= result[lane]!; position++)
          (laneNumber: lane, position: position),
    ];
    setState(() => _working = true);
    try {
      await ref
          .read(clubEventsRepositoryProvider)
          .replaceLaneSlots(
            widget.teamId,
            widget.eventId,
            ordered,
            resetAssignments: resetsAssignments,
          );
      if (mounted) {
        ref.invalidate(clubTeamCompetitionProvider(_request));
        invalidateClubEvents(ref, widget.userId, widget.teamId, widget.eventId);
      }
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              error is ApiException
                  ? error.userMessage
                  : clubErrorMessage(error),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _adjustLanes(ClubTeamCompetitionState state) async {
    final List<Map<String, String>>? assignments =
        await showDialog<List<Map<String, String>>>(
          context: context,
          builder: (BuildContext context) =>
              _TeamLaneAdjustmentDialog(state: state),
        );
    if (assignments == null || !mounted) return;
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('레인 배정 저장'),
        content: const Text('조정한 최종 레인/자리 배정을 저장할까요?'),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          FilledButton(
            key: const Key('confirm-adjust-team-lanes'),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('저장'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await _run(<String, dynamic>{
      'action': 'ADJUST_LANES',
      'assignments': assignments,
    });
  }

  Future<void> _addLateParticipant(ClubTeamCompetitionState state) async {
    final List<ClubEventAttendanceItem> availableMembers = widget.attendance
        .where((item) => item.status != ClubEventAttendance.attending)
        .toList();
    final bool resetsDraft = state.status != 'ATTENDANCE_LOCKED';
    final bool resetsLanes = state.status == 'LANES_ASSIGNED';
    final Map<String, dynamic>? action = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (BuildContext context) => _LateParticipantDialog(
        availableMembers: availableMembers,
        resetsDraft: resetsDraft,
        resetsLanes: resetsLanes,
      ),
    );
    if (action == null || !mounted || _working) return;
    setState(() => _working = true);
    try {
      await ref
          .read(clubEventsRepositoryProvider)
          .teamCompetitionAction(widget.teamId, widget.eventId, action);
      if (mounted) {
        invalidateClubEvents(ref, widget.userId, widget.teamId, widget.eventId);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              resetsDraft
                  ? '참가자를 추가했습니다. 공정한 팀 편성을 위해 기존 드래프트가 초기화되었습니다.${resetsLanes ? ' 기존 레인 배정도 초기화되었습니다.' : ''}'
                  : '늦은 참가자를 추가했습니다.',
            ),
          ),
        );
      }
    } on Object catch (error) {
      if (mounted) {
        final String message = error is ApiException
            ? error.userMessage
            : clubErrorMessage(error);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(message)));
      }
    } finally {
      if (mounted) setState(() => _working = false);
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

class _ManualTeamAssignmentDialog extends StatefulWidget {
  const _ManualTeamAssignmentDialog({required this.participants});

  final List<ClubTeamCompetitionParticipant> participants;

  @override
  State<_ManualTeamAssignmentDialog> createState() =>
      _ManualTeamAssignmentDialogState();
}

class _ManualTeamAssignmentDialogState
    extends State<_ManualTeamAssignmentDialog> {
  final List<String> _captainParticipantIds = <String>[];
  final Map<String, int> _teamByParticipant = <String, int>{};
  int _step = 0;

  List<ClubTeamCompetitionParticipant> get _memberParticipants => widget
      .participants
      .where((participant) => participant.memberId != null)
      .toList(growable: false);

  void _toggleCaptain(String participantId, bool selected) => setState(() {
    if (selected) {
      _captainParticipantIds.add(participantId);
    } else {
      _captainParticipantIds.remove(participantId);
    }
  });

  void _startAssignment() => setState(() {
    _teamByParticipant.clear();
    for (int index = 0; index < _captainParticipantIds.length; index++) {
      _teamByParticipant[_captainParticipantIds[index]] = index + 1;
    }
    _step = 1;
  });

  Map<String, dynamic> _action() {
    final participantsById = <String, ClubTeamCompetitionParticipant>{
      for (final participant in widget.participants)
        participant.participantId: participant,
    };
    return <String, dynamic>{
      'action': 'MANUAL_ASSIGN_TEAMS',
      'captains': <Map<String, dynamic>>[
        for (int index = 0; index < _captainParticipantIds.length; index++)
          <String, dynamic>{
            'memberId':
                participantsById[_captainParticipantIds[index]]!.memberId,
            'draftOrder': index + 1,
          },
      ],
      'assignments': <Map<String, dynamic>>[
        for (final participant in widget.participants)
          <String, dynamic>{
            'participantKind': participant.participantKind,
            if (participant.memberId != null) 'memberId': participant.memberId,
            if (participant.guestId != null) 'guestId': participant.guestId,
            'teamOrder': _teamByParticipant[participant.participantId],
          },
      ],
    };
  }

  @override
  Widget build(BuildContext context) {
    final bool complete =
        _teamByParticipant.length == widget.participants.length;
    final Map<int, int> sizes = <int, int>{
      for (int order = 1; order <= _captainParticipantIds.length; order++)
        order: 0,
    };
    for (final order in _teamByParticipant.values) {
      sizes[order] = (sizes[order] ?? 0) + 1;
    }
    final bool unbalanced =
        sizes.isNotEmpty && sizes.values.toSet().length > 1;
    return AlertDialog(
      title: const Text('전체 수동 TEAM 편성'),
      content: SizedBox(
        width: 480,
        child: SingleChildScrollView(
          child: _step == 0
              ? Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    const Text('팀장을 선택한 순서대로 TEAM 1, TEAM 2…가 만들어집니다.'),
                    const SizedBox(height: 8),
                    for (final participant in _memberParticipants)
                      CheckboxListTile(
                        key: Key(
                          'manual-captain-${participant.participantId}',
                        ),
                        value: _captainParticipantIds.contains(
                          participant.participantId,
                        ),
                        title: Text(participant.name),
                        subtitle: _captainParticipantIds.contains(
                          participant.participantId,
                        )
                            ? Text(
                                'TEAM ${_captainParticipantIds.indexOf(participant.participantId) + 1} 팀장',
                              )
                            : null,
                        onChanged: (bool? value) => _toggleCaptain(
                          participant.participantId,
                          value == true,
                        ),
                      ),
                  ],
                )
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    const Text('모든 참가자를 하나의 TEAM에 지정해주세요.'),
                    const SizedBox(height: 8),
                    for (final participant in widget.participants)
                      DropdownButtonFormField<int>(
                        key: Key(
                          'manual-team-${participant.participantId}',
                        ),
                        initialValue:
                            _teamByParticipant[participant.participantId],
                        decoration: InputDecoration(
                          labelText: _captainParticipantIds.contains(
                            participant.participantId,
                          )
                              ? '${participant.name} · 팀장'
                              : participant.name,
                        ),
                        items: <DropdownMenuItem<int>>[
                          for (
                            int order = 1;
                            order <= _captainParticipantIds.length;
                            order++
                          )
                            DropdownMenuItem<int>(
                              value: order,
                              child: Text('TEAM $order'),
                            ),
                        ],
                        onChanged: _captainParticipantIds.contains(
                          participant.participantId,
                        )
                            ? null
                            : (int? value) => setState(() {
                                if (value != null) {
                                  _teamByParticipant[participant.participantId] =
                                      value;
                                }
                              }),
                      ),
                    if (unbalanced)
                      const Text(
                        'TEAM별 인원수가 동일하지 않습니다. 그대로 저장할 수 있습니다.',
                        key: Key('manual-team-unbalanced-warning'),
                      ),
                  ],
                ),
        ),
      ),
      actions: <Widget>[
        if (_step == 1)
          TextButton(
            onPressed: () => setState(() => _step = 0),
            child: const Text('이전'),
          ),
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('취소'),
        ),
        FilledButton(
          key: Key(_step == 0 ? 'manual-team-next' : 'save-manual-teams'),
          onPressed: _step == 0
              ? (_captainParticipantIds.length >= 2
                    ? _startAssignment
                    : null)
              : (complete ? () => Navigator.pop(context, _action()) : null),
          child: Text(_step == 0 ? '다음' : '저장'),
        ),
      ],
    );
  }
}

class _LateParticipantDialog extends StatefulWidget {
  const _LateParticipantDialog({
    required this.availableMembers,
    required this.resetsDraft,
    required this.resetsLanes,
  });

  final List<ClubEventAttendanceItem> availableMembers;
  final bool resetsDraft;
  final bool resetsLanes;

  @override
  State<_LateParticipantDialog> createState() => _LateParticipantDialogState();
}

class _LateParticipantDialogState extends State<_LateParticipantDialog> {
  late String _participantKind;
  String? _memberId;
  final TextEditingController _guestController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _participantKind = widget.availableMembers.isEmpty ? 'GUEST' : 'MEMBER';
    _memberId = widget.availableMembers.firstOrNull?.memberId;
  }

  @override
  void dispose() {
    _guestController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bool canSubmit = _participantKind == 'MEMBER'
        ? _memberId != null
        : _guestController.text.trim().isNotEmpty;
    return AlertDialog(
      title: Text(widget.resetsDraft ? '참가자 추가 및 팀 편성 초기화' : '늦은 참가자 추가'),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                widget.resetsLanes
                    ? '새 참가자를 추가하면 현재 팀장 선정과 드래프트 결과가 모두 초기화됩니다. 공정한 팀 편성을 위해 참가자 추가 후 팀장 선정부터 다시 진행해야 합니다. 기존 레인 배정도 초기화됩니다.'
                    : widget.resetsDraft
                    ? '새 참가자를 추가하면 현재 팀장 선정과 드래프트 결과가 모두 초기화됩니다. 공정한 팀 편성을 위해 참가자 추가 후 팀장 선정부터 다시 진행해야 합니다.'
                    : '참석 마감 후 참가자를 추가합니다. 아직 만든 팀이 없어 초기화는 발생하지 않습니다.',
                key: const Key('late-participant-warning'),
                style: TextStyle(
                  color: widget.resetsDraft
                      ? Theme.of(context).colorScheme.error
                      : null,
                  fontWeight: widget.resetsDraft ? FontWeight.w700 : null,
                ),
              ),
              const SizedBox(height: 16),
              SegmentedButton<String>(
                segments: const <ButtonSegment<String>>[
                  ButtonSegment<String>(value: 'MEMBER', label: Text('회원')),
                  ButtonSegment<String>(value: 'GUEST', label: Text('게스트')),
                ],
                selected: <String>{_participantKind},
                onSelectionChanged: (Set<String> selected) =>
                    setState(() => _participantKind = selected.first),
              ),
              const SizedBox(height: 12),
              if (_participantKind == 'MEMBER')
                widget.availableMembers.isEmpty
                    ? const Text('추가할 수 있는 회원이 없습니다.')
                    : DropdownButtonFormField<String>(
                        key: const Key('late-member-picker'),
                        initialValue: _memberId,
                        decoration: const InputDecoration(labelText: '회원 선택'),
                        items: widget.availableMembers
                            .map(
                              (item) => DropdownMenuItem<String>(
                                value: item.memberId,
                                child: Text(item.name),
                              ),
                            )
                            .toList(),
                        onChanged: (String? value) =>
                            setState(() => _memberId = value),
                      )
              else
                TextField(
                  key: const Key('late-guest-name'),
                  controller: _guestController,
                  maxLength: 40,
                  decoration: const InputDecoration(labelText: '게스트 이름'),
                  onChanged: (_) => setState(() {}),
                ),
            ],
          ),
        ),
      ),
      actions: <Widget>[
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('취소'),
        ),
        FilledButton(
          key: const Key('confirm-late-participant'),
          onPressed: !canSubmit
              ? null
              : () => Navigator.pop(context, <String, dynamic>{
                  'action': 'ADD_LATE_PARTICIPANT',
                  'participantKind': _participantKind,
                  if (_participantKind == 'MEMBER') 'memberId': _memberId,
                  if (_participantKind == 'GUEST')
                    'guestName': _guestController.text.trim(),
                }),
          child: Text(widget.resetsDraft ? '추가하고 다시 편성' : '참가자 추가'),
        ),
      ],
    );
  }
}

class _TeamLanePoolDialog extends StatefulWidget {
  const _TeamLanePoolDialog({
    required this.participantCount,
    required this.initialSlots,
  });

  final int participantCount;
  final List<ClubTeamLaneSlot> initialSlots;

  @override
  State<_TeamLanePoolDialog> createState() => _TeamLanePoolDialogState();
}

class _TeamLanePoolDialogState extends State<_TeamLanePoolDialog> {
  late final Map<int, int> _capacities = _initialCapacities();
  late final Set<int> _invalidLanes = _initialInvalidLanes();

  Map<int, int> _initialCapacities() {
    final Map<int, List<int>> positions = <int, List<int>>{};
    for (final slot in widget.initialSlots) {
      positions.putIfAbsent(slot.laneNumber, () => <int>[]).add(slot.position);
    }
    return <int, int>{
      for (final entry in positions.entries)
        entry.key: (entry.value..sort()).last,
    };
  }

  Set<int> _initialInvalidLanes() {
    final Map<int, List<int>> positions = <int, List<int>>{};
    for (final slot in widget.initialSlots) {
      positions.putIfAbsent(slot.laneNumber, () => <int>[]).add(slot.position);
    }
    return <int>{
      for (final entry in positions.entries)
        if ((entry.value..sort()).asMap().entries.any(
          (item) => item.value != item.key + 1,
        ))
          entry.key,
    };
  }

  int get _selectedCount =>
      _capacities.values.fold<int>(0, (sum, value) => sum + value);

  void _setCapacity(int lane, int capacity) => setState(() {
    _invalidLanes.remove(lane);
    if (capacity == 0) {
      _capacities.remove(lane);
    } else {
      _capacities[lane] = capacity;
    }
  });

  String get _capacityStatus {
    final int difference = _selectedCount - widget.participantCount;
    if (difference == 0) return '배정 가능';
    if (difference < 0) return '참가자보다 좌석이 ${-difference}개 부족합니다.';
    return '좌석이 $difference개 여유 있습니다.';
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('사용 레인/인원 설정'),
    content: SizedBox(
      width: 520,
      height: 560,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              '참가자 ${widget.participantCount}명 · 선택 좌석 $_selectedCount개',
              key: const Key('team-lane-selection-summary'),
            ),
            Text(
              _capacityStatus,
              key: const Key('team-lane-capacity-status'),
              style: TextStyle(
                color: _selectedCount < widget.participantCount
                    ? Theme.of(context).colorScheme.error
                    : null,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (_invalidLanes.isNotEmpty)
              Text(
                '기존 ${(_invalidLanes.toList()..sort()).join(', ')}번 레인의 자리 번호가 1번부터 연속되지 않습니다. 해당 레인을 해제하거나 인원수를 조정해주세요.',
                key: const Key('invalid-team-lane-capacity'),
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            const SizedBox(height: 8),
            for (int lane = 1; lane <= 24; lane++)
              CheckboxListTile(
                key: Key('team-lane-option-$lane'),
                value: _capacities.containsKey(lane),
                onChanged: (selected) =>
                    _setCapacity(lane, selected == true ? 3 : 0),
                title: Text('$lane번 레인'),
                subtitle: _invalidLanes.contains(lane)
                    ? const Text('기존 설정 오류')
                    : null,
                secondary: SizedBox(
                  width: 132,
                  child: Row(
                    children: <Widget>[
                      IconButton(
                        key: Key('decrease-team-lane-$lane'),
                        onPressed: (_capacities[lane] ?? 0) > 1
                            ? () => _setCapacity(lane, _capacities[lane]! - 1)
                            : null,
                        icon: const Icon(Icons.remove_circle_outline),
                      ),
                      SizedBox(
                        width: 28,
                        child: Text(
                          '${_capacities[lane] ?? 0}명',
                          key: Key('team-lane-capacity-$lane'),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      IconButton(
                        key: Key('increase-team-lane-$lane'),
                        onPressed:
                            (_capacities[lane] ?? 0) > 0 &&
                                (_capacities[lane] ?? 0) < 6
                            ? () => _setCapacity(lane, _capacities[lane]! + 1)
                            : null,
                        icon: const Icon(Icons.add_circle_outline),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    ),
    actions: <Widget>[
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('취소'),
      ),
      FilledButton(
        key: const Key('save-team-lanes'),
        onPressed: _capacities.isNotEmpty && _invalidLanes.isEmpty
            ? () => Navigator.pop(context, Map<int, int>.from(_capacities))
            : null,
        child: const Text('저장'),
      ),
    ],
  );
}

class _TeamLaneAdjustmentDialog extends StatefulWidget {
  const _TeamLaneAdjustmentDialog({required this.state});

  final ClubTeamCompetitionState state;

  @override
  State<_TeamLaneAdjustmentDialog> createState() =>
      _TeamLaneAdjustmentDialogState();
}

class _TeamLaneAdjustmentDialogState extends State<_TeamLaneAdjustmentDialog> {
  late final List<ClubTeamCompetitionParticipant> _participants = widget
      .state
      .teams
      .expand((team) => team.members)
      .toList();
  late final Map<String, String> _assignments = <String, String>{
    for (final participant in _participants)
      if (participant.laneSlot case final String label)
        if (widget.state.laneSlots.any((slot) => slot.label == label))
          participant.participantId: widget.state.laneSlots
              .firstWhere((slot) => slot.label == label)
              .id,
  };

  void _changeSlot(String participantId, String nextSlotId) => setState(() {
    final String? previousSlotId = _assignments[participantId];
    String? occupantId;
    for (final entry in _assignments.entries) {
      if (entry.key != participantId && entry.value == nextSlotId) {
        occupantId = entry.key;
        break;
      }
    }
    _assignments[participantId] = nextSlotId;
    if (occupantId != null && previousSlotId != null) {
      _assignments[occupantId] = previousSlotId;
    }
  });

  @override
  Widget build(BuildContext context) {
    final bool complete =
        _assignments.length == _participants.length &&
        _assignments.values.toSet().length == _participants.length;
    return AlertDialog(
      title: const Text('레인 배정 조정'),
      content: SizedBox(
        width: 520,
        height: 560,
        child: ListView(
          children: <Widget>[
            const Text('사용 중인 자리를 선택하면 두 참가자의 자리가 서로 바뀝니다.'),
            const SizedBox(height: 8),
            for (final team in widget.state.teams) ...<Widget>[
              Text(
                team.name,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              for (final participant in team.members)
                Row(
                  children: <Widget>[
                    Expanded(child: Text(participant.name)),
                    DropdownButton<String>(
                      key: Key('lane-adjust-${participant.participantId}'),
                      value: _assignments[participant.participantId],
                      items: widget.state.laneSlots
                          .map(
                            (slot) => DropdownMenuItem<String>(
                              value: slot.id,
                              child: Text(slot.label),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        if (value != null) {
                          _changeSlot(participant.participantId, value);
                        }
                      },
                    ),
                  ],
                ),
              const SizedBox(height: 12),
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
          key: const Key('save-adjusted-team-lanes'),
          onPressed: complete
              ? () => Navigator.pop(context, <Map<String, String>>[
                  for (final participant in _participants)
                    <String, String>{
                      'participantId': participant.participantId,
                      'slotId': _assignments[participant.participantId]!,
                    },
                ])
              : null,
          child: const Text('다음'),
        ),
      ],
    );
  }
}

String _statusLabel(String status) => switch (status) {
  'ATTENDANCE_OPEN' => '참석 조사',
  'ATTENDANCE_LOCKED' => '참석 마감',
  'DRAFT_READY' => '드래프트 준비',
  'DRAFT_IN_PROGRESS' => '드래프트 진행',
  'LUCKY_DRAW' => '행운권 추첨',
  'TEAMS_FINALIZED' => '팀 확정',
  'LANES_ASSIGNED' => '레인 배정 완료',
  'PUBLISHED' => '결과 발표',
  _ => status,
};
