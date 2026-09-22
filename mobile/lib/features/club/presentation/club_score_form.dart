import 'package:bowlingmanager_mobile/features/club/domain/club_management_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:flutter/material.dart';

class ClubScoreFormValue {
  const ClubScoreFormValue({
    required this.date,
    required this.gameType,
    required this.memo,
    required this.participants,
  });

  final String date;
  final String gameType;
  final String? memo;
  final List<ClubParticipantDraft> participants;
}

class ClubScoreForm extends StatefulWidget {
  const ClubScoreForm({
    required this.members,
    required this.initialDate,
    required this.initialGameType,
    required this.initialMemo,
    required this.initialParticipants,
    required this.isSaving,
    required this.submitLabel,
    required this.onSubmit,
    super.key,
  });

  final List<ClubMember> members;
  final String initialDate;
  final String initialGameType;
  final String? initialMemo;
  final List<ClubParticipantDraft> initialParticipants;
  final bool isSaving;
  final String submitLabel;
  final Future<void> Function(ClubScoreFormValue value) onSubmit;

  @override
  State<ClubScoreForm> createState() => _ClubScoreFormState();
}

class _ClubScoreFormState extends State<ClubScoreForm> {
  late String _date;
  late String _gameType;
  late String _memo;
  late List<_ParticipantInput> _participants;
  String? _error;

  @override
  void initState() {
    super.initState();
    _date = widget.initialDate;
    _gameType = widget.initialGameType;
    _memo = widget.initialMemo ?? '';
    _participants = widget.initialParticipants
        .map(_ParticipantInput.fromDraft)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        OutlinedButton.icon(
          key: const Key('management-date'),
          onPressed: widget.isSaving ? null : _pickDate,
          icon: const Icon(Icons.calendar_month_outlined),
          label: Text(_date),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          key: const Key('management-game-type'),
          initialValue: _gameType,
          decoration: const InputDecoration(labelText: '게임방식'),
          items: clubGameTypes
              .map(
                (String type) =>
                    DropdownMenuItem(value: type, child: Text(type)),
              )
              .toList(),
          onChanged: widget.isSaving
              ? null
              : (String? value) =>
                    setState(() => _gameType = value ?? _gameType),
        ),
        const SizedBox(height: 12),
        TextFormField(
          key: const Key('management-memo'),
          initialValue: _memo,
          maxLength: 500,
          decoration: const InputDecoration(labelText: '메모 (선택)'),
          onChanged: (String value) => _memo = value,
          enabled: !widget.isSaving,
        ),
        const SizedBox(height: 16),
        for (int index = 0; index < _participants.length; index++) ...<Widget>[
          _ParticipantCard(
            key: ValueKey(_participants[index].key),
            participant: _participants[index],
            index: index,
            enabled: !widget.isSaving,
            onChanged: () => setState(() {}),
            onRemove: () => setState(() => _participants.removeAt(index)),
          ),
          const SizedBox(height: 12),
        ],
        OutlinedButton.icon(
          key: const Key('management-add-participant'),
          onPressed: widget.isSaving ? null : _addParticipant,
          icon: const Icon(Icons.person_add_alt_1_outlined),
          label: const Text('참가자 추가'),
        ),
        if (_error != null) ...<Widget>[
          const SizedBox(height: 12),
          Text(
            _error!,
            key: const Key('management-form-error'),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.redAccent),
          ),
        ],
        const SizedBox(height: 20),
        FilledButton(
          key: const Key('management-save'),
          onPressed: widget.isSaving ? null : _submit,
          child: widget.isSaving
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(widget.submitLabel),
        ),
      ],
    );
  }

  Future<void> _pickDate() async {
    final DateTime current = DateTime.tryParse(_date) ?? DateTime.now();
    final DateTime? selected = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (selected == null || !mounted) return;
    setState(() => _date = _formatDate(selected));
  }

  Future<void> _addParticipant() async {
    final Object? selected = await showModalBottomSheet<Object>(
      context: context,
      builder: (BuildContext context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: <Widget>[
            const ListTile(title: Text('참가자 선택')),
            for (final ClubMember member in widget.members)
              ListTile(
                title: Text(member.name),
                subtitle: Text(member.role.label),
                onTap: () => Navigator.pop(context, member),
              ),
            ListTile(
              leading: const Icon(Icons.person_outline),
              title: const Text('비회원 추가'),
              onTap: () => Navigator.pop(context, 'guest'),
            ),
          ],
        ),
      ),
    );
    if (!mounted || selected == null) return;
    if (selected is ClubMember &&
        _participants.any((item) => item.memberId == selected.id)) {
      setState(() => _error = '같은 참가자를 중복으로 추가할 수 없습니다.');
      return;
    }
    setState(() {
      _error = null;
      _participants.add(
        selected is ClubMember
            ? _ParticipantInput(
                memberId: selected.id,
                name: selected.name,
                scores: <String>[''],
              )
            : _ParticipantInput(memberId: null, name: '', scores: <String>['']),
      );
    });
  }

  Future<void> _submit() async {
    final List<ClubParticipantDraft> parsed = <ClubParticipantDraft>[];
    final Set<String> keys = <String>{};
    if (_participants.isEmpty) {
      setState(() => _error = '참가자를 한 명 이상 추가해주세요.');
      return;
    }
    for (final _ParticipantInput participant in _participants) {
      final String name = participant.name.trim();
      if (name.isEmpty ||
          name.length > 100 ||
          participant.scores.isEmpty ||
          participant.scores.length > 12) {
        setState(() => _error = '참가자 이름과 점수를 확인해주세요.');
        return;
      }
      final String key = participant.memberId == null
          ? 'guest:$name'
          : 'member:${participant.memberId}';
      if (!keys.add(key)) {
        setState(() => _error = '같은 참가자를 중복으로 추가할 수 없습니다.');
        return;
      }
      final List<ClubScoreDraft> scores = <ClubScoreDraft>[];
      for (final String text in participant.scores) {
        final int? score = int.tryParse(text.trim());
        if (score == null || score < 0 || score > 300) {
          setState(() => _error = '모든 점수는 0에서 300 사이의 정수여야 합니다.');
          return;
        }
        scores.add(ClubScoreDraft(value: score));
      }
      parsed.add(
        ClubParticipantDraft(
          memberId: participant.memberId,
          name: name,
          scores: scores,
        ),
      );
    }
    setState(() => _error = null);
    await widget.onSubmit(
      ClubScoreFormValue(
        date: _date,
        gameType: _gameType,
        memo: _memo.trim().isEmpty ? null : _memo.trim(),
        participants: parsed,
      ),
    );
  }
}

class _ParticipantInput {
  _ParticipantInput({
    required this.memberId,
    required this.name,
    required this.scores,
  }) : key = UniqueKey();

  factory _ParticipantInput.fromDraft(ClubParticipantDraft draft) =>
      _ParticipantInput(
        memberId: draft.memberId,
        name: draft.name,
        scores: draft.scores.map((score) => '${score.value}').toList(),
      );

  final Key key;
  final String? memberId;
  String name;
  final List<String> scores;
}

class _ParticipantCard extends StatelessWidget {
  const _ParticipantCard({
    required this.participant,
    required this.index,
    required this.enabled,
    required this.onChanged,
    required this.onRemove,
    super.key,
  });

  final _ParticipantInput participant;
  final int index;
  final bool enabled;
  final VoidCallback onChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: participant.memberId == null
                      ? TextFormField(
                          key: Key('participant-name-$index'),
                          initialValue: participant.name,
                          enabled: enabled,
                          decoration: const InputDecoration(
                            labelText: '비회원 이름',
                          ),
                          onChanged: (String value) => participant.name = value,
                        )
                      : Text(
                          participant.name,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                ),
                IconButton(
                  key: Key('participant-remove-$index'),
                  onPressed: enabled ? onRemove : null,
                  tooltip: '참가자 제거',
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: <Widget>[
                for (
                  int scoreIndex = 0;
                  scoreIndex < participant.scores.length;
                  scoreIndex++
                )
                  SizedBox(
                    width: 82,
                    child: TextFormField(
                      key: Key('participant-$index-score-$scoreIndex'),
                      initialValue: participant.scores[scoreIndex],
                      enabled: enabled,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: '${scoreIndex + 1}G',
                      ),
                      onChanged: (String value) =>
                          participant.scores[scoreIndex] = value,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: <Widget>[
                TextButton.icon(
                  key: Key('participant-add-game-$index'),
                  onPressed: enabled && participant.scores.length < 12
                      ? () {
                          participant.scores.add('');
                          onChanged();
                        }
                      : null,
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('게임 추가'),
                ),
                const Spacer(),
                TextButton.icon(
                  key: Key('participant-remove-game-$index'),
                  onPressed: enabled && participant.scores.length > 1
                      ? () {
                          participant.scores.removeLast();
                          onChanged();
                        }
                      : null,
                  icon: const Icon(Icons.remove_rounded),
                  label: const Text('게임 제거'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

String formatClubDate(DateTime value) {
  String two(int part) => part.toString().padLeft(2, '0');
  return '${value.year}-${two(value.month)}-${two(value.day)}';
}

String _formatDate(DateTime value) => formatClubDate(value);
