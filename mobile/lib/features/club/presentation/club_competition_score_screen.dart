import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/capture/application/capture_providers.dart';
import 'package:bowlingmanager_mobile/features/capture/data/capture_image_picker.dart';
import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_competition_score_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/competition_score_ocr.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ClubCompetitionScoreScreen extends ConsumerStatefulWidget {
  const ClubCompetitionScoreScreen({
    required this.teamId,
    required this.eventId,
    super.key,
  });

  final String teamId;
  final String eventId;

  @override
  ConsumerState<ClubCompetitionScoreScreen> createState() =>
      _ClubCompetitionScoreScreenState();
}

class _ClubCompetitionScoreScreenState
    extends ConsumerState<ClubCompetitionScoreScreen> {
  final Map<String, List<TextEditingController>> _controllers =
      <String, List<TextEditingController>>{};
  String? _initializedEventId;
  bool _working = false;
  String? _message;

  @override
  void dispose() {
    _disposeControllers();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final request = (
      userId: user.id,
      teamId: widget.teamId,
      eventId: widget.eventId,
    );
    final provider = clubCompetitionScoresProvider(request);
    return Scaffold(
      appBar: AppBar(title: const Text('경기 점수 입력')),
      body: ref
          .watch(provider)
          .when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, _) => Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Text(_errorMessage(error)),
                  FilledButton(
                    onPressed: () => ref.invalidate(provider),
                    child: const Text('다시 시도'),
                  ),
                ],
              ),
            ),
            data: (entry) {
              _initialize(entry);
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                children: <Widget>[
                  Text(entry.teamName),
                  const SizedBox(height: 4),
                  Text(
                    entry.title,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${entry.date} · ${_typeLabel(entry.competitionType)} · ${_modeLabel(entry.competitionMode)} · ${entry.gameCount}게임',
                  ),
                  if (entry.readOnly) ...<Widget>[
                    const SizedBox(height: 12),
                    const Text(
                      '발표된 경기의 점수는 읽기 전용입니다.',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ],
                  const SizedBox(height: 16),
                  if (!entry.readOnly)
                    OutlinedButton.icon(
                      key: const Key('competition-score-ocr'),
                      onPressed: _working ? null : () => _applyOcr(entry),
                      icon: const Icon(Icons.document_scanner_outlined),
                      label: const Text('점수판 OCR로 입력'),
                    ),
                  const SizedBox(height: 12),
                  ...entry.participants.map(
                    (participant) => _participantCard(entry, participant),
                  ),
                  if (_message != null) ...<Widget>[
                    const SizedBox(height: 8),
                    Text(
                      _message!,
                      key: const Key('competition-score-message'),
                      textAlign: TextAlign.center,
                    ),
                  ],
                  const SizedBox(height: 16),
                  if (!entry.readOnly)
                    FilledButton.icon(
                      key: const Key('competition-score-save'),
                      onPressed: _working ? null : () => _save(entry, request),
                      icon: _working
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.save_outlined),
                      label: const Text('경기 점수 저장'),
                    ),
                ],
              );
            },
          ),
    );
  }

  Widget _participantCard(
    ClubCompetitionScoreEntry entry,
    ClubCompetitionScoreParticipant participant,
  ) {
    final controllers = _controllers[participant.participantId]!;
    final detail = participant.group != null
        ? '${participant.group}조'
        : participant.competitionTeamName ??
              (participant.participantKind == 'GUEST' ? '게스트' : '참가자');
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              participant.name,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            Text(detail),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: List<Widget>.generate(
                entry.gameCount,
                (index) => SizedBox(
                  width: 92,
                  child: TextFormField(
                    key: Key(
                      'competition-score-${participant.participantId}-$index',
                    ),
                    controller: controllers[index],
                    enabled: !entry.readOnly && !_working,
                    keyboardType: TextInputType.number,
                    inputFormatters: <TextInputFormatter>[
                      FilteringTextInputFormatter.digitsOnly,
                    ],
                    decoration: InputDecoration(labelText: '${index + 1}게임'),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _initialize(ClubCompetitionScoreEntry entry) {
    if (_initializedEventId == entry.eventId) return;
    _disposeControllers();
    for (final participant in entry.participants) {
      _controllers[participant.participantId] =
          List<TextEditingController>.generate(
            entry.gameCount,
            (index) => TextEditingController(
              text: index < participant.scores.length
                  ? '${participant.scores[index]}'
                  : '',
            ),
          );
    }
    _initializedEventId = entry.eventId;
  }

  Future<void> _applyOcr(ClubCompetitionScoreEntry entry) async {
    setState(() {
      _working = true;
      _message = null;
    });
    try {
      final CaptureImageData? image = await ref
          .read(captureImagePickerProvider)
          .pick(CaptureImageSource.gallery);
      if (image == null || !mounted) return;
      final players = await ref
          .read(captureRepositoryProvider)
          .analyze(widget.teamId, image);
      final result = matchCompetitionOcrPlayers(entry, players);
      for (final match in result.matches.entries) {
        final controllers = _controllers[match.key]!;
        for (var index = 0; index < entry.gameCount; index++) {
          controllers[index].text = '${match.value[index]}';
        }
      }
      if (mounted) {
        setState(
          () => _message = result.unmatchedNames.isEmpty
              ? 'OCR 점수를 참가자에게 적용했습니다.'
              : '확인이 필요한 OCR 항목: ${result.unmatchedNames.join(', ')}',
        );
      }
    } catch (error) {
      if (mounted) setState(() => _message = _errorMessage(error));
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  String _modeLabel(String? mode) => switch (mode) {
    'MINI' => 'MINI',
    'OFFICIAL' => 'OFFICIAL',
    _ => '모드 미설정',
  };

  Future<void> _save(
    ClubCompetitionScoreEntry entry,
    ClubEventRequest request,
  ) async {
    final participants = <Map<String, dynamic>>[];
    for (final participant in entry.participants) {
      final scores = _controllers[participant.participantId]!
          .map((controller) => int.tryParse(controller.text.trim()))
          .toList();
      if (scores.any((score) => score == null || score < 0 || score > 300)) {
        setState(() => _message = '모든 참가자의 경기 점수를 0~300으로 입력해주세요.');
        return;
      }
      participants.add(<String, dynamic>{
        'participantId': participant.participantId,
        'scores': scores.cast<int>(),
      });
    }
    setState(() {
      _working = true;
      _message = null;
    });
    try {
      await ref.read(clubEventsRepositoryProvider).saveCompetitionScores(
        widget.teamId,
        widget.eventId,
        <String, dynamic>{'participants': participants},
      );
      ref.invalidate(clubCompetitionScoresProvider(request));
      invalidateClubEvents(ref, request.userId, widget.teamId, widget.eventId);
      if (mounted) setState(() => _message = '경기 점수를 저장했습니다.');
    } catch (error) {
      if (mounted) setState(() => _message = _errorMessage(error));
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  void _disposeControllers() {
    for (final values in _controllers.values) {
      for (final controller in values) {
        controller.dispose();
      }
    }
    _controllers.clear();
  }
}

String _errorMessage(Object error) =>
    error is ApiException ? error.userMessage : '요청을 처리하지 못했습니다.';
String _typeLabel(String type) => switch (type) {
  'INDIVIDUAL' => '개인전',
  'TEAM' => '팀전',
  'EVENT' => '이벤트전',
  _ => type,
};
