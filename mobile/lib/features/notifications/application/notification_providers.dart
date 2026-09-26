import 'dart:async';
import 'dart:convert';

import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_state.dart';
import 'package:bowlingmanager_mobile/features/notifications/data/notification_api.dart';
import 'package:bowlingmanager_mobile/features/notifications/domain/mobile_notification.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

const bool mobileFcmEnabled = bool.fromEnvironment(
  'FCM_ENABLED',
  defaultValue: false,
);

enum MobileNotificationPermission {
  unavailable,
  notDetermined,
  denied,
  enabled,
}

MobileNotificationPermission mobileNotificationPermissionFromAuthorization(
  AuthorizationStatus status,
) => switch (status) {
  AuthorizationStatus.authorized ||
  AuthorizationStatus.provisional => MobileNotificationPermission.enabled,
  AuthorizationStatus.denied ||
  AuthorizationStatus.deniedPermanently => MobileNotificationPermission.denied,
  AuthorizationStatus.notDetermined =>
    MobileNotificationPermission.notDetermined,
};

final Provider<NotificationApi> notificationApiProvider = Provider(
  (ref) => NotificationApi(ref.watch(apiClientProvider).dio),
);

final notificationListProvider =
    FutureProvider.autoDispose<List<MobileNotificationItem>>((ref) {
      return ref.watch(notificationApiProvider).list();
    }, retry: (int _, Object _) => null);

final Provider<MobileNotificationCoordinator> notificationCoordinatorProvider =
    Provider((ref) {
      final coordinator = MobileNotificationCoordinator(
        ref.watch(notificationApiProvider),
      );
      ref.onDispose(coordinator.dispose);
      return coordinator;
    });

class MobileNotificationCoordinator {
  MobileNotificationCoordinator(this._api);
  final NotificationApi _api;
  final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();
  StreamSubscription<String>? _tokenSubscription;
  StreamSubscription<RemoteMessage>? _openedSubscription;
  StreamSubscription<RemoteMessage>? _foregroundSubscription;
  bool _initialized = false;
  bool _authenticated = false;
  String? _registeredUserId;
  String? _token;
  String? _pendingPath;
  void Function(String path)? _navigate;

  MobileNotificationPermission permission = mobileFcmEnabled
      ? MobileNotificationPermission.notDetermined
      : MobileNotificationPermission.unavailable;

  Future<void> initialize(void Function(String path) navigate) async {
    _navigate = navigate;
    if (_initialized || !mobileFcmEnabled) return;
    _initialized = true;
    try {
      await Firebase.initializeApp();
      await _local.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        ),
        onDidReceiveNotificationResponse: (response) async {
          final payload = response.payload;
          if (payload == null) return;
          final value = jsonDecode(payload);
          if (value is Map) _open(Map<String, dynamic>.from(value));
        },
      );
      permission = mobileNotificationPermissionFromAuthorization(
        (await FirebaseMessaging.instance.getNotificationSettings())
            .authorizationStatus,
      );
      _token = await FirebaseMessaging.instance.getToken();
      _tokenSubscription = FirebaseMessaging.instance.onTokenRefresh.listen((
        token,
      ) {
        final previous = _token;
        _token = token;
        if (_authenticated) unawaited(_replaceToken(previous, token));
      });
      _openedSubscription = FirebaseMessaging.onMessageOpenedApp.listen(
        (message) => _open(message.data),
      );
      _foregroundSubscription = FirebaseMessaging.onMessage.listen(
        _showForeground,
      );
      final initial = await FirebaseMessaging.instance.getInitialMessage();
      if (initial != null) _open(initial.data);
    } on Object {
      permission = MobileNotificationPermission.unavailable;
    }
  }

  Future<MobileNotificationPermission> requestPermission() async {
    if (!_initialized) return permission;
    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    permission = mobileNotificationPermissionFromAuthorization(
      settings.authorizationStatus,
    );
    if (permission == MobileNotificationPermission.enabled) {
      _token = await FirebaseMessaging.instance.getToken();
      if (_authenticated && _token != null) {
        await _api.registerDevice(_token!);
      }
    }
    return permission;
  }

  Future<void> handleAuthState(AuthState state) async {
    _authenticated = state.isAuthenticated;
    if (_authenticated) {
      final userId = state.user?.id;
      if (_token != null && userId != null && _registeredUserId != userId) {
        try {
          await _api.registerDevice(_token!);
          _registeredUserId = userId;
        } on Object {
          // Registration is retried on a later authenticated rebuild/token refresh.
        }
      }
      if (_pendingPath case final path?) {
        _pendingPath = null;
        _navigate?.call(path);
      }
    } else {
      _registeredUserId = null;
    }
  }

  Future<void> _replaceToken(String? previous, String current) async {
    try {
      if (previous != null && previous != current) {
        await _api.revokeDevice(previous);
      }
      await _api.registerDevice(current);
    } on Object {
      // Token synchronization must not interrupt the authenticated app session.
    }
  }

  Future<void> revokeCurrentDevice() async {
    final token = _token;
    if (_authenticated && token != null) {
      try {
        await _api.revokeDevice(token);
      } on Object {
        // Server refresh-token revocation and local logout must still complete.
      }
    }
    _registeredUserId = null;
  }

  void _open(Map<String, dynamic> data) {
    final path = mobileNotificationPath(data);
    if (path == null) return;
    if (_authenticated) {
      _navigate?.call(path);
    } else {
      _pendingPath = path;
    }
  }

  Future<void> _showForeground(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;
    await _local.show(
      id: message.messageId.hashCode,
      title: notification.title,
      body: notification.body,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'competition_operations',
          '경기 운영 알림',
          channelDescription: '레인, 조 편성, 팀 드래프트 및 이벤트 투표 알림',
          importance: Importance.high,
          priority: Priority.high,
        ),
      ),
      payload: jsonEncode(message.data),
    );
  }

  void dispose() {
    _tokenSubscription?.cancel();
    _openedSubscription?.cancel();
    _foregroundSubscription?.cancel();
  }
}
