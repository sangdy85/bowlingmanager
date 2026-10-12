import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_records_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_screen.dart';
import 'package:bowlingmanager_mobile/features/club/share/club_invite_share_data.dart';
import 'package:bowlingmanager_mobile/features/club/share/club_invite_share_preview_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubDetailScreen extends ConsumerWidget {
  const ClubDetailScreen({required this.teamId, super.key});

  final String teamId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthUser? user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final ClubRequest request = (userId: user.id, teamId: teamId);
    final provider = clubDetailProvider(request);
    final AsyncValue<ClubDetail> detail = ref.watch(provider);
    final AsyncValue<ClubTeamProfile> profile = ref.watch(
      clubTeamProfileProvider((userId: user.id, teamId: teamId)),
    );
    Future<void> refresh() => ref.refresh(provider.future);

    return detail.when(
      loading: () =>
          const _DetailFrame(child: Center(child: CircularProgressIndicator())),
      error: (Object error, StackTrace stackTrace) => _DetailFrame(
        child: ClubErrorCard(
          message: clubErrorMessage(error),
          onRetry: refresh,
        ),
      ),
      data: (ClubDetail club) => Column(
        children: <Widget>[
          Flexible(
            flex: 0,
            child: SingleChildScrollView(
              key: const Key('club-detail'),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 0),
                child: Column(
                  children: <Widget>[
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Row(
                              children: <Widget>[
                                IconButton(
                                  key: const Key('club-back'),
                                  onPressed: context.pop,
                                  icon: const Icon(Icons.arrow_back_rounded),
                                ),
                                Expanded(
                                  child: Text(
                                    club.name,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTextStyles.title,
                                  ),
                                ),
                                if (club.myRole != ClubRole.member)
                                  TextButton(
                                    key: const Key('club-management-link'),
                                    onPressed: () => context.push(
                                      '/club/${Uri.encodeComponent(teamId)}/manage',
                                    ),
                                    child: const Text('관리'),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            _DetailRow(label: '내 역할', value: club.myRole.label),
                            const SizedBox(height: 4),
                            _DetailRow(
                              label: '회원 수',
                              value: '${club.memberCount}명',
                            ),
                            if (profile.value?.notice
                                case final String notice) ...<Widget>[
                              const SizedBox(height: 4),
                              Text(
                                '공지 · $notice',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                            if (profile.value?.description
                                case final String description) ...<Widget>[
                              const SizedBox(height: 4),
                              Text(
                                description,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                    _ClubNextEvent(teamId: teamId, userId: user.id),
                    Wrap(
                      spacing: 4,
                      runSpacing: 4,
                      children: <Widget>[
                        OutlinedButton(
                          key: const Key('club-members-link'),
                          onPressed: () => context.push(
                            '/club/${Uri.encodeComponent(teamId)}/members',
                          ),
                          child: const Text('회원보기'),
                        ),
                        OutlinedButton(
                          key: const Key('club-board-link'),
                          onPressed: () => context.push(
                            '/club/${Uri.encodeComponent(teamId)}/board',
                          ),
                          child: const Text('게시판'),
                        ),
                        if (club.inviteUrl != null) ...<Widget>[
                          OutlinedButton(
                            key: const Key('club-invite-share'),
                            onPressed: () => showClubInviteSharePreview(
                              context: context,
                              data: ClubInviteShareData.fromClub(club),
                            ),
                            child: const Text('초대하기'),
                          ),
                        ],
                        OutlinedButton(
                          key: const Key('club-finance-link'),
                          onPressed: () => context.push(
                            '/club/${Uri.encodeComponent(teamId)}/finance',
                          ),
                          child: const Text('회비/정산'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: ClubRecordsScreen(
              teamId: teamId,
              clubName: club.name,
              embedded: true,
            ),
          ),
        ],
      ),
    );
  }
}

class _ClubNextEvent extends ConsumerWidget {
  const _ClubNextEvent({required this.teamId, required this.userId});
  final String teamId;
  final String userId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final request = (
      userId: userId,
      teamId: teamId,
      scope: ClubEventListScope.upcoming,
    );
    final state = ref.watch(clubEventsProvider(request));
    return Column(
      children: <Widget>[
        state.when(
          loading: () => const LinearProgressIndicator(),
          error: (error, _) => TextButton(
            onPressed: () => ref.invalidate(clubEventsProvider(request)),
            child: const Text('일정 다시 불러오기'),
          ),
          data: (data) {
            final event = data.events.firstOrNull;
            if (event == null) return const Text('예정된 일정이 없습니다.');
            return ListTile(
              key: const Key('club-next-event'),
              dense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 4),
              title: Text(
                '${event.date} · ${event.title}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text(
                '${event.gameType ?? '기타'}${event.competition == null ? '' : ' · ${event.competition!.type.label}'}',
                maxLines: 1,
              ),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => context.push(
                '/club/${Uri.encodeComponent(teamId)}/events/${Uri.encodeComponent(event.id)}',
              ),
            );
          },
        ),
        TextButton(
          key: const Key('club-events-link'),
          onPressed: () =>
              context.push('/club/${Uri.encodeComponent(teamId)}/events'),
          child: const Text('전체 일정 보기'),
        ),
      ],
    );
  }
}

class _DetailFrame extends StatelessWidget {
  const _DetailFrame({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
      children: <Widget>[
        const _BackHeader(title: '동호회 상세'),
        const SizedBox(height: 72),
        child,
      ],
    );
  }
}

class _BackHeader extends StatelessWidget {
  const _BackHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        IconButton(
          key: const Key('club-back'),
          onPressed: context.pop,
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        const SizedBox(width: 6),
        Text(title, style: AppTextStyles.title),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: <Widget>[
        Text(label, style: const TextStyle(color: AppColors.textSecondary)),
        Text(
          value,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
