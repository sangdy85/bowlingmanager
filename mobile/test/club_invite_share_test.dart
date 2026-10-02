import 'dart:async';

import 'package:bowlingmanager_mobile/core/theme/app_theme.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/share/club_invite_share_card.dart';
import 'package:bowlingmanager_mobile/features/club/share/club_invite_share_data.dart';
import 'package:bowlingmanager_mobile/features/club/share/club_invite_share_preview_sheet.dart';
import 'package:bowlingmanager_mobile/shared/share/share_image_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const String _validUrl = 'https://www.bowlingmanager.co.kr/invite/team/A1B2C3';

void main() {
  group('ClubInviteShareData', () {
    test('uses only display fields and the server-provided invite URL', () {
      final ClubInviteShareData data = ClubInviteShareData.fromClub(
        ClubDetail(
          id: 'internal-team-id',
          name: '테스트 동호회',
          myRole: ClubRole.owner,
          memberCount: 24,
          inviteUrl: Uri.parse(_validUrl),
        ),
      );

      expect(data.clubName, '테스트 동호회');
      expect(data.memberCount, 24);
      expect(data.inviteUrl, _validUrl);
      expect(data.shareText, '테스트 동호회에서 함께 볼링 기록을 관리해보세요.\n$_validUrl');
    });

    test('requires an invite URL', () {
      expect(
        () => ClubInviteShareData.fromClub(
          const ClubDetail(
            id: 'team-1',
            name: '테스트 동호회',
            myRole: ClubRole.member,
            memberCount: 1,
          ),
        ),
        throwsArgumentError,
      );
    });
  });

  group('isValidClubInviteUrl', () {
    test('accepts the exact HTTPS invite route', () {
      expect(isValidClubInviteUrl(_validUrl), isTrue);
    });

    test('rejects unsafe or malformed invite URLs', () {
      const List<String> invalidValues = <String>[
        'http://www.bowlingmanager.co.kr/invite/team/A1B2C3',
        'https://bowlingmanager.co.kr/invite/team/A1B2C3',
        'https://evil.com/invite/team/A1B2C3',
        'https://www.bowlingmanager.co.kr.evil.com/invite/team/A1B2C3',
        'https://user@www.bowlingmanager.co.kr/invite/team/A1B2C3',
        'https://www.bowlingmanager.co.kr:443/invite/team/A1B2C3',
        '/invite/team/A1B2C3',
        'https://www.bowlingmanager.co.kr/invite/team/AAAA',
        'https://www.bowlingmanager.co.kr/invite/team/AAAAAAA',
        'https://www.bowlingmanager.co.kr/invite/team/ABC-12',
        'https://www.bowlingmanager.co.kr/invite/team/abc123',
        'https://www.bowlingmanager.co.kr/invite/team/A1B2C3?source=share',
        'https://www.bowlingmanager.co.kr/invite/team/A1B2C3#invite',
        'https://www.bowlingmanager.co.kr/invite/team/A1B2C3/',
      ];

      for (final String value in invalidValues) {
        expect(isValidClubInviteUrl(value), isFalse, reason: value);
      }
    });
  });

  testWidgets('card shows club name and member count without the full URL', (
    WidgetTester tester,
  ) async {
    const String longName = '아주 긴 이름을 가진 테스트 볼링 동호회 이름이 여러 줄을 넘어가는 경우';
    const ClubInviteShareData data = ClubInviteShareData(
      clubName: longName,
      memberCount: 24,
      inviteUrl: _validUrl,
    );
    await tester.binding.setSurfaceSize(const Size(400, 700));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.dark,
        home: const Scaffold(
          body: SingleChildScrollView(child: ClubInviteShareCard(data: data)),
        ),
      ),
    );

    expect(find.text(longName), findsOneWidget);
    expect(find.text('회원 24명'), findsOneWidget);
    expect(find.text(_validUrl), findsNothing);
    expect(
      tester.getSize(find.byKey(const Key('club-invite-share-card'))).width,
      ClubInviteShareCard.logicalWidth,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('preview shows card, explanation, and ordered actions', (
    WidgetTester tester,
  ) async {
    await _pumpPreview(tester, _FakeShareImageService());

    expect(find.byKey(const Key('club-invite-share-card')), findsOneWidget);
    expect(find.text('테스트 동호회'), findsWidgets);
    expect(find.text('회원 24명'), findsWidgets);
    expect(find.textContaining('동호회 가입 화면'), findsOneWidget);
    final double shareTop = tester
        .getTopLeft(find.byKey(const Key('club-invite-share-submit')))
        .dy;
    final double copyTop = tester
        .getTopLeft(find.byKey(const Key('club-invite-copy')))
        .dy;
    final double closeTop = tester
        .getTopLeft(find.byKey(const Key('club-invite-share-close')))
        .dy;
    expect(shareTop, lessThan(copyTop));
    expect(copyTop, lessThan(closeTop));
  });

  testWidgets('copy writes the exact URL and shows success feedback', (
    WidgetTester tester,
  ) async {
    final List<String> copied = <String>[];
    await _pumpPreview(
      tester,
      _FakeShareImageService(),
      clipboardWriter: (String value) async => copied.add(value),
    );

    await tester.tap(find.byKey(const Key('club-invite-copy')));
    await tester.pumpAndSettle();

    expect(copied, <String>[_validUrl]);
    expect(find.text('초대 링크를 복사했습니다.'), findsOneWidget);
  });

  testWidgets('clipboard failure is handled without crashing', (
    WidgetTester tester,
  ) async {
    await _pumpPreview(
      tester,
      _FakeShareImageService(),
      clipboardWriter: (String value) async => throw StateError('clipboard'),
    );

    await tester.tap(find.byKey(const Key('club-invite-copy')));
    await tester.pumpAndSettle();

    expect(find.text('초대 링크를 복사하지 못했습니다.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('invalid URL blocks both image sharing and clipboard writes', (
    WidgetTester tester,
  ) async {
    final _FakeShareImageService service = _FakeShareImageService();
    final List<String> copied = <String>[];
    await _pumpPreview(
      tester,
      service,
      data: const ClubInviteShareData(
        clubName: '테스트 동호회',
        memberCount: 24,
        inviteUrl: 'https://evil.com/invite/team/A1B2C3',
      ),
      clipboardWriter: (String value) async => copied.add(value),
    );

    await tester.tap(find.byKey(const Key('club-invite-share-submit')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('club-invite-copy')));
    await tester.pump();

    expect(service.callCount, 0);
    expect(copied, isEmpty);
    expect(find.text('유효한 초대 링크가 아닙니다.'), findsOneWidget);
  });

  testWidgets('pending share disables every action and prevents duplicates', (
    WidgetTester tester,
  ) async {
    final Completer<void> pending = Completer<void>();
    final _FakeShareImageService service = _FakeShareImageService(
      result: pending.future,
    );
    await _pumpPreview(tester, service);

    await tester.tap(find.byKey(const Key('club-invite-share-submit')));
    await tester.tap(find.byKey(const Key('club-invite-share-submit')));
    await tester.pump();

    expect(service.callCount, 1);
    expect(find.byKey(const Key('club-invite-share-progress')), findsOneWidget);
    expect(
      tester
          .widget<OutlinedButton>(find.byKey(const Key('club-invite-copy')))
          .onPressed,
      isNull,
    );
    expect(
      tester
          .widget<TextButton>(find.byKey(const Key('club-invite-share-close')))
          .onPressed,
      isNull,
    );

    pending.complete();
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('club-invite-share-progress')), findsNothing);
  });

  testWidgets('share sheet dismissal completion is not treated as an error', (
    WidgetTester tester,
  ) async {
    final _FakeShareImageService service = _FakeShareImageService();
    await _pumpPreview(tester, service);

    await tester.tap(find.byKey(const Key('club-invite-share-submit')));
    await tester.pumpAndSettle();

    expect(service.callCount, 1);
    expect(service.fileName, 'bowlingmanager-club-invite.png');
    expect(service.text, '테스트 동호회에서 함께 볼링 기록을 관리해보세요.\n$_validUrl');
    expect(find.byType(SnackBar), findsNothing);
  });
}

Future<void> _pumpPreview(
  WidgetTester tester,
  ShareImageService service, {
  ClubInviteShareData data = const ClubInviteShareData(
    clubName: '테스트 동호회',
    memberCount: 24,
    inviteUrl: _validUrl,
  ),
  InviteClipboardWriter? clipboardWriter,
}) async {
  await tester.binding.setSurfaceSize(const Size(430, 900));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.dark,
      home: Scaffold(
        body: ClubInviteSharePreviewSheet(
          data: data,
          service: service,
          clipboardWriter: clipboardWriter ?? (String value) async {},
        ),
      ),
    ),
  );
}

class _FakeShareImageService implements ShareImageService {
  _FakeShareImageService({this.result});

  final Future<void>? result;
  int callCount = 0;
  String? fileName;
  String? text;

  @override
  Future<void> share(
    GlobalKey boundaryKey, {
    required String fileName,
    required String text,
  }) async {
    callCount += 1;
    this.fileName = fileName;
    this.text = text;
    await result;
  }
}
