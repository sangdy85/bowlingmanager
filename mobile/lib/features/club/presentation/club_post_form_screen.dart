import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_post_image.dart';
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
  List<ClubPostImage> _existingImages = <ClubPostImage>[];
  List<CaptureImageData> _newImages = <CaptureImageData>[];
  String? _errorMessage;
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
      _existingImages = List<ClubPostImage>.of(post.images);
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
        const SizedBox(height: 12),
        if (_existingImages.isNotEmpty || _newImages.isNotEmpty)
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: <Widget>[
              for (final image in _existingImages)
                _AttachmentPreview(
                  key: Key('existing-post-image-${image.id}'),
                  onRemove: () => setState(() => _existingImages.remove(image)),
                  child: ClubPostImageView(
                    teamId: widget.teamId,
                    image: image,
                    height: 96,
                  ),
                ),
              for (int index = 0; index < _newImages.length; index++)
                _AttachmentPreview(
                  key: Key('new-post-image-$index'),
                  onRemove: () => setState(() => _newImages.removeAt(index)),
                  child: Image.memory(
                    _newImages[index].bytes,
                    height: 96,
                    width: 96,
                    fit: BoxFit.cover,
                  ),
                ),
            ],
          ),
        OutlinedButton.icon(
          key: const Key('post-add-images'),
          onPressed: _saving
              ? null
              : () async {
                  final images = await ref
                      .read(clubPostImagePickerProvider)
                      .pickImages();
                  if (!mounted || images.isEmpty) return;
                  setState(() {
                    _newImages = <CaptureImageData>[..._newImages, ...images];
                    _errorMessage = null;
                  });
                },
          icon: const Icon(Icons.add_photo_alternate_outlined),
          label: const Text('이미지 추가'),
        ),
        if (_errorMessage != null) ...<Widget>[
          const SizedBox(height: 8),
          Text(
            _errorMessage!,
            key: const Key('post-save-error'),
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ],
        const SizedBox(height: 18),
        FilledButton(
          key: const Key('post-save'),
          onPressed: _saving
              ? null
              : () async {
                  final title = _title.text.trim();
                  final content = _content.text.trim();
                  if (title.isEmpty || content.isEmpty) return;
                  setState(() {
                    _saving = true;
                    _errorMessage = null;
                  });
                  try {
                    await ref
                        .read(clubExpansionApiProvider)
                        .savePost(
                          widget.teamId,
                          postId: widget.postId,
                          title: title,
                          content: content,
                          existingImages: _existingImages,
                          newImages: _newImages,
                        );
                    ref.invalidate(clubPostsProvider);
                    if (context.mounted) context.pop();
                  } catch (error) {
                    if (mounted) {
                      setState(() => _errorMessage = clubErrorMessage(error));
                    }
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

class _AttachmentPreview extends StatelessWidget {
  const _AttachmentPreview({
    required this.child,
    required this.onRemove,
    super.key,
  });
  final Widget child;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 108,
    height: 108,
    child: Stack(
      fit: StackFit.expand,
      children: <Widget>[
        ClipRRect(borderRadius: BorderRadius.circular(10), child: child),
        Positioned(
          top: 0,
          right: 0,
          child: IconButton.filledTonal(
            visualDensity: VisualDensity.compact,
            tooltip: '첨부 삭제',
            onPressed: onRemove,
            icon: const Icon(Icons.close_rounded),
          ),
        ),
      ],
    ),
  );
}
