import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubBoardScreen extends ConsumerWidget {
  const ClubBoardScreen({required this.teamId, super.key});
  final String teamId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final request = (userId: user.id, teamId: teamId);
    final provider = clubPostsProvider(request);
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
          data: (ClubPostsPage page) => RefreshIndicator(
            onRefresh: () => ref.refresh(provider.future),
            child: ListView(
              key: const Key('club-board'),
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
              physics: const AlwaysScrollableScrollPhysics(),
              children: <Widget>[
                Row(
                  children: <Widget>[
                    IconButton(
                      onPressed: context.pop,
                      icon: const Icon(Icons.arrow_back_rounded),
                    ),
                    const Expanded(
                      child: Text('게시판', style: AppTextStyles.title),
                    ),
                    IconButton(
                      key: const Key('board-create'),
                      onPressed: () async {
                        await context.push(
                          '/club/${Uri.encodeComponent(teamId)}/board/new',
                        );
                        ref.invalidate(provider);
                      },
                      icon: const Icon(Icons.add_rounded),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                if (page.items.isEmpty)
                  const Card(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Center(child: Text('게시글이 없습니다.')),
                    ),
                  )
                else
                  for (final ClubPostSummary post in page.items)
                    Card(
                      child: ListTile(
                        key: Key('club-post-${post.id}'),
                        title: Text(post.title),
                        subtitle: Text(
                          '${post.authorName} · ${_date(post.createdAt)}${post.imageCount > 0 ? ' · 이미지 ${post.imageCount}' : ''}',
                        ),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () => context.push(
                          '/club/${Uri.encodeComponent(teamId)}/board/${Uri.encodeComponent(post.id)}',
                        ),
                      ),
                    ),
              ],
            ),
          ),
        );
  }
}

String _date(DateTime date) =>
    '${date.year}.${date.month.toString().padLeft(2, '0')}.${date.day.toString().padLeft(2, '0')}';
