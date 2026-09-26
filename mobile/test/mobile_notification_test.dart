import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/notifications/application/notification_providers.dart';
import 'package:bowlingmanager_mobile/features/notifications/data/notification_api.dart';
import 'package:bowlingmanager_mobile/features/notifications/domain/mobile_notification.dart';
import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'maps every competition notification target to an authenticated route',
    () {
      const expected = <String, String>{
        'LANE_DRAW': '/club/team-1/events/event-1/draw',
        'EVENT_DETAIL': '/club/team-1/events/event-1',
        'INDIVIDUAL_GROUP': '/club/team-1/events/event-1?section=competition',
        'TEAM_DRAFT': '/club/team-1/events/event-1?section=competition',
        'TEAM_DETAIL': '/club/team-1/events/event-1?section=competition',
        'EVENT_VOTING': '/club/team-1/events/event-1?section=competition',
      };
      for (final entry in expected.entries) {
        expect(
          mobileNotificationPath(<String, dynamic>{
            'teamId': 'team-1',
            'eventId': 'event-1',
            'target': entry.key,
          }),
          entry.value,
        );
      }
      expect(mobileNotificationPath(const <String, dynamic>{}), isNull);
    },
  );

  test(
    'parses notification list and sends register, read and revoke requests',
    () async {
      final requests = <RequestOptions>[];
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
        ..httpClientAdapter = _Adapter((options) {
          requests.add(options);
          return _json(200, <String, Object>{
            'success': true,
            'data': options.path == '/notifications'
                ? <String, Object>{
                    'items': <Object>[
                      <String, Object?>{
                        'id': 'notification-1',
                        'type': 'TEAM_DRAFT_TURN',
                        'title': '선수 선택 차례입니다',
                        'body': '선수를 선택해 주세요.',
                        'teamId': 'team-1',
                        'eventId': 'event-1',
                        'data': <String, Object>{'target': 'TEAM_DRAFT'},
                        'createdAt': '2026-09-26T00:00:00.000Z',
                        'readAt': null,
                      },
                    ],
                    'pagination': <String, int>{'page': 1, 'limit': 50},
                  }
                : const <String, Object>{},
          });
        });
      final api = NotificationApi(dio);
      await api.registerDevice('fcm-token-123456789012345');
      final items = await api.list();
      await api.markRead(items.single.id);
      await api.revokeDevice('fcm-token-123456789012345');
      expect(items.single.isUnread, isTrue);
      expect(
        requests.map((request) => '${request.method} ${request.path}'),
        <String>[
          'POST /push/devices',
          'GET /notifications',
          'POST /notifications/notification-1/read',
          'DELETE /push/devices',
        ],
      );
      expect(requests.first.data, <String, Object>{
        'token': 'fcm-token-123456789012345',
        'platform': 'ANDROID',
      });
    },
  );

  test('malformed notification envelope uses the safe API error', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter(
        (_) => _json(200, <String, Object>{'success': true, 'data': 'bad'}),
      );
    await expectLater(
      NotificationApi(dio).list(),
      throwsA(
        isA<ApiException>().having(
          (error) => error.kind,
          'kind',
          ApiErrorKind.malformedResponse,
        ),
      ),
    );
  });

  test('unconfigured build leaves Firebase permission unavailable', () {
    final coordinator = MobileNotificationCoordinator(
      NotificationApi(Dio(BaseOptions(baseUrl: 'https://example.test'))),
    );
    expect(mobileFcmEnabled, isFalse);
    expect(coordinator.permission, MobileNotificationPermission.unavailable);
    coordinator.dispose();
  });

  test(
    'maps Android notification permission states without requesting them',
    () {
      expect(
        mobileNotificationPermissionFromAuthorization(
          AuthorizationStatus.notDetermined,
        ),
        MobileNotificationPermission.notDetermined,
      );
      expect(
        mobileNotificationPermissionFromAuthorization(
          AuthorizationStatus.denied,
        ),
        MobileNotificationPermission.denied,
      );
      expect(
        mobileNotificationPermissionFromAuthorization(
          AuthorizationStatus.authorized,
        ),
        MobileNotificationPermission.enabled,
      );
    },
  );
}

ResponseBody _json(int statusCode, Object body) => ResponseBody.fromString(
  jsonEncode(body),
  statusCode,
  headers: <String, List<String>>{
    Headers.contentTypeHeader: <String>[Headers.jsonContentType],
  },
);

class _Adapter implements HttpClientAdapter {
  _Adapter(this.handler);
  final FutureOr<ResponseBody> Function(RequestOptions) handler;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => handler(options);
  @override
  void close({bool force = false}) {}
}
