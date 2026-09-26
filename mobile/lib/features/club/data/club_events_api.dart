import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_competition_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_team_competition_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_competition_score_models.dart';
import 'package:dio/dio.dart';

class ClubEventsApi {
  ClubEventsApi(this._dio);
  final Dio _dio;

  Future<ClubEventsEnvelope> fetchEvents(
    String teamId,
    ClubEventListScope scope,
  ) => _request(
    () async => ClubEventsEnvelope.fromJson(
      _data(
        (await _dio.get<dynamic>(
          '/teams/${Uri.encodeComponent(teamId)}/events',
          queryParameters: <String, dynamic>{'scope': scope.apiValue},
        )).data,
      ),
    ),
  );

  Future<ClubEvent> fetchEvent(String teamId, String eventId) => _request(
    () async =>
        _event((await _dio.get<dynamic>(_eventPath(teamId, eventId))).data),
  );

  Future<ClubCompetitionResult> fetchCompetition(
    String teamId,
    String eventId,
  ) => _request(
    () async => ClubCompetitionResult.fromJson(
      _data(
        (await _dio.get<dynamic>('${_eventPath(teamId, eventId)}/competition'))
            .data,
      ),
    ),
  );

  Future<void> individualCompetitionAction(
    String teamId,
    String eventId,
    Map<String, dynamic> action,
  ) => _request(() async {
    _data(
      (await _dio.post<dynamic>(
        '${_eventPath(teamId, eventId)}/competition',
        data: action,
      )).data,
    );
  });

  Future<ClubTeamCompetitionState> fetchTeamCompetition(
    String teamId,
    String eventId,
  ) => _request(
    () async => ClubTeamCompetitionState.fromJson(
      _data(
        (await _dio.get<dynamic>(
          '${_eventPath(teamId, eventId)}/competition/team',
        )).data,
      ),
    ),
  );

  Future<void> teamCompetitionAction(
    String teamId,
    String eventId,
    Map<String, dynamic> action,
  ) => _request(() async {
    _data(
      (await _dio.post<dynamic>(
        '${_eventPath(teamId, eventId)}/competition/team',
        data: action,
      )).data,
    );
  });

  Future<ClubEventCompetitionState> fetchEventCompetition(
    String teamId,
    String eventId,
  ) => _request(
    () async => ClubEventCompetitionState.fromJson(
      _data(
        (await _dio.get<dynamic>(
          '${_eventPath(teamId, eventId)}/competition/event',
        )).data,
      ),
    ),
  );

  Future<void> eventCompetitionAction(
    String teamId,
    String eventId,
    Map<String, dynamic> action,
  ) => _request(() async {
    _data(
      (await _dio.post<dynamic>(
        '${_eventPath(teamId, eventId)}/competition/event',
        data: action,
      )).data,
    );
  });

  Future<ClubCompetitionScoreEntry> fetchCompetitionScores(
    String teamId,
    String eventId,
  ) => _request(() async {
    final Response<dynamic> response = await _dio.get<dynamic>(
      '${_eventPath(teamId, eventId)}/scores',
    );
    return ClubCompetitionScoreEntry.fromJson(_data(response.data));
  });

  Future<void> saveCompetitionScores(
    String teamId,
    String eventId,
    Map<String, dynamic> body,
  ) => _request(() async {
    _data(
      (await _dio.post<dynamic>(
        '${_eventPath(teamId, eventId)}/scores',
        data: body,
      )).data,
    );
  });

  Future<ClubEvent> createEvent(String teamId, ClubEventDraft draft) =>
      _request(
        () async => _event(
          (await _dio.post<dynamic>(
            '/teams/${Uri.encodeComponent(teamId)}/events',
            data: draft.toJson(),
          )).data,
        ),
      );

  Future<ClubEvent> updateEvent(
    String teamId,
    String eventId,
    ClubEventDraft draft,
  ) => _request(
    () async => _event(
      (await _dio.patch<dynamic>(
        _eventPath(teamId, eventId),
        data: draft.toJson(),
      )).data,
    ),
  );

  Future<void> deleteEvent(String teamId, String eventId) => _request(() async {
    _data((await _dio.delete<dynamic>(_eventPath(teamId, eventId))).data);
  });

  Future<void> setAttendance(
    String teamId,
    String eventId,
    ClubEventAttendance status,
  ) => _request(() async {
    _data(
      (await _dio.put<dynamic>(
        '${_eventPath(teamId, eventId)}/attendance',
        data: <String, dynamic>{'status': status.apiValue},
      )).data,
    );
  });

  Future<void> addGuest(String teamId, String eventId, String name) =>
      _request(() async {
        _data(
          (await _dio.post<dynamic>(
            '${_eventPath(teamId, eventId)}/guests',
            data: <String, dynamic>{'name': name},
          )).data,
        );
      });

  Future<void> deleteGuest(
    String teamId,
    String eventId,
    String guestId,
  ) => _request(() async {
    _data(
      (await _dio.delete<dynamic>(
        '${_eventPath(teamId, eventId)}/guests/${Uri.encodeComponent(guestId)}',
      )).data,
    );
  });

  Future<void> replaceLaneSlots(
    String teamId,
    String eventId,
    List<({int laneNumber, int position})> slots,
  ) => _request(() async {
    _data(
      (await _dio.put<dynamic>(
        '${_eventPath(teamId, eventId)}/lane-config',
        data: <String, dynamic>{
          'slots': slots
              .map(
                (slot) => <String, int>{
                  'laneNumber': slot.laneNumber,
                  'position': slot.position,
                },
              )
              .toList(),
        },
      )).data,
    );
  });

  Future<void> startDraw(String teamId, String eventId) =>
      _postAction(teamId, eventId, 'draw/start');
  Future<ClubEventLaneAssignment> drawMine(String teamId, String eventId) =>
      _request(() async {
        final Map<String, dynamic> data = _data(
          (await _dio.post<dynamic>('${_eventPath(teamId, eventId)}/draw/mine'))
              .data,
        );
        final Object? assignment = data['assignment'];
        if (assignment is! Map) {
          throw const FormatException('Invalid lane assignment response.');
        }
        return ClubEventLaneAssignment.fromJson(
          Map<String, dynamic>.from(assignment),
        );
      });
  Future<void> drawGuest(String teamId, String eventId, String guestId) =>
      _postAction(
        teamId,
        eventId,
        'draw/guests/${Uri.encodeComponent(guestId)}',
      );
  Future<void> assignRemaining(String teamId, String eventId) =>
      _postAction(teamId, eventId, 'draw/remaining');

  Future<void> _postAction(String teamId, String eventId, String suffix) =>
      _request(() async {
        _data(
          (await _dio.post<dynamic>('${_eventPath(teamId, eventId)}/$suffix'))
              .data,
        );
      });
}

String _eventPath(String teamId, String eventId) =>
    '/teams/${Uri.encodeComponent(teamId)}/events/${Uri.encodeComponent(eventId)}';

ClubEvent _event(Object? body) {
  final Object? value = _data(body)['event'];
  if (value is! Map) throw const FormatException('Invalid event response.');
  return ClubEvent.fromJson(Map<String, dynamic>.from(value));
}

Map<String, dynamic> _data(Object? body) {
  if (body is! Map || body['success'] != true || body['data'] is! Map) {
    throw const FormatException('Invalid API response envelope.');
  }
  return Map<String, dynamic>.from(body['data'] as Map);
}

Future<T> _request<T>(Future<T> Function() call) async {
  try {
    return await call();
  } on DioException catch (error) {
    throw ApiException.fromDio(error);
  } on FormatException {
    throw ApiException.malformedResponse();
  } on TypeError {
    throw ApiException.malformedResponse();
  }
}
