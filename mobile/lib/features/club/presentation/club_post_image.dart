import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ClubPostImageView extends ConsumerWidget {
  const ClubPostImageView({
    required this.teamId,
    required this.image,
    this.height = 220,
    super.key,
  });

  final String teamId;
  final ClubPostImage image;
  final double height;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) return const SizedBox.shrink();
    final value = ref.watch(
      clubPostImageProvider((
        userId: user.id,
        teamId: teamId,
        imageId: image.id,
      )),
    );
    return SizedBox(
      height: height,
      child: value.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => const Center(child: Icon(Icons.broken_image_outlined)),
        data: (bytes) => Image.memory(
          bytes,
          key: Key('post-image-${image.id}'),
          fit: BoxFit.contain,
          errorBuilder: (_, _, _) =>
              const Center(child: Icon(Icons.broken_image_outlined)),
        ),
      ),
    );
  }
}
