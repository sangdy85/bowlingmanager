import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_state.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/notifications/application/notification_providers.dart';
import 'package:bowlingmanager_mobile/features/notifications/data/notification_api.dart';
import 'package:bowlingmanager_mobile/features/notifications/domain/mobile_notification.dart';
import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
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

  test('uses the required high importance Android competition channel', () {
    expect(competitionNotificationChannel.id, 'bowlingmanager_competition');
    expect(competitionNotificationChannel.name, '경기 알림');
    expect(
      competitionNotificationChannel.description,
      '레인 배정, 조 편성, 팀전, 이벤트 투표 등 경기 진행 알림',
    );
    expect(competitionNotificationChannel.importance, Importance.high);
    expect(competitionNotificationChannel.playSound, isTrue);
    expect(competitionNotificationChannel.enableVibration, isTrue);
    expect(competitionNotificationDetails.priority, Priority.high);
  });

  test(
    'foreground notification is displayed exactly once per FCM message',
    () async {
      final platform = _FakeNotificationPlatform();
      final coordinator = MobileNotificationCoordinator(
        _FakeNotificationApi(),
        platform: platform,
        enabled: true,
      );
      await coordinator.initialize((_) {});
      const message = MobilePushMessage(
        messageId: 'message-1',
        title: '레인 배정 완료',
        body: '내 레인을 확인해주세요.',
        data: <String, dynamic>{
          'teamId': 'team-1',
          'eventId': 'event-1',
          'target': 'LANE_DRAW',
        },
      );
      platform.foreground.add(message);
      platform.foreground.add(message);
      await _flushEvents();
      expect(platform.shown, <MobilePushMessage>[message]);
      coordinator.dispose();
      await platform.dispose();
    },
  );

  test(
    'background open navigates without creating a duplicate local notification',
    () async {
      final platform = _FakeNotificationPlatform();
      final paths = <String>[];
      final coordinator = MobileNotificationCoordinator(
        _FakeNotificationApi(),
        platform: platform,
        enabled: true,
      );
      await coordinator.initialize(paths.add);
      await coordinator.handleAuthState(const AuthState.authenticated(_user));
      platform.opened.add(
        const MobilePushMessage(
          messageId: 'message-2',
          title: '조 편성 완료',
          body: '내 조를 확인해주세요.',
          data: <String, dynamic>{
            'teamId': 'team-1',
            'eventId': 'event-1',
            'target': 'INDIVIDUAL_GROUP',
          },
        ),
      );
      await _flushEvents();
      expect(paths, <String>[
        '/club/team-1/events/event-1?section=competition',
      ]);
      expect(platform.shown, isEmpty);
      coordinator.dispose();
      await platform.dispose();
    },
  );

  test(
    'terminated notification tap waits for authentication then deep links',
    () async {
      final platform = _FakeNotificationPlatform()
        ..initial = const MobilePushMessage(
          messageId: 'message-3',
          title: '이벤트 투표 시작',
          body: '지금 투표해주세요.',
          data: <String, dynamic>{
            'teamId': 'team-1',
            'eventId': 'event-1',
            'target': 'EVENT_VOTING',
          },
        );
      final paths = <String>[];
      final coordinator = MobileNotificationCoordinator(
        _FakeNotificationApi(),
        platform: platform,
        enabled: true,
      );
      await coordinator.initialize(paths.add);
      expect(paths, isEmpty);
      await coordinator.handleAuthState(const AuthState.unauthenticated());
      expect(paths, isEmpty);
      await coordinator.handleAuthState(const AuthState.authenticated(_user));
      expect(paths, <String>[
        '/club/team-1/events/event-1?section=competition',
      ]);
      coordinator.dispose();
      await platform.dispose();
    },
  );

  test(
    'foreground local notification tap opens its competition deep link',
    () async {
      final platform = _FakeNotificationPlatform();
      final paths = <String>[];
      final coordinator = MobileNotificationCoordinator(
        _FakeNotificationApi(),
        platform: platform,
        enabled: true,
      );
      await coordinator.initialize(paths.add);
      await coordinator.handleAuthState(const AuthState.authenticated(_user));
      platform.tap(const <String, dynamic>{
        'teamId': 'team-1',
        'eventId': 'event-1',
        'target': 'TEAM_DRAFT',
      });
      expect(paths, <String>[
        '/club/team-1/events/event-1?section=competition',
      ]);
      coordinator.dispose();
      await platform.dispose();
    },
  );

  test(
    'permission state and Android notification settings action are exposed',
    () async {
      final platform = _FakeNotificationPlatform()
        ..authorizationStatus = AuthorizationStatus.denied
        ..requestedStatus = AuthorizationStatus.authorized;
      final coordinator = MobileNotificationCoordinator(
        _FakeNotificationApi(),
        platform: platform,
        enabled: true,
      );
      await coordinator.initialize((_) {});
      expect(coordinator.permission, MobileNotificationPermission.denied);
      expect(await coordinator.openNotificationSettings(), isTrue);
      expect(platform.settingsOpenCount, 1);
      expect(
        await coordinator.requestPermission(),
        MobileNotificationPermission.enabled,
      );
      coordinator.dispose();
      await platform.dispose();
    },
  );

  test(
    'malformed local payload and malformed navigation data are ignored',
    () async {
      expect(mobileNotificationDataFromPayload('not-json'), isNull);
      expect(mobileNotificationDataFromPayload('[]'), isNull);
      final platform = _FakeNotificationPlatform();
      final paths = <String>[];
      final coordinator = MobileNotificationCoordinator(
        _FakeNotificationApi(),
        platform: platform,
        enabled: true,
      );
      await coordinator.initialize(paths.add);
      platform.tap(const <String, dynamic>{'target': 'LANE_DRAW'});
      await coordinator.handleAuthState(const AuthState.authenticated(_user));
      expect(paths, isEmpty);
      coordinator.dispose();
      await platform.dispose();
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

const AuthUser _user = AuthUser(
  id: 'user-1',
  email: 'user@example.com',
  name: '테스트 볼러',
  role: 'USER',
  handicap: 0,
);

Future<void> _flushEvents() async {
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
}

class _FakeNotificationApi extends NotificationApi {
  _FakeNotificationApi() : super(Dio());
  final List<String> registered = <String>[];
  final List<String> revoked = <String>[];

  @override
  Future<void> registerDevice(String token) async => registered.add(token);

  @override
  Future<void> revokeDevice(String token) async => revoked.add(token);
}

class _FakeNotificationPlatform implements MobileNotificationPlatform {
  AuthorizationStatus authorizationStatus = AuthorizationStatus.authorized;
  AuthorizationStatus requestedStatus = AuthorizationStatus.authorized;
  String? token;
  MobilePushMessage? initial;
  final StreamController<String> tokens = StreamController<String>.broadcast();
  final StreamController<MobilePushMessage> opened =
      StreamController<MobilePushMessage>.broadcast();
  final StreamController<MobilePushMessage> foreground =
      StreamController<MobilePushMessage>.broadcast();
  final List<MobilePushMessage> shown = <MobilePushMessage>[];
  late void Function(Map<String, dynamic>) tap;
  int settingsOpenCount = 0;

  @override
  Future<AuthorizationStatus> getAuthorizationStatus() async =>
      authorizationStatus;

  @override
  Future<MobilePushMessage?> getInitialMessage() async => initial;

  @override
  Future<String?> getToken() async => token;

  @override
  Future<void> initialize({
    required void Function(Map<String, dynamic> data) onLocalTap,
  }) async {
    tap = onLocalTap;
  }

  @override
  Stream<MobilePushMessage> get onForegroundMessage => foreground.stream;

  @override
  Stream<MobilePushMessage> get onMessageOpenedApp => opened.stream;

  @override
  Stream<String> get onTokenRefresh => tokens.stream;

  @override
  Future<bool> openAppNotificationSettings() async {
    settingsOpenCount += 1;
    return true;
  }

  @override
  Future<AuthorizationStatus> requestPermission() async => requestedStatus;

  @override
  Future<void> showForeground(MobilePushMessage message) async {
    shown.add(message);
  }

  Future<void> dispose() async {
    await tokens.close();
    await opened.close();
    await foreground.close();
  }
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
