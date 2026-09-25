import 'dart:typed_data';

import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_expansion_api.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_post_image_picker.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_season_final_models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

typedef ClubMemberProfileRequest = ({
  String userId,
  String teamId,
  String memberId,
  int year,
});
typedef ClubPostRequest = ({String userId, String teamId, String postId});
typedef ClubPostImageRequest = ({String userId, String teamId, String imageId});
typedef ClubExpansionRequest = ({String userId, String teamId});
typedef ClubSeasonRankingRequest = ({
  String userId,
  String teamId,
  String? seasonId,
  int? year,
  String competitionType,
});
typedef ClubSeasonMemberRequest = ({
  String userId,
  String teamId,
  String memberId,
  String? seasonId,
  String competitionType,
});
typedef ClubSeasonFinalRequest = ({
  String userId,
  String teamId,
  String finalId,
});

final clubExpansionApiProvider = Provider<ClubExpansionApi>(
  (ref) => ClubExpansionApi(ref.watch(apiClientProvider).dio),
);
final clubPostImagePickerProvider = Provider<ClubPostImagePicker>(
  (ref) => MobileClubPostImagePicker(),
);
final clubSeasonFinalsProvider = FutureProvider.autoDispose
    .family<ClubSeasonFinals, ClubExpansionRequest>(
      (ref, request) =>
          ref.watch(clubExpansionApiProvider).fetchSeasonFinals(request.teamId),
      retry: (_, _) => null,
    );
final clubSeasonFinalProvider = FutureProvider.autoDispose
    .family<ClubSeasonFinalDetail, ClubSeasonFinalRequest>(
      (ref, request) => ref
          .watch(clubExpansionApiProvider)
          .fetchSeasonFinal(request.teamId, request.finalId),
      retry: (_, _) => null,
    );
final clubMemberProfileProvider = FutureProvider.autoDispose
    .family<ClubMemberProfile, ClubMemberProfileRequest>(
      (ref, request) => ref
          .watch(clubExpansionApiProvider)
          .fetchMember(request.teamId, request.memberId, request.year),
      retry: (_, _) => null,
    );
final clubTeamProfileProvider = FutureProvider.autoDispose
    .family<ClubTeamProfile, ClubExpansionRequest>(
      (ref, request) =>
          ref.watch(clubExpansionApiProvider).fetchProfile(request.teamId),
      retry: (_, _) => null,
    );
final clubSeasonRankingProvider = FutureProvider.autoDispose
    .family<ClubSeasonRanking, ClubSeasonRankingRequest>(
      (ref, request) => ref
          .watch(clubExpansionApiProvider)
          .fetchSeasonRanking(
            request.teamId,
            seasonId: request.seasonId,
            year: request.year,
            competitionType: request.competitionType,
          ),
      retry: (_, _) => null,
    );
final clubSeasonMemberProvider = FutureProvider.autoDispose
    .family<ClubSeasonRankingRow, ClubSeasonMemberRequest>(
      (ref, request) => ref
          .watch(clubExpansionApiProvider)
          .fetchSeasonMember(
            request.teamId,
            request.memberId,
            seasonId: request.seasonId,
            competitionType: request.competitionType,
          ),
      retry: (_, _) => null,
    );
final clubPostsProvider = FutureProvider.autoDispose
    .family<ClubPostsPage, ClubExpansionRequest>(
      (ref, request) =>
          ref.watch(clubExpansionApiProvider).fetchPosts(request.teamId, 1),
      retry: (_, _) => null,
    );
final clubPostProvider = FutureProvider.autoDispose
    .family<ClubPostDetail, ClubPostRequest>(
      (ref, request) => ref
          .watch(clubExpansionApiProvider)
          .fetchPost(request.teamId, request.postId),
      retry: (_, _) => null,
    );
final clubPostImageProvider = FutureProvider.autoDispose
    .family<Uint8List, ClubPostImageRequest>(
      (ref, request) => ref
          .watch(clubExpansionApiProvider)
          .fetchPostImage(request.teamId, request.imageId),
      retry: (_, _) => null,
    );
