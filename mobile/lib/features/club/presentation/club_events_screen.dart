import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubEventsScreen extends ConsumerWidget {
  const ClubEventsScreen({required this.teamId, this.past = false, super.key});
  final String teamId;
  final bool past;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthUser? user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final request = (
      userId: user.id,
      teamId: teamId,
      scope: past ? ClubEventListScope.past : ClubEventListScope.upcoming,
    );
    final provider = clubEventsProvider(request);
    final AsyncValue<ClubEventsEnvelope> state = ref.watch(provider);

    return Scaffold(
      appBar: AppBar(title: Text(past ? '지난 경기 기록' : '동호회 일정')),
      body: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (Object error, StackTrace _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(clubErrorMessage(error), textAlign: TextAlign.center),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () => ref.invalidate(provider),
                  child: const Text('다시 시도'),
                ),
              ],
            ),
          ),
        ),
        data: (ClubEventsEnvelope envelope) => RefreshIndicator(
          onRefresh: () => ref.refresh(provider.future),
          child: envelope.events.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                  children: <Widget>[
                    const SizedBox(height: 140),
                    const Icon(Icons.event_available_outlined, size: 56),
                    const SizedBox(height: 12),
                    Center(
                      child: Text(past ? '지난 일정이 없습니다.' : '예정된 일정이 없습니다.'),
                    ),
                    if (!past) ...<Widget>[
                      const SizedBox(height: 28),
                      _pastEventsButton(context),
                    ],
                  ],
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                  itemCount: envelope.events.length + (past ? 0 : 1),
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (BuildContext context, int index) {
                    if (index == envelope.events.length) {
                      return Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: _pastEventsButton(context),
                      );
                    }
                    final ClubEvent event = envelope.events[index];
                    return Card(
                      child: ListTile(
                        key: Key('club-event-${event.id}'),
                        contentPadding: const EdgeInsets.all(16),
                        title: Text(
                          event.title,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            '${event.date} ${event.time}\n${event.location}\n'
                            '참석 ${event.counts.attending} · 게스트 ${event.counts.guests} · ${event.laneDrawStatus.label}'
                            '${event.competition == null ? '' : '\n[${event.gameType ?? '기타'}] [${event.competition!.type.label}] [${event.competition!.mode?.label ?? '모드 미설정'}]'}',
                          ),
                        ),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () => context.push(
                          '/club/${Uri.encodeComponent(teamId)}/events/${Uri.encodeComponent(event.id)}',
                        ),
                      ),
                    );
                  },
                ),
        ),
      ),
      floatingActionButton:
          state.value?.role == ClubRole.owner ||
              state.value?.role == ClubRole.manager
          ? FloatingActionButton.extended(
              key: const Key('club-event-create'),
              onPressed: () => context.push(
                '/club/${Uri.encodeComponent(teamId)}/events/new',
              ),
              icon: const Icon(Icons.add_rounded),
              label: const Text('일정 추가'),
            )
          : null,
    );
  }

  Widget _pastEventsButton(BuildContext context) => OutlinedButton.icon(
    key: const Key('club-past-events'),
    onPressed: () =>
        context.push('/club/${Uri.encodeComponent(teamId)}/events/past'),
    icon: const Icon(Icons.history_rounded),
    label: const Text('지난 경기 기록 보기'),
  );
}
