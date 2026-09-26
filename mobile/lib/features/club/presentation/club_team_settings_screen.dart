import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubTeamSettingsScreen extends ConsumerStatefulWidget {
  const ClubTeamSettingsScreen({required this.teamId, super.key});
  final String teamId;
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
              onRetry: () => ref.refresh(provider.future),
            ),
          ),
          data: (ClubTeamProfile profile) {
            if (!_initialized) {
              _description.text = profile.description ?? '';
              _notice.text = profile.notice ?? '';
              _ranking = profile.bowlerHiddenEnabled
                  ? true
                  : profile.seasonRankingEnabled;
              final season = profile.activeSeason;
              if (season != null) {
                _seasonName.text = season.name;
                _start.text = _date(season.startDate);
                _end.text = _date(season.endDate);
                _mode = season.scoringMode;
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
                    const Text('팀 관리'),
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
                    TextField(
                      controller: _seasonName,
                      decoration: const InputDecoration(labelText: '시즌 이름'),
                    ),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: TextField(
                            controller: _start,
                            decoration: const InputDecoration(
                              labelText: '시작일 YYYY-MM-DD',
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: _end,
                            decoration: const InputDecoration(
                              labelText: '종료일 YYYY-MM-DD',
                            ),
                          ),
                        ),
                      ],
                    ),
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
                    if (profile.bowlerHiddenEnabled) ...<Widget>[
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
                        onPressed: profile.activeSeason == null
                            ? null
                            : () => context.push(
                                '/club/${Uri.encodeComponent(widget.teamId)}/manage/team/season-points',
                              ),
                        icon: const Icon(Icons.tune),
                        label: const Text('포인트 관리'),
                      ),
                    ],
                  ],
                ],
                const SizedBox(height: 18),
                FilledButton(
                  key: const Key('team-settings-save'),
                  onPressed: _saving ? null : () => _save(profile, request),
                  child: Text(_saving ? '저장 중...' : '저장'),
                ),
              ],
            );
          },
        );
  }

  Future<void> _save(
    ClubTeamProfile profile,
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
            if (profile.activeSeason != null) 'id': profile.activeSeason!.id,
            'name': _seasonName.text.trim(),
            'startDate': _start.text.trim(),
            'endDate': _end.text.trim(),
            'scoringMode': _mode,
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
      ref.invalidate(
        clubSeasonRankingProvider((
          userId: request.userId,
          teamId: request.teamId,
          seasonId: null,
          year: null,
          competitionType: 'ALL',
        )),
      );
      if (mounted) context.pop();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

String _date(DateTime value) =>
    '${value.year}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';

List<int> _formatPoints(List<ClubSeasonRankPoint> points) =>
    points.map((item) => item.points).toList();

List<Map<String, int>> _pointRows(List<int> points) =>
    List<Map<String, int>>.generate(
      points.length,
      (int index) => <String, int>{'rank': index + 1, 'points': points[index]},
    );

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
