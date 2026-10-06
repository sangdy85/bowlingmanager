import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_admin_models.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ClubEventAdminCard extends ConsumerStatefulWidget {
  const ClubEventAdminCard({
    required this.userId,
    required this.teamId,
    required this.eventId,
    required this.onDeleted,
    super.key,
  });

  final String userId;
  final String teamId;
  final String eventId;
  final VoidCallback onDeleted;

  @override
  ConsumerState<ClubEventAdminCard> createState() => _ClubEventAdminCardState();
}

class _ClubEventAdminCardState extends ConsumerState<ClubEventAdminCard> {
  bool _working = false;

  ClubEventRequest get _request =>
      (userId: widget.userId, teamId: widget.teamId, eventId: widget.eventId);

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(clubEventAdminProvider(_request));
    return Card(
      key: const Key('event-admin-operations'),
      color: Theme.of(context).colorScheme.errorContainer.withValues(alpha: .2),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: state.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              const Text(
                '관리자 운영 도구',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              Text(_message(error)),
              OutlinedButton(
                onPressed: () =>
                    ref.invalidate(clubEventAdminProvider(_request)),
                child: const Text('다시 불러오기'),
              ),
            ],
          ),
          data: _content,
        ),
      ),
    );
  }

  Widget _content(ClubEventAdminState state) {
    final status = state.competitionStatus;
    final type = state.competitionType;
    final canResetEvent =
        type == 'EVENT' &&
        const <String>{
          'EVENT_READY',
          'REVEALING',
          'FINAL_READY',
        }.contains(status);
    final canResetTeam =
        type == 'TEAM' &&
        const <String>{
          'DRAFT_READY',
          'DRAFT_IN_PROGRESS',
          'LUCKY_DRAW',
          'TEAMS_FINALIZED',
          'LANES_ASSIGNED',
        }.contains(status);
    final canReopenAttendance = switch (type) {
      'INDIVIDUAL' => status == 'GROUPS_READY',
      'TEAM' => const <String>{
        'ATTENDANCE_LOCKED',
        'DRAFT_READY',
        'DRAFT_IN_PROGRESS',
        'LUCKY_DRAW',
        'TEAMS_FINALIZED',
        'LANES_ASSIGNED',
      }.contains(status),
      'EVENT' => const <String>{
        'EVENT_READY',
        'REVEALING',
        'FINAL_READY',
      }.contains(status),
      _ => false,
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        const Row(
          children: <Widget>[
            Icon(Icons.admin_panel_settings_outlined),
            SizedBox(width: 8),
            Text(
              '관리자 운영 도구',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
            ),
          ],
        ),
        const SizedBox(height: 6),
        const Text('Owner/Manager 전용 · 모든 강제 작업은 감사 기록에 남습니다.'),
        const Divider(height: 24),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: <Widget>[
            Chip(label: Text(status ?? '일반 일정')),
            Chip(
              label: Text(
                state.gameCount == null ? '경기 수 미설정' : '${state.gameCount}게임',
              ),
            ),
            Chip(label: Text('점수 ${state.scoreCount}건')),
            if (state.activePublicationCount > 0)
              const Chip(label: Text('발표됨')),
          ],
        ),
        if (state.gameCount == null && type != null) ...<Widget>[
          const SizedBox(height: 8),
          const Text(
            '이 대회의 경기 게임 수를 먼저 설정해주세요. 설정 전에는 점수를 입력할 수 없습니다.',
            key: Key('legacy-game-count-warning'),
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
        ],
        const SizedBox(height: 12),
        if (state.isPublished)
          _dangerButton(
            key: const Key('admin-reopen-publication'),
            icon: Icons.unpublished_outlined,
            label: '발표 결과 다시 열기',
            onPressed: () => _confirmedAction(
              state,
              action: 'REOPEN_PUBLICATION',
              title: '발표 결과 다시 열기',
              description: '시즌 포인트 발표를 취소하고 발표 직전 단계로 돌아갑니다.',
              requireTitle: true,
              includePublication: true,
            ),
          )
        else ...<Widget>[
          if (canReopenAttendance)
            _operationButton(
              key: const Key('admin-reopen-attendance'),
              icon: Icons.undo_rounded,
              label: '참석자 마감 해제',
              onPressed: () => _confirmedAction(
                state,
                action: 'REOPEN_ATTENDANCE',
                title: '참석자 마감 해제',
                description: type == 'TEAM' && status != 'ATTENDANCE_LOCKED'
                    ? '현재 TEAM 편성과 레인 배정이 초기화됩니다. 참석 정보는 유지됩니다.'
                    : type == 'EVENT'
                    ? '현재 EVENT 참가자 확정과 투표 데이터가 초기화됩니다. 참석 정보는 유지됩니다.'
                    : '참석 정보를 유지한 채 참석 조사를 다시 엽니다.',
                requireTitle:
                    (type == 'TEAM' && status != 'ATTENDANCE_LOCKED') ||
                    type == 'EVENT',
                clearScores: true,
              ),
            ),
          if (type == 'INDIVIDUAL' && status == 'GROUPS_READY') ...<Widget>[
            _operationButton(
              key: const Key('admin-clear-groups'),
              icon: Icons.group_remove_outlined,
              label: '조 편성 초기화',
              onPressed: () => _confirmedAction(
                state,
                action: 'CLEAR_INDIVIDUAL_GROUPS',
                title: '조 편성 초기화',
                description: '관리자가 지정한 수동 조 정보만 제거합니다.',
              ),
            ),
          ],
          if (canResetTeam)
            _dangerButton(
              key: const Key('admin-reset-team-draft'),
              icon: Icons.restart_alt_rounded,
              label: 'TEAM 드래프트 전체 초기화',
              onPressed: () => _confirmedAction(
                state,
                action: 'RESET_TEAM_DRAFT',
                title: 'TEAM 드래프트 초기화',
                description: '새 generation으로 다시 시작하며 이전 드래프트 기록은 보존됩니다.',
                requireTitle: true,
                clearScores: true,
              ),
            ),
          if (type == 'TEAM' &&
              const <String>{
                'TEAMS_FINALIZED',
                'LANES_ASSIGNED',
              }.contains(status))
            _operationButton(
              key: const Key('admin-team-override'),
              icon: Icons.groups_2_outlined,
              label: '팀 수동 편성',
              onPressed: () => _editTeams(state),
            ),
          if (state.laneDrawStatus != 'NOT_STARTED')
            _operationButton(
              key: const Key('admin-reset-lanes'),
              icon: Icons.grid_off_outlined,
              label: '레인 배정 초기화',
              onPressed: () => _confirmedAction(
                state,
                action: 'RESET_LANES',
                title: '레인 배정 초기화',
                description: '배정만 삭제하며 설정된 레인 좌석은 유지됩니다.',
                clearScores: true,
              ),
            ),
          if (canResetEvent) ...<Widget>[
            _dangerButton(
              key: const Key('admin-reset-event-participants'),
              icon: Icons.person_remove_alt_1_outlined,
              label: 'EVENT 참가자 확정 초기화',
              onPressed: () => _confirmedAction(
                state,
                action: 'RESET_EVENT_PARTICIPANTS',
                title: 'EVENT 참가자 확정 초기화',
                description: '투표와 참가자 snapshot을 제거하고 참석 단계로 돌아갑니다.',
                requireTitle: true,
                clearScores: true,
              ),
            ),
            _operationButton(
              key: const Key('admin-reset-event-voting'),
              icon: Icons.how_to_vote_outlined,
              label: '투표 초기화 및 다시 받기',
              onPressed: () => _resetVoting(state),
            ),
          ],
          if (type == 'EVENT' && status == 'EVENT_READY')
            ...state.eventParticipants
                .where((item) => item.hasBallot)
                .map(
                  (item) => TextButton.icon(
                    key: Key('admin-reset-ballot-${item.id}'),
                    onPressed: _working
                        ? null
                        : () => _confirmedAction(
                            state,
                            action: 'RESET_EVENT_BALLOT',
                            title: '${item.name} 투표 초기화',
                            description: '이 참가자의 투표만 삭제하고 다시 투표할 수 있게 합니다.',
                            extra: <String, dynamic>{
                              'voterParticipantId': item.id,
                            },
                          ),
                    icon: const Icon(Icons.person_off_outlined),
                    label: Text('${item.name} 투표 초기화'),
                  ),
                ),
          if (type != null)
            _operationButton(
              key: const Key('admin-change-game-count'),
              icon: Icons.numbers_rounded,
              label: '경기 게임 수 변경',
              onPressed: () => _changeGameCount(state),
            ),
          if (state.scoreCount > 0)
            _dangerButton(
              key: const Key('admin-clear-scores'),
              icon: Icons.delete_sweep_outlined,
              label: '경기 점수 초기화 (${state.scoreCount}건)',
              onPressed: () => _confirmedAction(
                state,
                action: 'CLEAR_SCORES',
                title: '경기 점수 초기화',
                description: '저장된 경기 점수를 복구할 수 없게 삭제합니다.',
                requireTitle: true,
                clearScores: true,
              ),
            ),
        ],
        const Divider(height: 28),
        _dangerButton(
          key: const Key('admin-delete-event'),
          icon: Icons.delete_forever_outlined,
          label: '대회 삭제',
          onPressed: () => _delete(state),
        ),
        if (state.audits.isNotEmpty) ...<Widget>[
          const SizedBox(height: 14),
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: const Text('최근 관리자 작업 기록'),
            children: state.audits
                .take(5)
                .map(
                  (audit) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(audit.action),
                    subtitle: Text(
                      '${audit.beforeStatus ?? '-'} → ${audit.afterStatus ?? '삭제'}',
                    ),
                  ),
                )
                .toList(growable: false),
          ),
        ],
      ],
    );
  }

  Widget _operationButton({
    required Key key,
    required IconData icon,
    required String label,
    required VoidCallback onPressed,
  }) => OutlinedButton.icon(
    key: key,
    onPressed: _working ? null : onPressed,
    icon: Icon(icon),
    label: Text(label),
  );

  Widget _dangerButton({
    required Key key,
    required IconData icon,
    required String label,
    required VoidCallback onPressed,
  }) => OutlinedButton.icon(
    key: key,
    style: OutlinedButton.styleFrom(
      foregroundColor: Theme.of(context).colorScheme.error,
    ),
    onPressed: _working ? null : onPressed,
    icon: Icon(icon),
    label: Text(label),
  );

  Future<void> _confirmedAction(
    ClubEventAdminState state, {
    required String action,
    required String title,
    required String description,
    bool requireTitle = false,
    bool clearScores = false,
    bool includePublication = false,
    Map<String, dynamic> extra = const <String, dynamic>{},
  }) async {
    final confirmed = await _confirm(
      state,
      title: title,
      description: description,
      requireTitle: requireTitle || (clearScores && state.scoreCount > 0),
      includeScores: clearScores && state.scoreCount > 0,
      includePublication: includePublication,
    );
    if (!confirmed) return;
    await _run(<String, dynamic>{
      'action': action,
      if (clearScores && state.scoreCount > 0) 'clearScores': true,
      ...extra,
    });
  }

  Future<bool> _confirm(
    ClubEventAdminState state, {
    required String title,
    required String description,
    required bool requireTitle,
    required bool includeScores,
    bool includePublication = false,
    bool includeFinance = false,
  }) async {
    var matches = !requireTitle;
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text(title),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(description),
              if (includeScores) ...<Widget>[
                const SizedBox(height: 10),
                Text(
                  '현재 입력된 경기 점수 ${state.scoreCount}건이 삭제됩니다.',
                  key: const Key('admin-score-count-warning'),
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.error,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
              if (includePublication && state.activePublicationCount > 0)
                const Text('발표된 시즌 포인트가 취소됩니다.'),
              if (includeFinance && state.financeLinkCount > 0)
                const Text('게임비/회비 기록은 유지되며 일정 연결만 해제됩니다.'),
              if (requireTitle) ...<Widget>[
                const SizedBox(height: 12),
                Text('확인하려면 대회 제목 “${state.title}”을 입력하세요.'),
                TextFormField(
                  key: const Key('admin-confirm-title'),
                  onChanged: (value) =>
                      setState(() => matches = value == state.title),
                ),
              ],
            ],
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('취소'),
            ),
            FilledButton(
              onPressed: matches ? () => Navigator.pop(context, true) : null,
              child: const Text('확인'),
            ),
          ],
        ),
      ),
    );
    return result == true;
  }

  Future<void> _changeGameCount(ClubEventAdminState state) async {
    int selected = state.gameCount ?? 3;
    final value = await showDialog<int>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('경기 게임 수'),
          content: DropdownButtonFormField<int>(
            key: const Key('admin-game-count-select'),
            initialValue: selected,
            items: <DropdownMenuItem<int>>[
              for (var count = 1; count <= 12; count++)
                DropdownMenuItem(value: count, child: Text('$count게임')),
            ],
            onChanged: (value) => setState(() => selected = value ?? selected),
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('취소'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, selected),
              child: const Text('다음'),
            ),
          ],
        ),
      ),
    );
    if (value == null || value == state.gameCount || !mounted) return;
    final List<List<int>>? teamPoints = state.competitionType == 'TEAM'
        ? await _editTeamGamePoints(state, value)
        : null;
    if (state.competitionType == 'TEAM' && teamPoints == null) return;
    final confirmed = await _confirm(
      state,
      title: '경기 수를 $value게임으로 변경',
      description: state.competitionType == 'TEAM'
          ? state.gameCount != null && value < state.gameCount!
                ? '${state.gameCount}게임에서 $value게임으로 줄어 초과 게임 포인트 설정이 삭제됩니다.'
                : 'TEAM 게임별 포인트 표도 1~$value게임에 맞춰 조정됩니다.'
          : '결과 계산은 변경된 경기 수를 기준으로 합니다.',
      requireTitle: state.scoreCount > 0,
      includeScores: state.scoreCount > 0,
    );
    if (!confirmed) return;
    await _run(<String, dynamic>{
      'action': 'CHANGE_GAME_COUNT',
      'gameCount': value,
      if (state.scoreCount > 0) 'clearScores': true,
      if (teamPoints != null)
        'teamGamePointTables': <Map<String, dynamic>>[
          for (var gameIndex = 0; gameIndex < teamPoints.length; gameIndex++)
            <String, dynamic>{
              'gameNumber': gameIndex + 1,
              'points': <Map<String, int>>[
                for (
                  var rankIndex = 0;
                  rankIndex < teamPoints[gameIndex].length;
                  rankIndex++
                )
                  <String, int>{
                    'rank': rankIndex + 1,
                    'points': teamPoints[gameIndex][rankIndex],
                  },
              ],
            },
        ],
    });
  }

  Future<List<List<int>>?> _editTeamGamePoints(
    ClubEventAdminState state,
    int gameCount,
  ) {
    final values = List<List<int>>.generate(gameCount, (index) {
      if (index < state.teamGamePointTables.length) {
        return state.teamGamePointTables[index].points
            .map((item) => item.points)
            .toList();
      }
      return gameCount >= 4 && index == gameCount - 1
          ? <int>[6, 4, 2, 1]
          : <int>[5, 3, 2, 1];
    });
    return showDialog<List<List<int>>>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('TEAM 게임별 포인트 확인'),
        content: SizedBox(
          width: 480,
          height: 460,
          child: ListView.builder(
            itemCount: values.length,
            itemBuilder: (context, gameIndex) => Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      '${gameIndex + 1}게임',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    for (
                      var rankIndex = 0;
                      rankIndex < values[gameIndex].length;
                      rankIndex++
                    )
                      TextFormField(
                        key: Key(
                          'admin-team-point-${gameIndex + 1}-${rankIndex + 1}',
                        ),
                        initialValue: '${values[gameIndex][rankIndex]}',
                        keyboardType: TextInputType.number,
                        inputFormatters: <TextInputFormatter>[
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        decoration: InputDecoration(
                          labelText: '${rankIndex + 1}위 포인트',
                        ),
                        onChanged: (raw) {
                          final parsed = int.tryParse(raw);
                          if (parsed != null && parsed <= 1000) {
                            values[gameIndex][rankIndex] = parsed;
                          }
                        },
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(
              context,
              values.map((item) => <int>[...item]).toList(growable: false),
            ),
            child: const Text('포인트 확인'),
          ),
        ],
      ),
    );
  }

  Future<void> _resetVoting(ClubEventAdminState state) async {
    var preserve = false;
    var duration = 20;
    final result = await showDialog<({bool preserve, int duration})>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('투표 다시 받기'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              SegmentedButton<bool>(
                segments: const <ButtonSegment<bool>>[
                  ButtonSegment<bool>(value: false, label: Text('전체 초기화')),
                  ButtonSegment<bool>(value: true, label: Text('현재 투표 유지')),
                ],
                selected: <bool>{preserve},
                onSelectionChanged: (values) =>
                    setState(() => preserve = values.first),
              ),
              DropdownButtonFormField<int>(
                initialValue: duration,
                decoration: const InputDecoration(labelText: '새 투표 시간'),
                items: const <DropdownMenuItem<int>>[
                  DropdownMenuItem(value: 10, child: Text('10분')),
                  DropdownMenuItem(value: 20, child: Text('20분')),
                  DropdownMenuItem(value: 30, child: Text('30분')),
                  DropdownMenuItem(value: 60, child: Text('60분')),
                ],
                onChanged: (value) =>
                    setState(() => duration = value ?? duration),
              ),
            ],
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('취소'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, (
                preserve: preserve,
                duration: duration,
              )),
              child: const Text('다시 열기'),
            ),
          ],
        ),
      ),
    );
    if (result == null || !mounted) return;
    final confirmed = await _confirm(
      state,
      title: '투표 단계 다시 열기',
      description: result.preserve ? '현재 투표를 유지합니다.' : '현재 투표를 모두 삭제합니다.',
      requireTitle: true,
      includeScores: false,
    );
    if (!confirmed) return;
    await _run(<String, dynamic>{
      'action': 'RESET_EVENT_VOTING',
      'preserveBallots': result.preserve,
      'durationMinutes': result.duration,
    });
  }

  Future<void> _editTeams(ClubEventAdminState state) async {
    final assignments = <String, String>{};
    final participants = <ClubEventAdminParticipant>[];
    for (final team in state.teams) {
      for (final participant in team.members) {
        assignments[participant.id] = team.id;
        participants.add(participant);
      }
    }
    participants.addAll(state.unassignedParticipants);
    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) {
          final sizes = <String, int>{
            for (final team in state.teams) team.id: 0,
          };
          for (final teamId in assignments.values) {
            sizes[teamId] = (sizes[teamId] ?? 0) + 1;
          }
          final unbalanced = sizes.values.toSet().length > 1;
          return AlertDialog(
            title: const Text('팀 수동 편성'),
            content: SizedBox(
              width: 480,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    for (final participant in participants)
                      DropdownButtonFormField<String>(
                        key: Key('admin-team-${participant.id}'),
                        initialValue: assignments[participant.id],
                        decoration: InputDecoration(
                          labelText:
                              participant.assignmentType == 'ADMIN_OVERRIDE'
                              ? '${participant.name} · 관리자 조정됨'
                              : participant.name,
                        ),
                        items: state.teams
                            .map(
                              (team) => DropdownMenuItem(
                                value: team.id,
                                child: Text(team.name),
                              ),
                            )
                            .toList(growable: false),
                        onChanged:
                            state.teams.any(
                              (team) =>
                                  team.captainMemberId == participant.memberId,
                            )
                            ? null
                            : (value) => setState(() {
                                if (value != null) {
                                  assignments[participant.id] = value;
                                }
                              }),
                      ),
                    if (unbalanced)
                      const Text(
                        '팀 인원수가 동일하지 않습니다.',
                        key: Key('admin-team-unbalanced-warning'),
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
                onPressed: assignments.length == participants.length
                    ? () => Navigator.pop(
                        context,
                        Map<String, String>.from(assignments),
                      )
                    : null,
                child: const Text('저장'),
              ),
            ],
          );
        },
      ),
    );
    if (result == null || !mounted) return;
    final confirmed = await _confirm(
      state,
      title: '수동 TEAM 편성 저장',
      description: '기존 레인 배정은 초기화되고 TEAM 레인 배정을 다시 해야 합니다.',
      requireTitle: state.scoreCount > 0,
      includeScores: state.scoreCount > 0,
    );
    if (!confirmed) return;
    await _run(<String, dynamic>{
      'action': 'ADMIN_TEAM_OVERRIDE',
      if (state.scoreCount > 0) 'clearScores': true,
      'assignments': result.entries
          .map(
            (entry) => <String, String>{
              'participantId': entry.key,
              'competitionTeamId': entry.value,
            },
          )
          .toList(growable: false),
    });
  }

  Future<void> _delete(ClubEventAdminState state) async {
    final confirmed = await _confirm(
      state,
      title: '대회 영구 삭제',
      description: '참석, 참가자, 팀, 드래프트, 투표와 레인 정보가 함께 삭제됩니다.',
      requireTitle: true,
      includeScores: state.scoreCount > 0,
      includePublication: true,
      includeFinance: true,
    );
    if (!confirmed) return;
    final deleted = await _run(<String, dynamic>{
      'action': 'DELETE_EVENT',
      'confirmTitle': state.title,
      if (state.scoreCount > 0) 'clearScores': true,
    }, deleted: true);
    if (deleted && mounted) widget.onDeleted();
  }

  Future<bool> _run(Map<String, dynamic> body, {bool deleted = false}) async {
    setState(() => _working = true);
    try {
      await ref
          .read(clubEventsRepositoryProvider)
          .runAdminOperation(widget.teamId, widget.eventId, body);
      if (!mounted) return false;
      invalidateClubEvents(
        ref,
        widget.userId,
        widget.teamId,
        deleted ? null : widget.eventId,
      );
      ref.invalidate(dashboardProvider(widget.userId));
      ref.invalidate(clubSeasonRankingProvider);
      ref.invalidate(clubSeasonMemberProvider);
      if (!deleted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('관리자 작업을 완료했습니다.')));
      }
      return true;
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_message(error))));
      }
      return false;
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }
}

String _message(Object error) =>
    error is ApiException ? error.userMessage : '관리자 작업을 처리하지 못했습니다.';
