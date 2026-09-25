import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubEventFormScreen extends ConsumerStatefulWidget {
  const ClubEventFormScreen({required this.teamId, this.eventId, super.key});
  final String teamId;
  final String? eventId;
  @override
  ConsumerState<ClubEventFormScreen> createState() =>
      _ClubEventFormScreenState();
}

class _ClubEventFormScreenState extends ConsumerState<ClubEventFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _date = TextEditingController();
  final _time = TextEditingController(text: '19:00');
  final _location = TextEditingController();
  String? _gameType;
  final _rankPoints = TextEditingController(text: '1:20, 2:17, 3:15');
  final _gameCount = TextEditingController(text: '4');
  bool _attendanceEnabled = true;
  bool _laneDrawEnabled = false;
  ClubEventDrawMode _mode = ClubEventDrawMode.bulk;
  bool _competitionEnabled = false;
  ClubCompetitionType _competitionType = ClubCompetitionType.individual;
  ClubCompetitionMode _competitionMode = ClubCompetitionMode.official;
  bool _saving = false;
  bool _initialized = false;

  @override
  void dispose() {
    _title.dispose();
    _date.dispose();
    _time.dispose();
    _location.dispose();
    _rankPoints.dispose();
    _gameCount.dispose();
    super.dispose();
  }

  void _initialize(ClubEvent event) {
    if (_initialized) return;
    _initialized = true;
    _title.text = event.title;
    _date.text = event.date;
    _time.text = event.time;
    _location.text = event.location;
    _gameType = event.gameType;
    _attendanceEnabled = event.attendanceEnabled;
    _laneDrawEnabled = event.laneDrawEnabled;
    _mode = event.laneDrawMode;
    _competitionEnabled = event.competition != null;
    if (event.competition case final ClubCompetitionConfig competition) {
      _rankPoints.text = competition.rankPoints
          .map((ClubRankPoint item) => '${item.rank}:${item.points}')
          .join(', ');
      _competitionType = competition.type;
      _competitionMode = competition.mode ?? ClubCompetitionMode.official;
      if (competition.gameCount != null) {
        _gameCount.text = '${competition.gameCount}';
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final AuthUser? user = ref.watch(authControllerProvider).user;
    final String? eventId = widget.eventId;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final bool bowlerHiddenEnabled =
        ref
            .watch(clubDetailProvider((userId: user.id, teamId: widget.teamId)))
            .value
            ?.bowlerHiddenEnabled ??
        false;
    if (eventId != null) {
      final request = (
        userId: user.id,
        teamId: widget.teamId,
        eventId: eventId,
      );
      final state = ref.watch(clubEventProvider(request));
      if (state.isLoading) {
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      }
      if (state.hasError) {
        return Scaffold(
          appBar: AppBar(),
          body: Center(child: Text(clubErrorMessage(state.error!))),
        );
      }
      _initialize(state.requireValue);
    } else if (!_initialized) {
      _initialized = true;
      final DateTime now = DateTime.now();
      _date.text =
          '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    }

    return Scaffold(
      appBar: AppBar(title: Text(eventId == null ? '일정 추가' : '일정 수정')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: <Widget>[
            _field(_title, '제목', 100),
            const SizedBox(height: 12),
            TextFormField(
              key: const Key('club-event-date'),
              controller: _date,
              readOnly: true,
              decoration: const InputDecoration(
                labelText: '날짜',
                suffixIcon: Icon(Icons.calendar_month_outlined),
              ),
              onTap: _pickDate,
              validator: (String? value) =>
                  value == null || value.isEmpty ? '날짜를 선택해주세요.' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              key: const Key('club-event-time'),
              controller: _time,
              readOnly: true,
              decoration: const InputDecoration(
                labelText: '시간',
                suffixIcon: Icon(Icons.schedule_outlined),
              ),
              onTap: _pickTime,
              validator: (String? value) =>
                  value == null || value.isEmpty ? '시간을 선택해주세요.' : null,
            ),
            const SizedBox(height: 12),
            _field(_location, '장소', 120),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              key: const Key('club-event-game-type'),
              initialValue: _gameType,
              decoration: const InputDecoration(labelText: '경기 유형'),
              items: const <DropdownMenuItem<String>>[
                DropdownMenuItem(value: '정기전', child: Text('정기전')),
                DropdownMenuItem(value: '벙개', child: Text('벙개')),
                DropdownMenuItem(value: '상주', child: Text('상주리그')),
                DropdownMenuItem(value: '교류전', child: Text('교류전')),
                DropdownMenuItem(value: '기타', child: Text('기타')),
              ],
              onChanged: (String? value) => setState(() => _gameType = value),
            ),
            SwitchListTile(
              title: const Text('참석 조사'),
              value: _attendanceEnabled,
              onChanged: _competitionEnabled
                  ? null
                  : (bool value) => setState(() => _attendanceEnabled = value),
            ),
            SwitchListTile(
              title: const Text('레인 추첨'),
              value: _laneDrawEnabled,
              onChanged:
                  _competitionEnabled &&
                      _competitionType == ClubCompetitionType.team
                  ? null
                  : (bool value) => setState(() => _laneDrawEnabled = value),
            ),
            if (_laneDrawEnabled)
              DropdownButtonFormField<ClubEventDrawMode>(
                initialValue: _mode,
                decoration: const InputDecoration(labelText: '추첨 방식'),
                items: ClubEventDrawMode.values
                    .map(
                      (item) => DropdownMenuItem(
                        value: item,
                        child: Text(item.label),
                      ),
                    )
                    .toList(),
                onChanged: (value) => setState(() => _mode = value ?? _mode),
              ),
            if (bowlerHiddenEnabled) ...<Widget>[
              const Divider(height: 32),
              SwitchListTile(
                key: const Key('bowler-hidden-competition-toggle'),
                title: const Text('Bowler Hidden 대회'),
                subtitle: const Text('개인전, 팀전 또는 이벤트전 운영 기능을 활성화합니다.'),
                value: _competitionEnabled,
                onChanged: (bool value) => setState(() {
                  _competitionEnabled = value;
                  if (value) {
                    _attendanceEnabled = true;
                    if (_competitionType == ClubCompetitionType.team) {
                      _laneDrawEnabled = true;
                    }
                  }
                }),
              ),
              if (_competitionEnabled)
                DropdownButtonFormField<ClubCompetitionType>(
                  initialValue: _competitionType,
                  decoration: const InputDecoration(labelText: '대회 방식'),
                  items: ClubCompetitionType.values
                      .map(
                        (ClubCompetitionType item) => DropdownMenuItem(
                          value: item,
                          child: Text(item.label),
                        ),
                      )
                      .toList(),
                  onChanged: (ClubCompetitionType? value) => setState(() {
                    _competitionType = value ?? _competitionType;
                    if (_competitionType == ClubCompetitionType.team) {
                      _laneDrawEnabled = true;
                    }
                  }),
                ),
              if (_competitionEnabled) ...<Widget>[
                const SizedBox(height: 12),
                SegmentedButton<ClubCompetitionMode>(
                  segments: ClubCompetitionMode.values
                      .map(
                        (item) =>
                            ButtonSegment(value: item, label: Text(item.label)),
                      )
                      .toList(),
                  selected: <ClubCompetitionMode>{_competitionMode},
                  onSelectionChanged: (value) =>
                      setState(() => _competitionMode = value.single),
                ),
                const SizedBox(height: 6),
                Text(
                  _competitionMode == ClubCompetitionMode.mini
                      ? '실제 경기와 동일하게 진행되지만 시즌 포인트는 지급되지 않습니다.'
                      : '경기 결과에 따라 시즌 포인트가 지급됩니다.',
                ),
                const SizedBox(height: 12),
                if (_competitionType == ClubCompetitionType.event) ...<Widget>[
                  TextFormField(
                    controller: _gameCount,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: '경기 게임 수',
                      helperText: '참가자별 완료 판정에 사용합니다. (1~12게임)',
                    ),
                    validator: (String? value) {
                      final int? count = int.tryParse(value ?? '');
                      return count == null || count < 1 || count > 12
                          ? '1~12 사이의 게임 수를 입력해주세요.'
                          : null;
                    },
                  ),
                  const SizedBox(height: 12),
                  const Text('투표는 경기 시작 시각부터 30분 동안 서버 시간 기준으로 진행됩니다.'),
                  const Text('계정이 없는 게스트는 V1 투표와 순위에서 제외됩니다.'),
                  const SizedBox(height: 12),
                ],
                TextFormField(
                  controller: _rankPoints,
                  decoration: InputDecoration(
                    labelText: _competitionType == ClubCompetitionType.team
                        ? '게임별 팀 순위 포인트'
                        : '개인 순위 포인트',
                    helperText: '예: 1:20, 2:17, 3:15 · 미정의 순위는 0점',
                  ),
                  validator: (String? value) {
                    try {
                      _parseRankPoints(value ?? '');
                      return null;
                    } on FormatException {
                      return '순위:점수 형식의 중복 없는 0 이상 정수를 입력해주세요.';
                    }
                  },
                ),
              ],
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _saving
                  ? null
                  : () => _save(user.id, bowlerHiddenEnabled),
              child: Text(_saving ? '저장 중...' : '저장'),
            ),
          ],
        ),
      ),
    );
  }

  TextFormField _field(
    TextEditingController controller,
    String label,
    int max, {
    bool optional = false,
  }) => TextFormField(
    controller: controller,
    maxLength: max,
    decoration: InputDecoration(labelText: label),
    validator: (String? value) =>
        !optional && (value == null || value.trim().isEmpty)
        ? '필수 항목입니다.'
        : null,
  );

  Future<void> _save(String userId, bool bowlerHiddenEnabled) async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final draft = ClubEventDraft(
      title: _title.text.trim(),
      date: _date.text.trim(),
      time: _time.text.trim(),
      location: _location.text.trim(),
      gameType: _gameType,
      attendanceEnabled: _attendanceEnabled,
      laneDrawEnabled: _laneDrawEnabled,
      laneDrawMode: _mode,
      competitionEnabled: bowlerHiddenEnabled && _competitionEnabled,
      competitionType: bowlerHiddenEnabled && _competitionEnabled
          ? _competitionType
          : null,
      competitionMode: bowlerHiddenEnabled && _competitionEnabled
          ? _competitionMode
          : null,
      rankPoints: bowlerHiddenEnabled && _competitionEnabled
          ? _parseRankPoints(_rankPoints.text)
          : const <ClubRankPoint>[],
      competitionGameCount:
          bowlerHiddenEnabled &&
              _competitionEnabled &&
              _competitionType == ClubCompetitionType.event
          ? int.parse(_gameCount.text)
          : null,
    );
    try {
      final repository = ref.read(clubEventsRepositoryProvider);
      final String? eventId = widget.eventId;
      final event = eventId == null
          ? await repository.createEvent(widget.teamId, draft)
          : await repository.updateEvent(widget.teamId, eventId, draft);
      if (!mounted) return;
      invalidateClubEvents(ref, userId, widget.teamId, event.id);
      context.go(
        '/club/${Uri.encodeComponent(widget.teamId)}/events/${Uri.encodeComponent(event.id)}',
      );
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickDate() async {
    final DateTime now = DateTime.now();
    final DateTime initial = DateTime.tryParse(_date.text) ?? now;
    final DateTime? value = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(now.year - 5),
      lastDate: DateTime(now.year + 10),
    );
    if (value != null) {
      _date.text =
          '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
    }
  }

  Future<void> _pickTime() async {
    final List<String> parts = _time.text.split(':');
    final TimeOfDay initial = parts.length == 2
        ? TimeOfDay(
            hour: int.tryParse(parts[0]) ?? 19,
            minute: int.tryParse(parts[1]) ?? 0,
          )
        : const TimeOfDay(hour: 19, minute: 0);
    final TimeOfDay? value = await showTimePicker(
      context: context,
      initialTime: initial,
    );
    if (value != null) {
      _time.text =
          '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
    }
  }

  List<ClubRankPoint> _parseRankPoints(String value) {
    final Set<int> seen = <int>{};
    final List<ClubRankPoint> result = value
        .split(',')
        .where((String part) => part.trim().isNotEmpty)
        .map((String part) {
          final List<String> pieces = part.split(':');
          if (pieces.length != 2) throw const FormatException();
          final int? rank = int.tryParse(pieces[0].trim());
          final int? points = int.tryParse(pieces[1].trim());
          if (rank == null ||
              rank < 1 ||
              points == null ||
              points < 0 ||
              !seen.add(rank)) {
            throw const FormatException();
          }
          return ClubRankPoint(rank: rank, points: points);
        })
        .toList();
    result.sort(
      (ClubRankPoint left, ClubRankPoint right) =>
          left.rank.compareTo(right.rank),
    );
    return result;
  }
}
