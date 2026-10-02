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

const String competitionNotificationChannelId = 'bowlingmanager_competition';
const String competitionNotificationChannelName = '경기 알림';
const String competitionNotificationChannelDescription =
    '레인 배정, 조 편성, 팀전, 이벤트 투표 등 경기 진행 알림';

const AndroidNotificationChannel competitionNotificationChannel =
    AndroidNotificationChannel(
      competitionNotificationChannelId,
      competitionNotificationChannelName,
      description: competitionNotificationChannelDescription,
      importance: Importance.high,
      playSound: true,
      enableVibration: true,
    );

const AndroidNotificationDetails competitionNotificationDetails =
    AndroidNotificationDetails(
      competitionNotificationChannelId,
      competitionNotificationChannelName,
      channelDescription: competitionNotificationChannelDescription,
      importance: Importance.high,
      priority: Priority.high,
      playSound: true,
      enableVibration: true,
    );

const String financeNotificationChannelId = 'bowlingmanager_finance';
const String financeNotificationChannelName = '회비 알림';
const String financeNotificationChannelDescription = '동호회 회비와 게임비 납부 확인 알림';

const AndroidNotificationChannel financeNotificationChannel =
    AndroidNotificationChannel(
      financeNotificationChannelId,
      financeNotificationChannelName,
      description: financeNotificationChannelDescription,
      importance: Importance.high,
      playSound: true,
      enableVibration: true,
    );

const AndroidNotificationDetails financeNotificationDetails =
    AndroidNotificationDetails(
      financeNotificationChannelId,
      financeNotificationChannelName,
      channelDescription: financeNotificationChannelDescription,
      importance: Importance.high,
      priority: Priority.high,
      playSound: true,
      enableVibration: true,
    );

const List<AndroidNotificationChannel> mobileNotificationChannels =
    <AndroidNotificationChannel>[
      competitionNotificationChannel,
      financeNotificationChannel,
    ];

AndroidNotificationDetails mobileNotificationDetails(
  Map<String, dynamic> data,
) =>
    data['target'] == 'FINANCE_CHARGE' || data['type'] == 'FINANCE_DUE_REMINDER'
    ? financeNotificationDetails
    : competitionNotificationDetails;

class MobilePushMessage {
  const MobilePushMessage({
    required this.messageId,
    required this.title,
    required this.body,
    required this.data,
  });

  final String? messageId;
  final String? title;
  final String? body;
  final Map<String, dynamic> data;
}

abstract interface class MobileNotificationPlatform {
  Future<void> initialize({
    required void Function(Map<String, dynamic> data) onLocalTap,
  });
  Future<AuthorizationStatus> getAuthorizationStatus();
  Future<AuthorizationStatus> requestPermission();
  Future<String?> getToken();
  Stream<String> get onTokenRefresh;
  Stream<MobilePushMessage> get onMessageOpenedApp;
  Stream<MobilePushMessage> get onForegroundMessage;
  Future<MobilePushMessage?> getInitialMessage();
  Future<void> showForeground(MobilePushMessage message);
  Future<bool> openAppNotificationSettings();
}

class FirebaseMobileNotificationPlatform implements MobileNotificationPlatform {
  FirebaseMobileNotificationPlatform({FlutterLocalNotificationsPlugin? local})
    : _local = local ?? FlutterLocalNotificationsPlugin();

  final FlutterLocalNotificationsPlugin _local;

  @override
  Future<void> initialize({
    required void Function(Map<String, dynamic> data) onLocalTap,
  }) async {
    await Firebase.initializeApp();
    await _local.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      ),
      onDidReceiveNotificationResponse: (response) {
        final data = mobileNotificationDataFromPayload(response.payload);
        if (data != null) onLocalTap(data);
      },
    );
    final android = _local
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    for (final AndroidNotificationChannel channel
        in mobileNotificationChannels) {
      await android?.createNotificationChannel(channel);
    }
  }

  @override
  Future<AuthorizationStatus> getAuthorizationStatus() async =>
      (await FirebaseMessaging.instance.getNotificationSettings())
          .authorizationStatus;

  @override
  Future<AuthorizationStatus> requestPermission() async =>
      (await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      )).authorizationStatus;

  @override
  Future<String?> getToken() => FirebaseMessaging.instance.getToken();

  @override
  Stream<String> get onTokenRefresh =>
      FirebaseMessaging.instance.onTokenRefresh;

  @override
  Stream<MobilePushMessage> get onMessageOpenedApp =>
      FirebaseMessaging.onMessageOpenedApp.map(_fromRemoteMessage);

  @override
  Stream<MobilePushMessage> get onForegroundMessage =>
      FirebaseMessaging.onMessage.map(_fromRemoteMessage);

  @override
  Future<MobilePushMessage?> getInitialMessage() async {
    final message = await FirebaseMessaging.instance.getInitialMessage();
    return message == null ? null : _fromRemoteMessage(message);
  }

  @override
  Future<void> showForeground(MobilePushMessage message) async {
    await _local.show(
      id: (message.messageId ?? message.data.toString()).hashCode,
      title: message.title,
      body: message.body,
      notificationDetails: NotificationDetails(
        android: mobileNotificationDetails(message.data),
      ),
      payload: jsonEncode(message.data),
    );
  }

  @override
  Future<bool> openAppNotificationSettings() async =>
      await _local.openAppNotificationSettings() ?? false;
}

MobilePushMessage _fromRemoteMessage(RemoteMessage message) =>
    MobilePushMessage(
      messageId: message.messageId,
      title: message.notification?.title,
      body: message.notification?.body,
      data: message.data,
    );

Map<String, dynamic>? mobileNotificationDataFromPayload(String? payload) {
  if (payload == null) return null;
  try {
    final value = jsonDecode(payload);
    return value is Map ? Map<String, dynamic>.from(value) : null;
  } on FormatException {
    return null;
  }
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
  MobileNotificationCoordinator(
    this._api, {
    MobileNotificationPlatform? platform,
    bool enabled = mobileFcmEnabled,
  }) : _platform = platform ?? FirebaseMobileNotificationPlatform(),
       _enabled = enabled,
       permission = enabled
           ? MobileNotificationPermission.notDetermined
           : MobileNotificationPermission.unavailable;
  final NotificationApi _api;
  final MobileNotificationPlatform _platform;
  final bool _enabled;
  StreamSubscription<String>? _tokenSubscription;
  StreamSubscription<MobilePushMessage>? _openedSubscription;
  StreamSubscription<MobilePushMessage>? _foregroundSubscription;
  final Set<String> _shownForegroundMessageIds = <String>{};
  bool _initialized = false;
  bool _authenticated = false;
  String? _registeredUserId;
  String? _token;
  String? _pendingPath;
  void Function(String path)? _navigate;

  MobileNotificationPermission permission;

  Future<void> initialize(void Function(String path) navigate) async {
    _navigate = navigate;
    if (_initialized || !_enabled) return;
    _initialized = true;
    try {
      await _platform.initialize(onLocalTap: _open);
      permission = mobileNotificationPermissionFromAuthorization(
        await _platform.getAuthorizationStatus(),
      );
      _token = await _platform.getToken();
      _tokenSubscription = _platform.onTokenRefresh.listen((token) {
        final previous = _token;
        _token = token;
        if (_authenticated) unawaited(_replaceToken(previous, token));
      });
      _openedSubscription = _platform.onMessageOpenedApp.listen(
        (message) => _open(message.data),
      );
      _foregroundSubscription = _platform.onForegroundMessage.listen((message) {
        unawaited(_showForeground(message));
      });
      final initial = await _platform.getInitialMessage();
      if (initial != null) _open(initial.data);
    } on Object {
      permission = MobileNotificationPermission.unavailable;
    }
  }

  Future<MobileNotificationPermission> requestPermission() async {
    if (!_initialized) return permission;
    permission = mobileNotificationPermissionFromAuthorization(
      await _platform.requestPermission(),
    );
    if (permission == MobileNotificationPermission.enabled) {
      _token = await _platform.getToken();
      if (_authenticated && _token != null) {
        await _api.registerDevice(_token!);
      }
    }
    return permission;
  }

  Future<bool> openNotificationSettings() async {
    if (!_initialized) return false;
    return _platform.openAppNotificationSettings();
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

  Future<void> _showForeground(MobilePushMessage message) async {
    if (message.title == null && message.body == null) return;
    final messageId = message.messageId;
    if (messageId != null && !_shownForegroundMessageIds.add(messageId)) return;
    await _platform.showForeground(message);
  }

  void dispose() {
    _tokenSubscription?.cancel();
    _openedSubscription?.cancel();
    _foregroundSubscription?.cancel();
  }
}
