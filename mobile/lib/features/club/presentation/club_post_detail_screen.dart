import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubPostDetailScreen extends ConsumerWidget {
  const ClubPostDetailScreen({
    required this.teamId,
    required this.postId,
    super.key,
  });
  final String teamId;
  final String postId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final request = (userId: user.id, teamId: teamId, postId: postId);
    final provider = clubPostProvider(request);
    return ref
        .watch(provider)
        .when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(child: Text(clubErrorMessage(error))),
          data: (ClubPostDetail post) => ListView(
            key: const Key('club-post-detail'),
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
            children: <Widget>[
              Row(
                children: <Widget>[
                  IconButton(
                    onPressed: context.pop,
                    icon: const Icon(Icons.arrow_back_rounded),
                  ),
                  const Expanded(
                    child: Text('게시글', style: AppTextStyles.title),
                  ),
                  if (post.canEdit)
                    PopupMenuButton<String>(
                      onSelected: (value) async {
                        if (value == 'edit') {
                          await context.push(
                            '/club/${Uri.encodeComponent(teamId)}/board/${Uri.encodeComponent(postId)}/edit',
                          );
                          ref.invalidate(provider);
                        }
                        if (value == 'delete') {
                          await ref
                              .read(clubExpansionApiProvider)
                              .deletePost(teamId, postId);
                          ref.invalidate(clubPostsProvider);
                          if (context.mounted) context.pop();
                        }
                      },
                      itemBuilder: (_) => const <PopupMenuEntry<String>>[
                        PopupMenuItem(value: 'edit', child: Text('수정')),
                        PopupMenuItem(value: 'delete', child: Text('삭제')),
                      ],
                    ),
                ],
              ),
              const SizedBox(height: 18),
              Text(post.title, style: AppTextStyles.headline),
              const SizedBox(height: 8),
              Text('${post.authorName} · ${post.createdAt.toLocal()}'),
              const Divider(height: 32),
              Text(post.content),
            ],
          ),
        );
  }
}
