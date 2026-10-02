import 'package:bowlingmanager_mobile/features/club/domain/club_finance_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('finance parsing', () {
    test('parses member charge and nullable myPayment without targets', () {
      final ClubChargesEnvelope envelope = ClubChargesEnvelope.fromJson(
        <String, dynamic>{
          'role': 'MEMBER',
          'charges': <Object>[
            <String, dynamic>{'charge': _charge(), 'myPayment': null},
          ],
        },
      );
      expect(envelope.role, ClubRole.member);
      expect(envelope.charges.single.myPayment, isNull);
      expect(envelope.charges.single.targets, isEmpty);
    });

    test('parses member payment with integer amount', () {
      final ClubChargeDetail detail = ClubChargeDetail.fromJson(
        <String, dynamic>{
          'role': 'MEMBER',
          'charge': _charge(),
          'myPayment': <String, dynamic>{
            'amount': 30000,
            'status': 'PAID',
            'paidAt': '2026-10-02T10:00:00.000Z',
          },
        },
      );
      expect(detail.item.myPayment?.amount, 30000);
      expect(detail.item.myPayment?.status, ClubPaymentStatus.paid);
    });

    test('rejects a privacy-breaking member target response', () {
      expect(
        () => ClubChargeDetail.fromJson(<String, dynamic>{
          'role': 'MEMBER',
          'charge': _charge(),
          'myPayment': null,
          'targets': <Object>[],
        }),
        throwsFormatException,
      );
    });

    test('parses manager summary, target, guest and audit', () {
      final ClubChargeDetail detail = ClubChargeDetail.fromJson(
        <String, dynamic>{
          'role': 'MANAGER',
          'charge': _charge(),
          'summary': _summary(),
          'targets': <Object>[_target(targetType: 'GUEST')],
        },
      );
      expect(detail.item.summary?.targetCount, 1);
      expect(detail.item.targets.single.targetType, ClubChargeTargetType.guest);
      expect(detail.item.targets.single.audits.single.actorDisplayName, '운영자');
    });

    test('parses finance dashboard aggregates', () {
      final ClubFinanceSummary value = ClubFinanceSummary.fromJson(
        <String, dynamic>{
          'role': 'OWNER',
          'charges': <String, int>{
            'total': 4,
            'draft': 1,
            'open': 1,
            'closed': 1,
            'cancelled': 1,
          },
          'totals': _summary(),
        },
      );
      expect(value.total, 4);
      expect(value.totals.expectedAmount, 30000);
    });

    test('rejects unknown enum, double amount and invalid date', () {
      expect(
        () => ClubCharge.fromJson(_charge()..['type'] = 'UNKNOWN'),
        throwsFormatException,
      );
      expect(
        () => ClubCharge.fromJson(_charge()..['amount'] = 30000.0),
        throwsFormatException,
      );
      expect(
        () => ClubCharge.fromJson(_charge()..['dueDate'] = '2026-02-30'),
        throwsFormatException,
      );
    });
  });

  test('formats KRW and compares date-only values without UTC conversion', () {
    expect(formatKrw(30000), '30,000원');
    expect(formatKrw(0), '0원');
    expect(displayFinanceDate('2026-10-02'), '2026.10.02');
    expect(
      isFinanceDateOverdue('2026-10-01', now: DateTime(2026, 10, 2, 0, 1)),
      isTrue,
    );
    expect(
      isFinanceDateOverdue('2026-10-02', now: DateTime(2026, 10, 2, 23, 59)),
      isFalse,
    );
  });

  test('charge draft sends event or member target contract exactly', () {
    const ClubChargeDraft monthly = ClubChargeDraft(
      type: ClubChargeType.monthlyDues,
      title: ' 10월 회비 ',
      amount: 30000,
      dueDate: '2026-10-10',
      targetMemberIds: <String>['m1'],
    );
    const ClubChargeDraft event = ClubChargeDraft(
      type: ClubChargeType.eventFee,
      title: '게임비',
      amount: 25000,
      dueDate: '2026-10-20',
      eventId: 'e1',
    );
    expect(monthly.toJson(), containsPair('targetMemberIds', <String>['m1']));
    expect(monthly.toJson().containsKey('eventId'), isFalse);
    expect(event.toJson(), containsPair('eventId', 'e1'));
    expect(event.toJson().containsKey('targetMemberIds'), isFalse);
  });
}

Map<String, dynamic> _charge() => <String, dynamic>{
  'id': 'charge-1',
  'eventId': null,
  'type': 'MONTHLY_DUES',
  'title': '10월 회비',
  'amount': 30000,
  'dueDate': '2026-10-10',
  'status': 'OPEN',
  'memo': '운영비',
  'createdAt': '2026-10-01T00:00:00.000Z',
  'updatedAt': '2026-10-01T00:00:00.000Z',
};
Map<String, dynamic> _summary() => <String, dynamic>{
  'targetCount': 1,
  'paidCount': 0,
  'unpaidCount': 1,
  'waivedCount': 0,
  'expectedAmount': 30000,
  'paidAmount': 0,
  'unpaidAmount': 30000,
  'waivedAmount': 0,
};
Map<String, dynamic> _target({String targetType = 'MEMBER'}) =>
    <String, dynamic>{
      'id': 'target-1',
      'targetType': targetType,
      'displayName': '게스트 김볼러',
      'amount': 30000,
      'status': 'UNPAID',
      'paidAt': null,
      'createdAt': '2026-10-01T00:00:00.000Z',
      'updatedAt': '2026-10-01T00:00:00.000Z',
      'audits': <Object>[
        <String, dynamic>{
          'id': 'audit-1',
          'action': 'MARK_PAID',
          'previousStatus': 'UNPAID',
          'nextStatus': 'PAID',
          'actorDisplayName': '운영자',
          'createdAt': '2026-10-01T00:00:00.000Z',
        },
      ],
    };
