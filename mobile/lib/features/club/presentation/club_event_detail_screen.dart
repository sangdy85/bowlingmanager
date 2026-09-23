import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_team_competition_card.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_event_competition_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubEventDetailScreen extends ConsumerStatefulWidget {
  const ClubEventDetailScreen({
    required this.teamId,
    required this.eventId,
    super.key,
  });
  final String teamId;
  final String eventId;
  @override
  ConsumerState<ClubEventDetailScreen> createState() =>
      _ClubEventDetailScreenState();
}

class _ClubEventDetailScreenState extends ConsumerState<ClubEventDetailScreen> {
  bool _working = false;

  @override
  Widget build(BuildContext context) {
    final AuthUser? user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final request = (
      userId: user.id,
      teamId: widget.teamId,
      eventId: widget.eventId,
    );
    final provider = clubEventProvider(request);
    final AsyncValue<ClubEvent> state = ref.watch(provider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('일정 상세'),
        actions: <Widget>[
          if (state.value?.canManage == true)
            PopupMenuButton<String>(
              onSelected: (String value) {
                if (value == 'edit') {
                  context.push(
                    '/club/${Uri.encodeComponent(widget.teamId)}/events/${Uri.encodeComponent(widget.eventId)}/edit',
                  );
                } else if (value == 'delete') {
                  _delete(user.id);
                }
              },
              itemBuilder: (_) => const <PopupMenuEntry<String>>[
                PopupMenuItem(value: 'edit', child: Text('수정')),
                PopupMenuItem(value: 'delete', child: Text('삭제')),
              ],
            ),
        ],
      ),
      body: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (Object error, StackTrace _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(clubErrorMessage(error)),
              FilledButton(
                onPressed: () => ref.invalidate(provider),
                child: const Text('다시 시도'),
              ),
            ],
          ),
        ),
        data: (ClubEvent event) => RefreshIndicator(
          onRefresh: () => ref.refresh(provider.future),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            children: <Widget>[
              _eventCard(event),
              if (event.competition != null) ...<Widget>[
                const SizedBox(height: 12),
                if (event.competition!.type == ClubCompetitionType.team)
                  ClubTeamCompetitionCard(
                    userId: user.id,
                    teamId: widget.teamId,
                    eventId: widget.eventId,
                    competitionMode: event.competition!.mode,
                  )
                else if (event.competition!.type == ClubCompetitionType.event)
                  ClubEventCompetitionCard(
                    userId: user.id,
                    teamId: widget.teamId,
                    eventId: widget.eventId,
                    competitionMode: event.competition!.mode,
                  )
                else
                  _competitionCard(event, user.id),
              ],
              if (event.attendanceEnabled) ...<Widget>[
                const SizedBox(height: 12),
                _attendanceCard(event, user.id),
              ],
              if (event.canManage) ...<Widget>[
                const SizedBox(height: 12),
                _adminCard(event, user.id),
              ],
              if (event.laneDrawEnabled &&
                  event.competition?.type !=
                      ClubCompetitionType.team) ...<Widget>[
                const SizedBox(height: 12),
                _drawCard(event, user.id),
              ],
              if (event.assignments.isNotEmpty) ...<Widget>[
                const SizedBox(height: 12),
                _resultsCard(event),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _eventCard(ClubEvent event) => Card(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(event.title, style: Theme.of(context).textTheme.headlineSmall),
          if (event.competition
              case final ClubCompetitionConfig competition) ...<Widget>[
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: <Widget>[
                Chip(label: Text(event.gameType ?? '기타')),
                Chip(label: Text(competition.type.label)),
                Chip(label: Text(competition.mode?.label ?? '모드 미설정')),
              ],
            ),
            if (competition.mode == ClubCompetitionMode.mini)
              const Text(
                '미니 경기 · 시즌 포인트 미지급',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
          ],
          const SizedBox(height: 12),
          Text('${event.date} ${event.time}'),
          Text(event.location),
          if (event.gameType != null) Text('경기 유형: ${event.gameType}'),
          const SizedBox(height: 8),
          Text(
            '레인 추첨: ${event.laneDrawStatus.label} · ${event.laneDrawMode.label}',
          ),
        ],
      ),
    ),
  );

  Widget _attendanceCard(ClubEvent event, String userId) => Card(
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Text('참석 조사', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(
            '참석 ${event.counts.attending} · 불참 ${event.counts.notAttending} · '
            '미응답 ${event.counts.unanswered} · 게스트 ${event.counts.guests}',
          ),
          const SizedBox(height: 12),
          SegmentedButton<ClubEventAttendance>(
            segments: const <ButtonSegment<ClubEventAttendance>>[
              ButtonSegment(
                value: ClubEventAttendance.attending,
                label: Text('참석'),
              ),
              ButtonSegment(
                value: ClubEventAttendance.notAttending,
                label: Text('불참'),
              ),
            ],
            selected: event.myAttendance == ClubEventAttendance.unanswered
                ? <ClubEventAttendance>{}
                : <ClubEventAttendance>{event.myAttendance},
            emptySelectionAllowed: true,
            onSelectionChanged:
                event.isLocked ||
                    _working ||
                    ((event.competition?.type == ClubCompetitionType.team ||
                            event.competition?.type ==
                                ClubCompetitionType.event) &&
                        event.competition?.status != 'ATTENDANCE_OPEN')
                ? null
                : (Set<ClubEventAttendance> value) {
                    if (value.isNotEmpty) {
                      _action(
                        userId,
                        () => ref
                            .read(clubEventsRepositoryProvider)
                            .setAttendance(
                              widget.teamId,
                              widget.eventId,
                              value.first,
                            ),
                      );
                    }
                  },
          ),
          if (event.attendance != null) ...<Widget>[
            const Divider(height: 28),
            ...event.attendance!.map(
              (item) => ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(item.name),
                trailing: Text(item.status.label),
              ),
            ),
          ],
        ],
      ),
    ),
  );

  Widget _competitionCard(ClubEvent event, String userId) {
    final request = (
      userId: userId,
      teamId: widget.teamId,
      eventId: widget.eventId,
    );
    final AsyncValue<ClubCompetitionResult> state = ref.watch(
      clubCompetitionProvider(request),
    );
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
                    ref.invalidate(clubCompetitionProvider(request)),
                child: const Text('다시 시도'),
              ),
            ],
          ),
          data: (ClubCompetitionResult result) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  const Expanded(
                    child: Text(
                      'Bowler Hidden · 개인전',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                  Chip(label: Text(event.competition!.mode?.label ?? '모드 미설정')),
                ],
              ),
              if (event.competition!.mode == ClubCompetitionMode.mini)
                const Text('미니 경기 · 시즌 포인트 미지급'),
              const SizedBox(height: 10),
              if (result.overall.isEmpty)
                const Text('아직 집계할 경기 점수가 없습니다.')
              else
                ...result.overall.map(
                  (ClubCompetitionRankingRow row) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(child: Text('${row.rank}')),
                    title: Text(row.name),
                    subtitle: Text(
                      '${row.scores.join(' · ')}  |  AVG ${row.average}',
                    ),
                    trailing: Text(
                      event.competition!.mode == ClubCompetitionMode.mini
                          ? '${row.total} / 시즌 포인트 미지급'
                          : '${row.total} / ${row.points}P',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              if (result.myPreview
                  case final ClubCompetitionPreview mine) ...<Widget>[
                const Divider(height: 28),
                Text(
                  '내 최근 기록 · 50게임 ${mine.recent50Average ?? '-'} / '
                  '12게임 ${mine.recent12Average ?? '-'}',
                ),
              ],
              if (result.participantPreview != null) ...<Widget>[
                const Divider(height: 28),
                const Text(
                  '그룹 준비 자료',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                ...result.participantPreview!.map(
                  (ClubCompetitionPreview item) => Text(
                    '${item.name} · 최근50 ${item.recent50Average ?? '-'} · '
                    '최근12 ${item.recent12Average ?? '-'}',
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  '기대점수와 그룹점수 공식은 정책 확정 후 적용됩니다.',
                  style: TextStyle(color: Colors.orangeAccent),
                ),
              ],
              if (event.canManage) ...<Widget>[
                const Divider(height: 28),
                FilledButton(
                  onPressed: _working
                      ? null
                      : () => _individualPublicationAction(
                          userId,
                          result.status == 'PUBLISHED' ? 'REOPEN' : 'PUBLISH',
                        ),
                  child: Text(
                    result.status == 'PUBLISHED' ? '결과 다시 열기' : '결과 발표',
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _individualPublicationAction(
    String userId,
    String action,
  ) async {
    await _action(
      userId,
      () => ref
          .read(clubEventsRepositoryProvider)
          .individualCompetitionAction(widget.teamId, widget.eventId, action),
    );
    ref.invalidate(clubSeasonRankingProvider);
  }

  Widget _adminCard(ClubEvent event, String userId) => Card(
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          const Text('관리', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          ...event.guests.map(
            (guest) => ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('게스트 · ${guest.name}'),
              trailing:
                  event.isLocked ||
                      ((event.competition?.type == ClubCompetitionType.team ||
                              event.competition?.type ==
                                  ClubCompetitionType.event) &&
                          event.competition?.status != 'ATTENDANCE_OPEN')
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.delete_outline_rounded),
                      onPressed: _working
                          ? null
                          : () => _action(
                              userId,
                              () => ref
                                  .read(clubEventsRepositoryProvider)
                                  .deleteGuest(
                                    widget.teamId,
                                    widget.eventId,
                                    guest.id,
                                  ),
                            ),
                    ),
            ),
          ),
          if (!event.isLocked &&
              ((event.competition?.type != ClubCompetitionType.team &&
                      event.competition?.type != ClubCompetitionType.event) ||
                  event.competition?.status == 'ATTENDANCE_OPEN'))
            OutlinedButton.icon(
              onPressed: _working ? null : () => _addGuest(userId),
              icon: const Icon(Icons.person_add_alt_1_rounded),
              label: const Text('게스트 추가'),
            ),
          if (event.laneDrawEnabled &&
              !event.isLocked &&
              (event.competition?.type != ClubCompetitionType.team ||
                  event.competition?.status == 'TEAMS_FINALIZED'))
            OutlinedButton.icon(
              onPressed: _working ? null : () => _configureSlots(event, userId),
              icon: const Icon(Icons.grid_view_rounded),
              label: Text('레인 좌석 설정 (${event.slots.length}개)'),
            ),
        ],
      ),
    ),
  );

  Widget _drawCard(ClubEvent event, String userId) => Card(
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          const Text('레인 추첨', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(
            '참가 ${event.counts.attending + event.counts.guests}명 · 좌석 ${event.slots.length}개',
          ),
          if (event.canManage &&
              event.laneDrawStatus == ClubEventDrawStatus.notStarted)
            FilledButton(
              onPressed: _working
                  ? null
                  : () => _action(
                      userId,
                      () => ref
                          .read(clubEventsRepositoryProvider)
                          .startDraw(widget.teamId, widget.eventId),
                    ),
              child: const Text('추첨 시작'),
            ),
          if (event.laneDrawMode == ClubEventDrawMode.individual &&
              event.laneDrawStatus == ClubEventDrawStatus.open) ...<Widget>[
            FilledButton(
              onPressed:
                  _working ||
                      event.myAssignment != null ||
                      event.myAttendance != ClubEventAttendance.attending
                  ? null
                  : () => _action(
                      userId,
                      () => ref
                          .read(clubEventsRepositoryProvider)
                          .drawMine(widget.teamId, widget.eventId),
                    ),
              child: Text(
                event.myAssignment == null
                    ? '내 레인 추첨'
                    : '내 레인 ${event.myAssignment!.label}',
              ),
            ),
            if (event.canManage)
              ...event.guests.map((guest) {
                final bool assigned = event.assignments.any(
                  (item) => item.guestId == guest.id,
                );
                return OutlinedButton(
                  onPressed: _working || assigned
                      ? null
                      : () => _action(
                          userId,
                          () => ref
                              .read(clubEventsRepositoryProvider)
                              .drawGuest(
                                widget.teamId,
                                widget.eventId,
                                guest.id,
                              ),
                        ),
                  child: Text(
                    assigned ? '${guest.name} 배정 완료' : '${guest.name} 대신 추첨',
                  ),
                );
              }),
            if (event.canManage)
              OutlinedButton(
                onPressed: _working
                    ? null
                    : () => _action(
                        userId,
                        () => ref
                            .read(clubEventsRepositoryProvider)
                            .assignRemaining(widget.teamId, widget.eventId),
                      ),
                child: const Text('남은 참가자 일괄 배정'),
              ),
          ],
        ],
      ),
    ),
  );

  Widget _resultsCard(ClubEvent event) {
    final Map<int, List<ClubEventLaneAssignment>> groups =
        <int, List<ClubEventLaneAssignment>>{};
    for (final assignment in event.assignments) {
      groups
          .putIfAbsent(assignment.laneNumber, () => <ClubEventLaneAssignment>[])
          .add(assignment);
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Text('추첨 결과', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            ...groups.entries.map(
              (entry) => ExpansionTile(
                initiallyExpanded: true,
                title: Text('${entry.key}번 레인'),
                children: entry.value.map((assignment) {
                  final bool mine = event.myAssignment?.id == assignment.id;
                  return ListTile(
                    selected: mine,
                    title: Text(assignment.name),
                    trailing: Text(assignment.label),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _action(String userId, Future<void> Function() call) async {
    setState(() => _working = true);
    try {
      await call();
      if (mounted) {
        invalidateClubEvents(ref, userId, widget.teamId, widget.eventId);
      }
    } on Object catch (error) {
      if (mounted) _showError(error);
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _addGuest(String userId) async {
    final controller = TextEditingController();
    final String? name = await showDialog<String>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('게스트 추가'),
        content: TextField(
          controller: controller,
          maxLength: 40,
          decoration: const InputDecoration(labelText: '이름'),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('추가'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (name != null && name.isNotEmpty) {
      await _action(
        userId,
        () => ref
            .read(clubEventsRepositoryProvider)
            .addGuest(widget.teamId, widget.eventId, name),
      );
    }
  }

  Future<void> _configureSlots(ClubEvent event, String userId) async {
    final Set<String> selected = event.slots
        .map((slot) => '${slot.laneNumber}:${slot.position}')
        .toSet();
    final result = await showDialog<Set<String>>(
      context: context,
      builder: (BuildContext context) => StatefulBuilder(
        builder: (BuildContext context, StateSetter setDialogState) =>
            AlertDialog(
              title: const Text('레인 좌석 선택'),
              content: SizedBox(
                width: 420,
                height: 480,
                child: Column(
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        TextButton(
                          onPressed: () => setDialogState(() {
                            selected
                              ..clear()
                              ..addAll(<String>[
                                for (int lane = 1; lane <= 24; lane++)
                                  for (
                                    int position = 1;
                                    position <= 6;
                                    position++
                                  )
                                    '$lane:$position',
                              ]);
                          }),
                          child: const Text('전체 선택'),
                        ),
                        TextButton(
                          onPressed: () => setDialogState(selected.clear),
                          child: const Text('전체 해제'),
                        ),
                        const Spacer(),
                        Text('${selected.length}개'),
                      ],
                    ),
                    Expanded(
                      child: ListView.builder(
                        itemCount: 24,
                        itemBuilder: (_, int laneIndex) {
                          final int lane = laneIndex + 1;
                          return ExpansionTile(
                            title: Text('$lane번 레인'),
                            children: List<Widget>.generate(6, (
                              int positionIndex,
                            ) {
                              final int position = positionIndex + 1;
                              final String key = '$lane:$position';
                              return CheckboxListTile(
                                title: Text('$lane-$position'),
                                value: selected.contains(key),
                                onChanged: (bool? checked) => setDialogState(
                                  () => checked == true
                                      ? selected.add(key)
                                      : selected.remove(key),
                                ),
                              );
                            }),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
              actions: <Widget>[
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('취소'),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(context, selected),
                  child: const Text('저장'),
                ),
              ],
            ),
      ),
    );
    if (result == null) return;
    final slots =
        result.map((String key) {
          final parts = key.split(':');
          return (
            laneNumber: int.parse(parts[0]),
            position: int.parse(parts[1]),
          );
        }).toList()..sort(
          (a, b) => a.laneNumber != b.laneNumber
              ? a.laneNumber.compareTo(b.laneNumber)
              : a.position.compareTo(b.position),
        );
    await _action(
      userId,
      () => ref
          .read(clubEventsRepositoryProvider)
          .replaceLaneSlots(widget.teamId, widget.eventId, slots),
    );
  }

  Future<void> _delete(String userId) async {
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('일정 삭제'),
        content: const Text('이 일정과 참석/추첨 정보를 삭제할까요?'),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('삭제'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref
          .read(clubEventsRepositoryProvider)
          .deleteEvent(widget.teamId, widget.eventId);
      if (!mounted) return;
      invalidateClubEvents(ref, userId, widget.teamId);
      context.go('/club/${Uri.encodeComponent(widget.teamId)}/events');
    } on Object catch (error) {
      if (mounted) _showError(error);
    }
  }

  void _showError(Object error) {
    final String message = error is ApiException
        ? error.userMessage
        : clubErrorMessage(error);
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }
}
