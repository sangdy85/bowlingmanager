import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubLaneDrawScreen extends ConsumerStatefulWidget {
  const ClubLaneDrawScreen({
    required this.teamId,
    required this.eventId,
    super.key,
  });

  final String teamId;
  final String eventId;

  @override
  ConsumerState<ClubLaneDrawScreen> createState() => _ClubLaneDrawScreenState();
}

class _ClubLaneDrawScreenState extends ConsumerState<ClubLaneDrawScreen> {
  bool _drawing = false;
  int? _selectedCard;
  ClubEventLaneAssignment? _assignment;
  String? _error;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final request = (
      userId: user.id,
      teamId: widget.teamId,
      eventId: widget.eventId,
    );
    final state = ref.watch(clubEventProvider(request));
    return Scaffold(
      appBar: AppBar(title: const Text('레인 추첨')),
      body: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _ErrorView(
          message: clubErrorMessage(error),
          onRetry: () => ref.invalidate(clubEventProvider(request)),
        ),
        data: (event) {
          final assignment = _assignment ?? event.myAssignment;
          if (assignment != null) return _result(assignment);
          if (event.myAttendance != ClubEventAttendance.attending) {
            return const _MessageView(message: '참석한 회원만 레인을 추첨할 수 있습니다.');
          }
          if (event.laneDrawMode != ClubEventDrawMode.individual ||
              event.laneDrawStatus != ClubEventDrawStatus.open) {
            return const _MessageView(message: '아직 개별 레인 추첨이 시작되지 않았습니다.');
          }
          final remaining = event.slots.length - event.assignments.length;
          final cardCount = remaining.clamp(1, 8);
          return ListView(
            padding: const EdgeInsets.all(24),
            children: <Widget>[
              Text(
                '카드 한 장을 선택하세요',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              const Text(
                '카드는 추첨을 시작하는 버튼입니다. 레인 결과는 선택 순간 서버가 남은 좌석에서 공정하게 결정합니다.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: .72,
                ),
                itemCount: cardCount,
                itemBuilder: (context, index) => _DrawCard(
                  index: index,
                  selected: _selectedCard == index,
                  enabled: !_drawing,
                  onTap: () => _draw(user.id, index),
                ),
              ),
              if (_drawing) ...<Widget>[
                const SizedBox(height: 20),
                const Center(child: CircularProgressIndicator()),
                const SizedBox(height: 8),
                const Text('남은 레인에서 추첨하고 있습니다.', textAlign: TextAlign.center),
              ],
              if (_error != null) ...<Widget>[
                const SizedBox(height: 20),
                Text(_error!, textAlign: TextAlign.center),
                TextButton(
                  onPressed: _drawing || _selectedCard == null
                      ? null
                      : () => _draw(user.id, _selectedCard!),
                  child: const Text('다시 시도'),
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _result(ClubEventLaneAssignment assignment) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              const Icon(Icons.celebration_rounded, size: 52),
              const SizedBox(height: 12),
              const Text('내 레인', style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(
                assignment.label,
                key: const Key('lane-draw-result'),
                style: Theme.of(context).textTheme.displaySmall
                    ?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              Text('${assignment.label} 레인에 배정되었습니다.'),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: context.pop,
                child: const Text('일정으로 돌아가기'),
              ),
            ],
          ),
        ),
      ),
    ),
  );

  Future<void> _draw(String userId, int index) async {
    if (_drawing || _assignment != null) return;
    setState(() {
      _drawing = true;
      _selectedCard = index;
      _error = null;
    });
    try {
      final assignment = await ref
          .read(clubEventsRepositoryProvider)
          .drawMine(widget.teamId, widget.eventId);
      if (!mounted) return;
      setState(() => _assignment = assignment);
      invalidateClubEvents(ref, userId, widget.teamId, widget.eventId);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiException
            ? error.userMessage
            : clubErrorMessage(error);
      });
    } finally {
      if (mounted) setState(() => _drawing = false);
    }
  }
}

class _DrawCard extends StatelessWidget {
  const _DrawCard({
    required this.index,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });
  final int index;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: '추첨 카드 ${index + 1}',
    child: InkWell(
      key: Key('lane-draw-card-$index'),
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(16),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: selected
              ? Theme.of(context).colorScheme.primaryContainer
              : Theme.of(context).colorScheme.surfaceContainerHighest,
          border: Border.all(
            color: selected
                ? Theme.of(context).colorScheme.primary
                : Theme.of(context).dividerColor,
            width: selected ? 3 : 1,
          ),
        ),
        child: const Center(child: Icon(Icons.question_mark_rounded, size: 36)),
      ),
    ),
  );
}

class _MessageView extends StatelessWidget {
  const _MessageView({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Text(message, textAlign: TextAlign.center),
    ),
  );
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text(message),
        TextButton(onPressed: onRetry, child: const Text('다시 시도')),
      ],
    ),
  );
}
