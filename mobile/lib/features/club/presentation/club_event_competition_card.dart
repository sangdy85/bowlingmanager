import 'dart:async';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_competition_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ClubEventCompetitionCard extends ConsumerStatefulWidget {
  const ClubEventCompetitionCard({
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
  ConsumerState<ClubEventCompetitionCard> createState() =>
      _ClubEventCompetitionCardState();
}

class _ClubEventCompetitionCardState
    extends ConsumerState<ClubEventCompetitionCard>
    with WidgetsBindingObserver {
  Timer? _poll;
  bool _shouldPoll = false;
  bool _working = false;
  final Set<String> _selected = <String>{};
  bool _selectionInitialized = false;

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
    _poll?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant ClubEventCompetitionCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.userId != widget.userId ||
        oldWidget.teamId != widget.teamId ||
        oldWidget.eventId != widget.eventId) {
      _selectionInitialized = false;
      _selected.clear();
      _poll?.cancel();
      _poll = null;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _syncPolling(_shouldPoll);
    } else {
      _poll?.cancel();
      _poll = null;
    }
  }

  void _syncPolling(bool enabled) {
    _shouldPoll = enabled;
    if (!enabled) {
      _poll?.cancel();
      _poll = null;
    } else {
      _poll ??= Timer.periodic(const Duration(seconds: 3), (_) {
        if (mounted) ref.invalidate(clubEventCompetitionProvider(_request));
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(clubEventCompetitionProvider(_request));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _syncPolling(state.value?.polling == true);
    });
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: state.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(clubErrorMessage(error)),
              TextButton(
                onPressed: () =>
                    ref.invalidate(clubEventCompetitionProvider(_request)),
                child: const Text('다시 시도'),
              ),
            ],
          ),
          data: _content,
        ),
      ),
    );
  }

  Widget _content(ClubEventCompetitionState state) {
    if (!_selectionInitialized && state.voting != null) {
      _selectionInitialized = true;
      _selected
        ..clear()
        ..addAll(state.voting!.mySelections);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            const Expanded(
              child: Text(
                'Bowler Hidden · 이벤트전',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
            Chip(label: Text(widget.competitionMode?.label ?? '모드 미설정')),
          ],
        ),
        if (widget.competitionMode == ClubCompetitionMode.mini)
          const Text('미니 경기 · 시즌 포인트 미지급'),
        const SizedBox(height: 6),
        Text('진행 단계: ${_statusLabel(state.status)}'),
        if (state.gameCount != null) Text('경기 ${state.gameCount}게임'),
        if (state.voting != null) ...<Widget>[
          const SizedBox(height: 8),
          Text(
            '투표 제출 ${state.voting!.submittedCount}명 · 미제출 ${state.voting!.pendingCount}명',
          ),
        ],
        if (state.status == 'VOTING_OPEN' &&
            state.isParticipant &&
            (state.voting?.mySelections.isEmpty ?? true)) ...<Widget>[
          const Divider(height: 28),
          Text(
            '남은 시간 ${_remaining(state.voteCloseAt)}',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          const Text('다른 참가자 정확히 3명을 선택하세요.'),
          ...state.participants.map((participant) {
            final bool self =
                participant.participantId == state.myParticipantId;
            return CheckboxListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              value: _selected.contains(participant.participantId),
              title: Text(participant.name),
              subtitle: self ? const Text('본인') : null,
              onChanged: self || _working
                  ? null
                  : (checked) => setState(() {
                      if (checked == true && _selected.length < 3) {
                        _selected.add(participant.participantId);
                      } else if (checked == false) {
                        _selected.remove(participant.participantId);
                      }
                    }),
            );
          }),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _working || _selected.length != 3
                  ? null
                  : () => _run(<String, dynamic>{
                      'action': 'VOTE',
                      'selectedParticipantIds': _selected.toList(),
                    }),
              child: Text('투표 완료 (${_selected.length} / 3)'),
            ),
          ),
        ],
        if (state.canManage) ...<Widget>[
          const SizedBox(height: 12),
          if (state.status == 'VOTING_OPEN')
            OutlinedButton.icon(
              onPressed: _working ? null : () => _proxyVote(state),
              icon: const Icon(Icons.how_to_vote_outlined),
              label: const Text('대리 투표'),
            ),
          ..._managerActions(state),
        ],
        if (state.reveal case final ClubEventRevealState reveal) ...<Widget>[
          if (reveal.totalCount > 0) ...<Widget>[
            const Divider(height: 28),
            Text('개표 ${reveal.revealedCount} / ${reveal.totalCount}'),
            LinearProgressIndicator(
              value: reveal.totalCount == 0
                  ? 0
                  : reveal.revealedCount / reveal.totalCount,
            ),
            if (reveal.nextName != null) Text('다음: ${reveal.nextName}'),
            ...reveal.revealed.map(
              (row) => ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(row.name),
                subtitle: Text(
                  '본인 ${row.actualScore} · 득표 ${row.voteCount} · '
                  '1표당 ${_score(row.shareScore)}${row.voterNames.isEmpty ? '' : '\n선택: ${row.voterNames.join(', ')}'}',
                ),
              ),
            ),
          ],
        ],
        if (state.finalPreview != null) ...<Widget>[
          const Divider(height: 28),
          const Text(
            '관리자 최종 결과',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          ..._ranking(state.finalPreview!),
        ],
        if (state.status == 'PUBLISHED') ...<Widget>[
          const Divider(height: 28),
          const Text(
            '이벤트전 결과 발표',
            style: TextStyle(fontWeight: FontWeight.w800),
          ),
          if (state.myResult case final ClubEventResultRow mine) ...<Widget>[
            Text(
              '내 순위 ${mine.rank ?? '-'}위 · ${_score(mine.finalScore)}점 · '
              '${widget.competitionMode == ClubCompetitionMode.mini ? '시즌 포인트 미지급' : '+${mine.seasonPoint}P'}',
            ),
            Text('본인 ${mine.actualScore} · 투표 보너스 ${_score(mine.voteBonus)}'),
            if (mine.selections.isNotEmpty)
              Text(
                '내 선택: ${mine.selections.map((item) => '${item.name ?? '-'} +${_score(item.shareScore)}').join(' · ')}',
              ),
          ],
          if (state.ranking != null) ..._ranking(state.ranking!),
        ],
      ],
    );
  }

  List<Widget> _managerActions(ClubEventCompetitionState state) {
    switch (state.status) {
      case 'ATTENDANCE_OPEN':
        return <Widget>[
          FilledButton(
            onPressed: _working
                ? null
                : () => _run(<String, dynamic>{'action': 'PREPARE'}),
            child: const Text('참석 마감 및 참가자 확정'),
          ),
        ];
      case 'VOTING_CLOSED':
        return <Widget>[
          FilledButton(
            onPressed: _working || state.scoreComplete != true
                ? null
                : _startReveal,
            child: Text(
              state.scoreComplete == true ? '투표 결과 확인' : '점수 입력을 완료해주세요',
            ),
          ),
        ];
      case 'REVEALING':
        return <Widget>[
          FilledButton(
            onPressed: _working
                ? null
                : () => _run(<String, dynamic>{'action': 'REVEAL_NEXT'}),
            child: const Text('다음 참가자 개표'),
          ),
        ];
      case 'FINAL_READY':
        return <Widget>[
          FilledButton(
            onPressed: _working ? null : _publish,
            child: const Text('결과 발표'),
          ),
        ];
      case 'PUBLISHED':
        return <Widget>[
          OutlinedButton(
            onPressed: _working
                ? null
                : () => _run(<String, dynamic>{'action': 'REOPEN'}),
            child: const Text('발표 결과 다시 열기'),
          ),
        ];
      default:
        return const <Widget>[];
    }
  }

  Iterable<Widget> _ranking(List<ClubEventResultRow> rows) => rows.map(
    (row) => ListTile(
      dense: true,
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(child: Text(row.rank?.toString() ?? '-')),
      title: Text(row.name),
      subtitle: Text(
        '본인 ${row.actualScore} · 보너스 ${_score(row.voteBonus)} · 득표 ${row.voteCount}'
        '${row.selections.isEmpty ? '' : '\n선택 ${row.selections.map((item) => '${item.name ?? '-'} +${_score(item.shareScore)}').join(' · ')}'}',
      ),
      trailing: Text(
        '${_score(row.finalScore)}\n'
        '${widget.competitionMode == ClubCompetitionMode.mini ? '시즌 포인트 미지급' : '+${row.seasonPoint}P'}',
        textAlign: TextAlign.end,
      ),
    ),
  );

  Future<void> _startReveal() async {
    String nonVoter = 'INCLUDE_ACTUAL_ONLY';
    String tie = 'ACTUAL_SCORE_THEN_ID';
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('개표 정책 확인'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              DropdownButtonFormField<String>(
                initialValue: nonVoter,
                decoration: const InputDecoration(labelText: '미투표자 처리'),
                items: const <DropdownMenuItem<String>>[
                  DropdownMenuItem(
                    value: 'INCLUDE_ACTUAL_ONLY',
                    child: Text('실제 점수만으로 순위 참여'),
                  ),
                  DropdownMenuItem(
                    value: 'EXCLUDE_FROM_RANKING',
                    child: Text('최종 순위 제외'),
                  ),
                ],
                onChanged: (value) =>
                    setDialogState(() => nonVoter = value ?? nonVoter),
              ),
              DropdownButtonFormField<String>(
                initialValue: tie,
                decoration: const InputDecoration(labelText: '동점 처리'),
                items: const <DropdownMenuItem<String>>[
                  DropdownMenuItem(
                    value: 'ACTUAL_SCORE_THEN_ID',
                    child: Text('실제 점수 우선'),
                  ),
                  DropdownMenuItem(
                    value: 'STABLE_ID_ONLY',
                    child: Text('고정 참가자 ID 순서'),
                  ),
                ],
                onChanged: (value) => setDialogState(() => tie = value ?? tie),
              ),
            ],
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('취소'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('개표 시작'),
            ),
          ],
        ),
      ),
    );
    if (confirmed == true) {
      await _run(<String, dynamic>{
        'action': 'START_REVEAL',
        'nonVoterPolicy': nonVoter,
        'tieBreakPolicy': tie,
      });
    }
  }

  Future<void> _proxyVote(ClubEventCompetitionState state) async {
    final Set<String> submitted =
        state.voting?.submittedParticipantIds.toSet() ?? <String>{};
    final voters = state.participants
        .where((participant) => !submitted.contains(participant.participantId))
        .toList();
    final ClubEventCompetitionParticipant? voter =
        await showDialog<ClubEventCompetitionParticipant>(
          context: context,
          builder: (BuildContext context) => SimpleDialog(
            title: const Text('누구의 투표를 입력하시겠습니까?'),
            children: voters
                .map(
                  (participant) => SimpleDialogOption(
                    onPressed: () => Navigator.pop(context, participant),
                    child: Text(
                      participant.participantKind == 'GUEST'
                          ? '게스트 · ${participant.name}'
                          : participant.name,
                    ),
                  ),
                )
                .toList(),
          ),
        );
    if (voter == null || !mounted) return;
    final Set<String> selections = <String>{};
    final List<String>? selected = await showDialog<List<String>>(
      context: context,
      builder: (BuildContext context) => StatefulBuilder(
        builder: (BuildContext context, StateSetter setDialogState) =>
            AlertDialog(
              title: Text('${voter.name} 대리 투표'),
              content: SizedBox(
                width: 420,
                child: ListView(
                  shrinkWrap: true,
                  children: state.participants.map((participant) {
                    final bool self =
                        participant.participantId == voter.participantId;
                    return CheckboxListTile(
                      value: selections.contains(participant.participantId),
                      title: Text(participant.name),
                      subtitle: self ? const Text('본인') : null,
                      onChanged: self
                          ? null
                          : (bool? checked) => setDialogState(() {
                              if (checked == true && selections.length < 3) {
                                selections.add(participant.participantId);
                              } else if (checked == false) {
                                selections.remove(participant.participantId);
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
                  onPressed: selections.length == 3
                      ? () => Navigator.pop(context, selections.toList())
                      : null,
                  child: const Text('대리 투표 완료'),
                ),
              ],
            ),
      ),
    );
    if (selected == null || !mounted) return;
    await _run(<String, dynamic>{
      'action': 'PROXY_VOTE',
      'voterParticipantId': voter.participantId,
      'selectedParticipantIds': selected,
    });
  }

  Future<void> _publish() async {
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('결과 발표'),
        content: const Text('결과를 발표하면 참가자들이 최종 순위를 확인할 수 있습니다.'),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('발표'),
          ),
        ],
      ),
    );
    if (confirmed == true) await _run(<String, dynamic>{'action': 'PUBLISH'});
  }

  Future<void> _run(Map<String, dynamic> action) async {
    setState(() => _working = true);
    try {
      await ref
          .read(clubEventsRepositoryProvider)
          .eventCompetitionAction(widget.teamId, widget.eventId, action);
      if (mounted) {
        ref.invalidate(clubEventCompetitionProvider(_request));
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

String _remaining(DateTime? closeAt) {
  if (closeAt == null) return '--:--';
  final seconds = closeAt
      .difference(DateTime.now().toUtc())
      .inSeconds
      .clamp(0, 99 * 60 + 59);
  return '${(seconds ~/ 60).toString().padLeft(2, '0')}:${(seconds % 60).toString().padLeft(2, '0')}';
}

String _score(num? value) => value == null
    ? '-'
    : value % 1 == 0
    ? value.toStringAsFixed(0)
    : value.toStringAsFixed(2);
String _statusLabel(String status) => switch (status) {
  'ATTENDANCE_OPEN' => '참석 조사',
  'EVENT_READY' || 'SCHEDULED' => '경기 시작 대기',
  'VOTING_OPEN' => '투표 진행',
  'VOTING_CLOSED' => '투표 마감',
  'REVEALING' => '순차 개표',
  'FINAL_READY' => '최종 결과 확인',
  'PUBLISHED' => '결과 발표',
  _ => status,
};
