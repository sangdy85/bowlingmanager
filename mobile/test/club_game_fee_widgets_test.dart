import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_payment_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_game_fee_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'club_event_models_test.dart' show eventJson;

void main() {
  ClubEvent event({String status = 'UNPAID', bool account = true}) => ClubEvent.fromJson(eventJson()
    ..['myGameFee'] = <String, dynamic>{'status': status, 'revision': 3}
    ..['gameFeeAccount'] = account ? <String, dynamic>{
      'id': 'game-account', 'revision': 2, 'bankName': '카카오뱅크',
      'accountNumber': '3333121234567', 'holderName': '회장',
    } : null);

  testWidgets('transfer choice shows account and only completion submits a report', (tester) async {
    final calls = <Map<String, dynamic>>[];
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: ClubGameFeeActions(
      event: event(), working: false, onAction: (body) async { calls.add(body); },
    ))));
    await tester.tap(find.text('게임비 입금'));
    await tester.pumpAndSettle();
    expect(calls, isEmpty);
    expect(find.text('카카오뱅크'), findsOneWidget);
    expect(find.text('3333121234567'), findsOneWidget);
    await tester.tap(find.text('입금 완료'));
    await tester.pumpAndSettle();
    expect(calls.single, <String, dynamic>{
      'action': 'REQUEST_TRANSFER', 'revision': 3, 'accountId': 'game-account', 'accountRevision': 2,
    });
  });

  testWidgets('cash choice also requires a second completion action', (tester) async {
    final calls = <Map<String, dynamic>>[];
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: ClubGameFeeActions(
      event: event(account: false), working: false, onAction: (body) async { calls.add(body); },
    ))));
    await tester.tap(find.text('현장 결제'));
    await tester.pumpAndSettle();
    expect(calls, isEmpty);
    await tester.tap(find.text('현장 결제 완료'));
    await tester.pumpAndSettle();
    expect(calls.single['action'], 'REQUEST_CASH');
  });

  testWidgets('missing account prevents transfer completion', (tester) async {
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: ClubGameFeeActions(
      event: event(account: false), working: false, onAction: (_) async { fail('Must not report without account'); },
    ))));
    await tester.tap(find.text('게임비 입금'));
    await tester.pumpAndSettle();
    expect(find.text('입금 완료'), findsNothing);
    expect(find.textContaining('계좌가 아직 설정되지'), findsOneWidget);
  });

  testWidgets('administrator verifies pending payment before confirming', (tester) async {
    final calls = <Map<String, dynamic>>[];
    const item = ClubEventAttendanceItem(memberId: 'member', name: '회원', status: ClubEventAttendance.attending,
      gameFee: ClubGameFee(status: ClubGameFeeStatus.transferRequested, revision: 1));
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: ClubGameFeeAdminStatus(
      item: item, working: false, onAction: (body) async { calls.add(body); },
    ))));
    expect(find.text('입금 확인 요청'), findsOneWidget);
    await tester.tap(find.text('입금 확인'));
    await tester.pumpAndSettle();
    expect(calls, isEmpty);
    await tester.tap(find.widgetWithText(FilledButton, '입금 확인'));
    await tester.pumpAndSettle();
    expect(calls.single, <String, dynamic>{'action': 'CONFIRM_TRANSFER', 'memberId': 'member', 'revision': 1});
  });

  testWidgets('confirmed user sees final label and cannot submit again', (tester) async {
    for (final status in <String>['TRANSFER_CONFIRMED', 'CASH_CONFIRMED']) {
      await tester.pumpWidget(MaterialApp(home: Scaffold(body: ClubGameFeeActions(
        event: event(status: status), working: false, onAction: (_) async { fail('Already confirmed'); },
      ))));
      expect(find.text(status == 'TRANSFER_CONFIRMED' ? '입금 최종 확인 완료' : '현장 결제 최종 확인 완료'), findsOneWidget);
      expect(find.text('게임비 입금'), findsNothing);
      expect(find.text('확인 요청 취소'), findsNothing);
    }
  });
}
