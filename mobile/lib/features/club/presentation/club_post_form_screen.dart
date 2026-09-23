import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubPostFormScreen extends ConsumerStatefulWidget {
  const ClubPostFormScreen({required this.teamId, this.postId, super.key});
  final String teamId;
  final String? postId;
  @override
  ConsumerState<ClubPostFormScreen> createState() => _ClubPostFormScreenState();
}

class _ClubPostFormScreenState extends ConsumerState<ClubPostFormScreen> {
  final _title = TextEditingController();
  final _content = TextEditingController();
  bool _loaded = false;
  bool _saving = false;
  @override
  void dispose() {
    _title.dispose();
    _content.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    if (widget.postId != null && !_loaded) {
      final value = ref.watch(
        clubPostProvider((
          userId: user.id,
          teamId: widget.teamId,
          postId: widget.postId!,
        )),
      );
      if (value.isLoading) {
        return const Center(child: CircularProgressIndicator());
      }
      if (value.hasError) {
        return Center(
          child: ClubErrorCard(
            message: clubErrorMessage(value.error!),
            onRetry: () => ref.refresh(
              clubPostProvider((
                userId: user.id,
                teamId: widget.teamId,
                postId: widget.postId!,
              )).future,
            ),
          ),
        );
      }
      final post = value.requireValue;
      _title.text = post.title;
      _content.text = post.content;
      _loaded = true;
    }
    return ListView(
      key: const Key('club-post-form'),
      padding: const EdgeInsets.all(20),
      children: <Widget>[
        Row(
          children: <Widget>[
            IconButton(
              onPressed: context.pop,
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            Text(widget.postId == null ? '글쓰기' : '게시글 수정'),
          ],
        ),
        const SizedBox(height: 20),
        TextField(
          controller: _title,
          maxLength: 120,
          decoration: const InputDecoration(labelText: '제목'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _content,
          maxLength: 10000,
          minLines: 8,
          maxLines: 16,
          decoration: const InputDecoration(labelText: '내용'),
        ),
        const SizedBox(height: 18),
        FilledButton(
          key: const Key('post-save'),
          onPressed: _saving
              ? null
              : () async {
                  final title = _title.text.trim();
                  final content = _content.text.trim();
                  if (title.isEmpty || content.isEmpty) return;
                  setState(() => _saving = true);
                  try {
                    await ref
                        .read(clubExpansionApiProvider)
                        .savePost(
                          widget.teamId,
                          postId: widget.postId,
                          title: title,
                          content: content,
                        );
                    ref.invalidate(clubPostsProvider);
                    if (context.mounted) context.pop();
                  } finally {
                    if (mounted) setState(() => _saving = false);
                  }
                },
          child: Text(_saving ? '저장 중...' : '저장'),
        ),
      ],
    );
  }
}
