import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  final _gameCount = TextEditingController(text: '4');
  List<List<int>> _teamGamePoints = _defaultTeamGamePoints(4);
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
      _competitionType = competition.type;
      _competitionMode = competition.mode ?? ClubCompetitionMode.official;
      if (competition.gameCount != null) {
        _gameCount.text = '${competition.gameCount}';
      }
      if (competition.type == ClubCompetitionType.team) {
        _teamGamePoints = competition.teamGamePointTables.isEmpty
            ? _defaultTeamGamePoints(competition.gameCount ?? 4)
            : competition.teamGamePointTables
                  .map(
                    (ClubTeamGamePointTable table) => table.points
                        .map((ClubRankPoint item) => item.points)
                        .toList(),
                  )
                  .toList();
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
                      _syncTeamGameCount();
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
                if (_competitionType == ClubCompetitionType.event ||
                    _competitionType == ClubCompetitionType.team) ...<Widget>[
                  TextFormField(
                    controller: _gameCount,
                    keyboardType: TextInputType.number,
                    inputFormatters: <TextInputFormatter>[
                      FilteringTextInputFormatter.digitsOnly,
                    ],
                    decoration: const InputDecoration(
                      labelText: '경기 게임 수',
                      helperText: '참가자별 완료 판정에 사용합니다. (1~12게임)',
                    ),
                    onChanged: (_) {
                      if (_competitionType == ClubCompetitionType.team) {
                        setState(_syncTeamGameCount);
                      }
                    },
                    validator: (String? value) {
                      final int? count = int.tryParse(value ?? '');
                      return count == null || count < 1 || count > 12
                          ? '1~12 사이의 게임 수를 입력해주세요.'
                          : null;
                    },
                  ),
                  if (_competitionType ==
                      ClubCompetitionType.event) ...<Widget>[
                    const SizedBox(height: 12),
                    const Text('참가자 확정 후 투표가 시작되며 마감 시각 이후에는 투표할 수 없습니다.'),
                    const SizedBox(height: 12),
                  ],
                ],
                if (_competitionType == ClubCompetitionType.team) ...<Widget>[
                  const SizedBox(height: 16),
                  const Text(
                    '게임별 팀전 포인트',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const Text('각 게임의 팀 순위에 따라 지급되며 당일 최종 팀 순위를 결정합니다.'),
                  const SizedBox(height: 8),
                  for (int game = 0; game < _teamGamePoints.length; game++)
                    _TeamGamePointEditor(
                      gameNumber: game + 1,
                      points: _teamGamePoints[game],
                      onChanged: (List<int> value) =>
                          setState(() => _teamGamePoints[game] = value),
                    ),
                ],
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
      rankPoints: const <ClubRankPoint>[],
      teamGamePointTables:
          bowlerHiddenEnabled &&
              _competitionEnabled &&
              _competitionType == ClubCompetitionType.team
          ? List<ClubTeamGamePointTable>.generate(
              _teamGamePoints.length,
              (int game) => ClubTeamGamePointTable(
                gameNumber: game + 1,
                points: List<ClubRankPoint>.generate(
                  _teamGamePoints[game].length,
                  (int rank) => ClubRankPoint(
                    rank: rank + 1,
                    points: _teamGamePoints[game][rank],
                  ),
                ),
              ),
            )
          : const <ClubTeamGamePointTable>[],
      competitionGameCount:
          bowlerHiddenEnabled &&
              _competitionEnabled &&
              (_competitionType == ClubCompetitionType.event ||
                  _competitionType == ClubCompetitionType.team)
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

  void _syncTeamGameCount() {
    final int? count = int.tryParse(_gameCount.text);
    if (count == null || count < 1 || count > 12) return;
    if (_teamGamePoints.length > count) {
      _teamGamePoints = _teamGamePoints.take(count).toList();
    } else {
      final defaults = _defaultTeamGamePoints(count);
      while (_teamGamePoints.length < count) {
        _teamGamePoints.add(defaults[_teamGamePoints.length]);
      }
    }
  }
}

List<List<int>> _defaultTeamGamePoints(int gameCount) =>
    List<List<int>>.generate(
      gameCount,
      (int index) => gameCount >= 4 && index == gameCount - 1
          ? <int>[6, 4, 2, 1]
          : <int>[5, 3, 2, 1],
    );

class _TeamGamePointEditor extends StatelessWidget {
  const _TeamGamePointEditor({
    required this.gameNumber,
    required this.points,
    required this.onChanged,
  });

  final int gameNumber;
  final List<int> points;
  final ValueChanged<List<int>> onChanged;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            '${gameNumber}G',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          for (int index = 0; index < points.length; index++)
            Row(
              children: <Widget>[
                SizedBox(width: 54, child: Text('${index + 1}위')),
                Expanded(
                  child: TextFormField(
                    key: ValueKey<String>(
                      'team-game-$gameNumber-rank-${index + 1}',
                    ),
                    initialValue: '${points[index]}',
                    keyboardType: TextInputType.number,
                    inputFormatters: <TextInputFormatter>[
                      FilteringTextInputFormatter.digitsOnly,
                    ],
                    decoration: const InputDecoration(labelText: '팀전 포인트'),
                    validator: (String? value) {
                      final int? point = int.tryParse(value ?? '');
                      return point == null || point < 0 || point > 1000
                          ? '0~1000 정수를 입력해주세요.'
                          : null;
                    },
                    onChanged: (String value) {
                      final int? point = int.tryParse(value);
                      if (point == null) return;
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
