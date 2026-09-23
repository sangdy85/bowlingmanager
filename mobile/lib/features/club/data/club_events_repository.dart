import 'package:bowlingmanager_mobile/features/club/data/club_events_api.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_competition_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_team_competition_models.dart';

class ClubEventsRepository {
  ClubEventsRepository(this._api);
  final ClubEventsApi _api;

  Future<ClubEventsEnvelope> fetchEvents(String teamId) =>
      _api.fetchEvents(teamId);
  Future<ClubEvent> fetchEvent(String teamId, String eventId) =>
      _api.fetchEvent(teamId, eventId);
  Future<ClubCompetitionResult> fetchCompetition(
    String teamId,
    String eventId,
  ) => _api.fetchCompetition(teamId, eventId);
  Future<void> individualCompetitionAction(
    String teamId,
    String eventId,
    String action,
  ) => _api.individualCompetitionAction(teamId, eventId, action);
  Future<ClubTeamCompetitionState> fetchTeamCompetition(
    String teamId,
    String eventId,
  ) => _api.fetchTeamCompetition(teamId, eventId);
  Future<void> teamCompetitionAction(
    String teamId,
    String eventId,
    Map<String, dynamic> action,
  ) => _api.teamCompetitionAction(teamId, eventId, action);
  Future<ClubEventCompetitionState> fetchEventCompetition(
    String teamId,
    String eventId,
  ) => _api.fetchEventCompetition(teamId, eventId);
  Future<void> eventCompetitionAction(
    String teamId,
    String eventId,
    Map<String, dynamic> action,
  ) => _api.eventCompetitionAction(teamId, eventId, action);
  Future<ClubEvent> createEvent(String teamId, ClubEventDraft draft) =>
      _api.createEvent(teamId, draft);
  Future<ClubEvent> updateEvent(
    String teamId,
    String eventId,
    ClubEventDraft draft,
  ) => _api.updateEvent(teamId, eventId, draft);
  Future<void> deleteEvent(String teamId, String eventId) =>
      _api.deleteEvent(teamId, eventId);
  Future<void> setAttendance(
    String teamId,
    String eventId,
    ClubEventAttendance status,
  ) => _api.setAttendance(teamId, eventId, status);
  Future<void> addGuest(String teamId, String eventId, String name) =>
      _api.addGuest(teamId, eventId, name);
  Future<void> deleteGuest(String teamId, String eventId, String guestId) =>
      _api.deleteGuest(teamId, eventId, guestId);
  Future<void> replaceLaneSlots(
    String teamId,
    String eventId,
    List<({int laneNumber, int position})> slots,
  ) => _api.replaceLaneSlots(teamId, eventId, slots);
  Future<void> startDraw(String teamId, String eventId) =>
      _api.startDraw(teamId, eventId);
  Future<void> drawMine(String teamId, String eventId) =>
      _api.drawMine(teamId, eventId);
  Future<void> drawGuest(String teamId, String eventId, String guestId) =>
      _api.drawGuest(teamId, eventId, guestId);
  Future<void> assignRemaining(String teamId, String eventId) =>
      _api.assignRemaining(teamId, eventId);
}
