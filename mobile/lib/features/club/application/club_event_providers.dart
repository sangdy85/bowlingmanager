import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_events_api.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_events_repository.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_competition_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_team_competition_models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

typedef ClubEventRequest = ({String userId, String teamId, String eventId});
typedef ClubEventsRequest = ({String userId, String teamId});

final Provider<ClubEventsApi> clubEventsApiProvider = Provider<ClubEventsApi>(
  (Ref ref) => ClubEventsApi(ref.watch(apiClientProvider).dio),
);
final Provider<ClubEventsRepository> clubEventsRepositoryProvider =
    Provider<ClubEventsRepository>(
      (Ref ref) => ClubEventsRepository(ref.watch(clubEventsApiProvider)),
    );

final clubEventsProvider = FutureProvider.autoDispose
    .family<ClubEventsEnvelope, ClubEventsRequest>((Ref ref, request) {
      return ref
          .watch(clubEventsRepositoryProvider)
          .fetchEvents(request.teamId);
    }, retry: (int retryCount, Object error) => null);

final clubEventProvider = FutureProvider.autoDispose
    .family<ClubEvent, ClubEventRequest>((Ref ref, request) {
      return ref
          .watch(clubEventsRepositoryProvider)
          .fetchEvent(request.teamId, request.eventId);
    }, retry: (int retryCount, Object error) => null);

final clubCompetitionProvider = FutureProvider.autoDispose
    .family<ClubCompetitionResult, ClubEventRequest>((Ref ref, request) {
      return ref
          .watch(clubEventsRepositoryProvider)
          .fetchCompetition(request.teamId, request.eventId);
    }, retry: (int retryCount, Object error) => null);

final clubTeamCompetitionProvider = FutureProvider.autoDispose
    .family<ClubTeamCompetitionState, ClubEventRequest>((Ref ref, request) {
      return ref
          .watch(clubEventsRepositoryProvider)
          .fetchTeamCompetition(request.teamId, request.eventId);
    }, retry: (int retryCount, Object error) => null);

final clubEventCompetitionProvider = FutureProvider.autoDispose
    .family<ClubEventCompetitionState, ClubEventRequest>((Ref ref, request) {
      return ref
          .watch(clubEventsRepositoryProvider)
          .fetchEventCompetition(request.teamId, request.eventId);
    }, retry: (int retryCount, Object error) => null);

void invalidateClubEvents(
  WidgetRef ref,
  String userId,
  String teamId, [
  String? eventId,
]) {
  ref.invalidate(clubEventsProvider((userId: userId, teamId: teamId)));
  if (eventId != null) {
    ref.invalidate(
      clubEventProvider((userId: userId, teamId: teamId, eventId: eventId)),
    );
    ref.invalidate(
      clubCompetitionProvider((
        userId: userId,
        teamId: teamId,
        eventId: eventId,
      )),
    );
    ref.invalidate(
      clubTeamCompetitionProvider((
        userId: userId,
        teamId: teamId,
        eventId: eventId,
      )),
    );
    ref.invalidate(
      clubEventCompetitionProvider((
        userId: userId,
        teamId: teamId,
        eventId: eventId,
      )),
    );
  }
}
