import 'dart:async';

import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_finance_providers.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_finance_api.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_finance_repository.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_finance_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_finance_detail_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_finance_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';

void main() {
  testWidgets(
    'member sees only own unpaid state, overdue label and copy action',
    (WidgetTester tester) async {
      final _FakeFinanceApi api = _FakeFinanceApi.member();
      await _pump(tester, const ClubFinanceScreen(teamId: 'team-1'), api);
      expect(find.text('내 납부 현황'), findsOneWidget);
      expect(find.text('미납 1건  ·  납부 완료 0건'), findsOneWidget);
      expect(find.textContaining('기한 지남'), findsOneWidget);
      expect(find.text('다른 회원'), findsNothing);
    },
  );

  testWidgets('member detail explains manual confirmation and copies amount', (
    WidgetTester tester,
  ) async {
    final _FakeFinanceApi api = _FakeFinanceApi.member();
    await _pump(
      tester,
      const ClubFinanceDetailScreen(teamId: 'team-1', chargeId: 'charge-1'),
      api,
    );
    expect(find.textContaining('아직 납부 확인 전입니다.'), findsOneWidget);
    expect(find.text('다른 회원'), findsNothing);
    await tester.tap(find.byKey(const Key('finance-copy-amount')));
    await tester.pump();
    expect(find.text('금액을 복사했습니다.'), findsOneWidget);
  });

  testWidgets('member sees paid and waived labels without any other target', (
    WidgetTester tester,
  ) async {
    for (final ClubPaymentStatus status in <ClubPaymentStatus>[
      ClubPaymentStatus.paid,
      ClubPaymentStatus.waived,
    ]) {
      await _pump(
        tester,
        const ClubFinanceScreen(teamId: 'team-1'),
        _FakeFinanceApi.member(status: status),
      );
      expect(find.text(status.label), findsOneWidget);
      expect(find.text('다른 회원'), findsNothing);
    }
  });

  testWidgets('manager list labels draft closed and cancelled charges', (
    WidgetTester tester,
  ) async {
    for (final ClubChargeStatus status in <ClubChargeStatus>[
      ClubChargeStatus.draft,
      ClubChargeStatus.closed,
      ClubChargeStatus.cancelled,
    ]) {
      await _pump(
        tester,
        const ClubFinanceScreen(teamId: 'team-1'),
        _FakeFinanceApi.manager(status: status),
      );
      expect(find.text(status.label), findsOneWidget);
    }
  });

  testWidgets('manager sees aggregate, charge status, target and guest badge', (
    WidgetTester tester,
  ) async {
    final _FakeFinanceApi api = _FakeFinanceApi.manager();
    await _pump(tester, const ClubFinanceScreen(teamId: 'team-1'), api);
    expect(find.byKey(const Key('finance-manager-summary')), findsOneWidget);
    expect(find.text('30,000원'), findsWidgets);
    expect(find.byKey(const Key('finance-new-charge')), findsOneWidget);
    await _pump(
      tester,
      const ClubFinanceDetailScreen(teamId: 'team-1', chargeId: 'charge-1'),
      api,
    );
    expect(find.text('게스트 김볼러'), findsOneWidget);
    expect(find.text('게스트'), findsOneWidget);
    expect(find.text('납부 확인'), findsOneWidget);
    expect(find.text('면제'), findsOneWidget);
    final OutlinedButton reminder = tester.widget(
      find.byKey(const Key('finance-reminder-button')),
    );
    expect(reminder.onPressed, isNull);
    expect(find.text('알림 가능한 회원 미납자가 없습니다.'), findsOneWidget);
  });

  testWidgets(
    'OPEN manager confirms one reminder request and sees processed wording',
    (WidgetTester tester) async {
      final Completer<ClubFinanceReminderResult> completer =
          Completer<ClubFinanceReminderResult>();
      final _FakeFinanceApi api = _FakeFinanceApi.manager(
        memberTarget: true,
        reminderCompleter: completer,
      );
      await _pump(
        tester,
        const ClubFinanceDetailScreen(teamId: 'team-1', chargeId: 'charge-1'),
        api,
      );
      final Finder button = find.byKey(const Key('finance-reminder-button'));
      expect((tester.widget<OutlinedButton>(button)).onPressed, isNotNull);
      await tester.tap(button);
      await tester.tap(button, warnIfMissed: false);
      await tester.pump();
      expect(find.text('미납 회원에게 알림을 보낼까요?'), findsOneWidget);
      expect(find.textContaining('중복 알림이 생성되지 않습니다.'), findsOneWidget);
      await tester.tap(find.byKey(const Key('finance-reminder-confirm')));
      await tester.pump();
      expect(api.reminderCalls, 1);
      expect((tester.widget<OutlinedButton>(button)).onPressed, isNull);
      await tester.tap(button, warnIfMissed: false);
      expect(api.reminderCalls, 1);
      completer.complete(
        const ClubFinanceReminderResult(
          eligibleMemberCount: 1,
          unpaidGuestCount: 0,
          skippedUnavailableMemberCount: 0,
          processed: true,
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('미납 알림 요청을 처리했습니다. 대상 1명'), findsOneWidget);
      expect(find.textContaining('전송 완료'), findsNothing);
    },
  );

  testWidgets('non-OPEN charges never show the reminder action', (
    WidgetTester tester,
  ) async {
    for (final ClubChargeStatus status in <ClubChargeStatus>[
      ClubChargeStatus.draft,
      ClubChargeStatus.closed,
      ClubChargeStatus.cancelled,
    ]) {
      await _pump(
        tester,
        const ClubFinanceDetailScreen(teamId: 'team-1', chargeId: 'charge-1'),
        _FakeFinanceApi.manager(status: status, memberTarget: true),
      );
      expect(find.byKey(const Key('finance-reminder-button')), findsNothing);
    }
  });

  testWidgets('reminder API errors use the safe finance message', (
    WidgetTester tester,
  ) async {
    final _FakeFinanceApi api = _FakeFinanceApi.manager(
      memberTarget: true,
      reminderFailure: true,
    );
    await _pump(
      tester,
      const ClubFinanceDetailScreen(teamId: 'team-1', chargeId: 'charge-1'),
      api,
    );
    await tester.tap(find.byKey(const Key('finance-reminder-button')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('finance-reminder-confirm')));
    await tester.pumpAndSettle();
    expect(find.text('요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'), findsOneWidget);
  });
}

Future<void> _pump(
  WidgetTester tester,
  Widget child,
  ClubFinanceApi api,
) async {
  final FakeAuthRepository auth = FakeAuthRepository()
    ..bootstrapResult = testUser;
  await tester.pumpWidget(
    ProviderScope(
      key: UniqueKey(),
      overrides: [
        authRepositoryProvider.overrideWithValue(auth),
        clubFinanceRepositoryProvider.overrideWithValue(
          ClubFinanceRepository(api),
        ),
      ],
      child: MaterialApp(home: child),
    ),
  );
  for (int i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

class _FakeFinanceApi extends ClubFinanceApi {
  _FakeFinanceApi._(
    this.role, {
    this.paymentStatus = ClubPaymentStatus.unpaid,
    this.chargeStatus = ClubChargeStatus.open,
    this.memberTarget = false,
    this.reminderCompleter,
    this.reminderFailure = false,
  }) : super(Dio());
  factory _FakeFinanceApi.member({
    ClubPaymentStatus status = ClubPaymentStatus.unpaid,
  }) => _FakeFinanceApi._(ClubRole.member, paymentStatus: status);
  factory _FakeFinanceApi.manager({
    ClubChargeStatus status = ClubChargeStatus.open,
    bool memberTarget = false,
    Completer<ClubFinanceReminderResult>? reminderCompleter,
    bool reminderFailure = false,
  }) => _FakeFinanceApi._(
    ClubRole.manager,
    chargeStatus: status,
    memberTarget: memberTarget,
    reminderCompleter: reminderCompleter,
    reminderFailure: reminderFailure,
  );
  final ClubRole role;
  final ClubPaymentStatus paymentStatus;
  final ClubChargeStatus chargeStatus;
  final bool memberTarget;
  final Completer<ClubFinanceReminderResult>? reminderCompleter;
  final bool reminderFailure;
  int reminderCalls = 0;
  @override
  Future<ClubChargesEnvelope> fetchCharges(String teamId) async =>
      ClubChargesEnvelope(role: role, charges: <ClubChargeItem>[_item]);
  @override
  Future<ClubFinanceSummary> fetchSummary(String teamId) async =>
      ClubFinanceSummary(
        role: role,
        total: 1,
        draft: 0,
        open: 1,
        closed: 0,
        cancelled: 0,
        totals: _summary,
      );
  @override
  Future<ClubChargeDetail> fetchCharge(String teamId, String chargeId) async =>
      ClubChargeDetail(role: role, item: _item);
  @override
  Future<ClubFinanceReminderResult> remindUnpaidMembers(
    String teamId,
    String chargeId,
  ) async {
    reminderCalls += 1;
    if (reminderFailure) throw Exception('synthetic failure');
    if (reminderCompleter != null) return reminderCompleter!.future;
    return const ClubFinanceReminderResult(
      eligibleMemberCount: 1,
      unpaidGuestCount: 0,
      skippedUnavailableMemberCount: 0,
      processed: true,
    );
  }

  ClubCharge get _charge => ClubCharge(
    id: 'charge-1',
    type: ClubChargeType.monthlyDues,
    title: '10월 회비',
    amount: 30000,
    dueDate: '2020-10-10',
    status: chargeStatus,
    memo: '운영비',
    createdAt: _stamp,
    updatedAt: _stamp,
  );
  ClubChargeItem get _item => role == ClubRole.member
      ? ClubChargeItem(
          charge: _charge,
          myPayment: ClubMyPayment(amount: 30000, status: paymentStatus),
        )
      : ClubChargeItem(
          charge: _charge,
          summary: _summary,
          targets: <ClubChargeTarget>[memberTarget ? _memberTarget : _target],
        );
}

final DateTime _stamp = DateTime.utc(2026, 10);
const ClubChargeSummary _summary = ClubChargeSummary(
  targetCount: 1,
  paidCount: 0,
  unpaidCount: 1,
  waivedCount: 0,
  expectedAmount: 30000,
  paidAmount: 0,
  unpaidAmount: 30000,
  waivedAmount: 0,
);
final ClubChargeTarget _target = ClubChargeTarget(
  id: 'target-1',
  targetType: ClubChargeTargetType.guest,
  memberId: null,
  displayName: '게스트 김볼러',
  amount: 30000,
  status: ClubPaymentStatus.unpaid,
  createdAt: _stamp,
  updatedAt: _stamp,
  audits: const <ClubPaymentAudit>[],
);

final ClubChargeTarget _memberTarget = ClubChargeTarget(
  id: 'target-member-1',
  targetType: ClubChargeTargetType.member,
  memberId: 'member-1',
  displayName: '회원 김볼러',
  amount: 25000,
  status: ClubPaymentStatus.unpaid,
  createdAt: _stamp,
  updatedAt: _stamp,
  audits: const <ClubPaymentAudit>[],
);
