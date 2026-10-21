import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_event_detail_screen.dart';
import 'package:bowlingmanager_mobile/features/club/share/club_event_share.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';

void main() {
  test('schedule sharing includes details without member or private state', () {
    final text = clubEventShareText(_event());
    expect(
      text,
      '[볼링매니저 일정]\n테스트 동호회\n정기전 10월 모임\n일시: 2026-10-19 19:00\n장소: 서울 볼링장\n경기 유형: 정기전',
    );
    expect(text, isNot(contains('비공개 게스트')));
    expect(text, isNot(contains('event-1')));
    expect(text, isNot(contains('team-1')));
  });

  testWidgets('member shares schedule as text through the detail button', (
    tester,
  ) async {
    MethodCall? sent;
    const channel = MethodChannel('dev.fluttercommunity.plus/share');
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(channel, (
      call,
    ) async {
      sent = call;
      return 'success';
    });
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        channel,
        null,
      ),
    );
    await _pump(tester);
    await tester.tap(find.byKey(const Key('club-event-share')));
    await tester.pumpAndSettle();
    expect(sent?.method, 'share');
    final args = sent!.arguments as Map;
    expect(args['text'], clubEventShareText(_event()));
    expect(args['paths'], isNull);
    expect(tester.takeException(), isNull);
  });

  testWidgets('share failure is safe and allows retry', (tester) async {
    const channel = MethodChannel('dev.fluttercommunity.plus/share');
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(channel, (
      _,
    ) async {
      throw PlatformException(code: 'unavailable', message: 'internal details');
    });
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        channel,
        null,
      ),
    );
    await _pump(tester);
    await tester.tap(find.byKey(const Key('club-event-share')));
    await tester.pumpAndSettle();
    expect(find.text('일정을 공유하지 못했습니다. 다시 시도해주세요.'), findsOneWidget);
    expect(find.textContaining('internal details'), findsNothing);
    expect(
      tester
          .widget<IconButton>(find.byKey(const Key('club-event-share')))
          .onPressed,
      isNotNull,
    );
    expect(tester.takeException(), isNull);
  });
}

Future<void> _pump(WidgetTester tester) async {
  final auth = FakeAuthRepository()..bootstrapResult = testUser;
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(auth),
        clubEventProvider.overrideWith((ref, request) async => _event()),
      ],
      child: const MaterialApp(
        home: ClubEventDetailScreen(teamId: 'team-1', eventId: 'event-1'),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

ClubEvent _event() => ClubEvent.fromJson(<String, Object?>{
  'id': 'event-1',
  'teamId': 'team-1',
  'teamName': '테스트 동호회',
  'title': '정기전 10월 모임',
  'date': '2026-10-19',
  'time': '19:00',
  'location': '서울 볼링장',
  'gameType': '정기전',
  'attendanceEnabled': false,
  'laneDrawEnabled': false,
  'laneDrawMode': 'BULK',
  'laneDrawStatus': 'NOT_STARTED',
  'myRole': 'MEMBER',
  'myAttendance': 'UNANSWERED',
  'counts': <String, int>{
    'attending': 0,
    'notAttending': 0,
    'unanswered': 1,
    'guests': 1,
  },
  'guests': <Object>[
    <String, Object>{'id': 'guest-private', 'name': '비공개 게스트'},
  ],
  'slots': <Object>[],
  'assignments': <Object>[],
  'myAssignment': null,
  'attendance': null,
  'bowlerHiddenEnabled': false,
  'competition': null,
});
