import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';

enum ClubChargeType {
  monthlyDues('MONTHLY_DUES', '월 회비'),
  eventFee('EVENT_FEE', '이벤트 게임비'),
  other('OTHER', '기타');

  const ClubChargeType(this.apiValue, this.label);
  final String apiValue;
  final String label;
  static ClubChargeType fromJson(Object? value) => values.firstWhere(
    (ClubChargeType item) => item.apiValue == value,
    orElse: () => throw const FormatException('Invalid charge type.'),
  );
}

enum ClubChargeStatus {
  draft('DRAFT', '초안'),
  open('OPEN', '공개'),
  closed('CLOSED', '마감'),
  cancelled('CANCELLED', '취소');

  const ClubChargeStatus(this.apiValue, this.label);
  final String apiValue;
  final String label;
  static ClubChargeStatus fromJson(Object? value) => values.firstWhere(
    (ClubChargeStatus item) => item.apiValue == value,
    orElse: () => throw const FormatException('Invalid charge status.'),
  );
}

enum ClubPaymentStatus {
  unpaid('UNPAID', '미납'),
  paid('PAID', '납부완료'),
  waived('WAIVED', '면제');

  const ClubPaymentStatus(this.apiValue, this.label);
  final String apiValue;
  final String label;
  static ClubPaymentStatus fromJson(Object? value) => values.firstWhere(
    (ClubPaymentStatus item) => item.apiValue == value,
    orElse: () => throw const FormatException('Invalid payment status.'),
  );
}

enum ClubChargeTargetType {
  member('MEMBER'),
  guest('GUEST');

  const ClubChargeTargetType(this.apiValue);
  final String apiValue;
  static ClubChargeTargetType fromJson(Object? value) => values.firstWhere(
    (ClubChargeTargetType item) => item.apiValue == value,
    orElse: () => throw const FormatException('Invalid target type.'),
  );
}

enum ClubPaymentAction {
  markPaid('MARK_PAID'),
  markUnpaid('MARK_UNPAID'),
  waive('WAIVE'),
  unwaive('UNWAIVE');

  const ClubPaymentAction(this.apiValue);
  final String apiValue;
}

class ClubCharge {
  const ClubCharge({
    required this.id,
    this.eventId,
    required this.type,
    required this.title,
    required this.amount,
    required this.dueDate,
    required this.status,
    this.memo,
    required this.createdAt,
    required this.updatedAt,
  });
  final String id;
  final String? eventId;
  final ClubChargeType type;
  final String title;
  final int amount;
  final String dueDate;
  final ClubChargeStatus status;
  final String? memo;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory ClubCharge.fromJson(Map<String, dynamic> json) {
    final String id = _string(json['id']);
    final Object? eventId = json['eventId'];
    final String title = _string(json['title']);
    final int amount = _integer(json['amount'], minimum: 1);
    final String dueDate = parseFinanceDateOnly(json['dueDate']);
    final Object? memo = json['memo'];
    if ((eventId != null && eventId is! String) ||
        (memo != null && memo is! String)) {
      throw const FormatException('Invalid charge.');
    }
    return ClubCharge(
      id: id,
      eventId: eventId as String?,
      type: ClubChargeType.fromJson(json['type']),
      title: title,
      amount: amount,
      dueDate: dueDate,
      status: ClubChargeStatus.fromJson(json['status']),
      memo: memo as String?,
      createdAt: _dateTime(json['createdAt']),
      updatedAt: _dateTime(json['updatedAt']),
    );
  }
}

class ClubChargeSummary {
  const ClubChargeSummary({
    required this.targetCount,
    required this.paidCount,
    required this.unpaidCount,
    required this.waivedCount,
    required this.expectedAmount,
    required this.paidAmount,
    required this.unpaidAmount,
    required this.waivedAmount,
  });
  final int targetCount, paidCount, unpaidCount, waivedCount;
  final int expectedAmount, paidAmount, unpaidAmount, waivedAmount;
  factory ClubChargeSummary.fromJson(Map<String, dynamic> json) =>
      ClubChargeSummary(
        targetCount: _integer(json['targetCount']),
        paidCount: _integer(json['paidCount']),
        unpaidCount: _integer(json['unpaidCount']),
        waivedCount: _integer(json['waivedCount']),
        expectedAmount: _integer(json['expectedAmount']),
        paidAmount: _integer(json['paidAmount']),
        unpaidAmount: _integer(json['unpaidAmount']),
        waivedAmount: _integer(json['waivedAmount']),
      );
}

class ClubMyPayment {
  const ClubMyPayment({
    required this.amount,
    required this.status,
    this.paidAt,
  });
  final int amount;
  final ClubPaymentStatus status;
  final DateTime? paidAt;
  factory ClubMyPayment.fromJson(Map<String, dynamic> json) => ClubMyPayment(
    amount: _integer(json['amount']),
    status: ClubPaymentStatus.fromJson(json['status']),
    paidAt: json['paidAt'] == null ? null : _dateTime(json['paidAt']),
  );
}

class ClubPaymentAudit {
  const ClubPaymentAudit({
    required this.id,
    required this.action,
    required this.previousStatus,
    required this.nextStatus,
    required this.actorDisplayName,
    required this.createdAt,
  });
  final String id, action, actorDisplayName;
  final ClubPaymentStatus previousStatus, nextStatus;
  final DateTime createdAt;
  factory ClubPaymentAudit.fromJson(Map<String, dynamic> json) =>
      ClubPaymentAudit(
        id: _string(json['id']),
        action: _string(json['action']),
        previousStatus: ClubPaymentStatus.fromJson(json['previousStatus']),
        nextStatus: ClubPaymentStatus.fromJson(json['nextStatus']),
        actorDisplayName: _string(json['actorDisplayName']),
        createdAt: _dateTime(json['createdAt']),
      );
}

class ClubChargeTarget {
  const ClubChargeTarget({
    required this.id,
    required this.targetType,
    required this.memberId,
    required this.displayName,
    required this.amount,
    required this.status,
    this.paidAt,
    required this.createdAt,
    required this.updatedAt,
    required this.audits,
  });
  final String id, displayName;
  final ClubChargeTargetType targetType;
  final String? memberId;
  final int amount;
  final ClubPaymentStatus status;
  final DateTime? paidAt;
  final DateTime createdAt, updatedAt;
  final List<ClubPaymentAudit> audits;
  factory ClubChargeTarget.fromJson(Map<String, dynamic> json) {
    if (!json.containsKey('memberId')) {
      throw const FormatException('Missing target member identity.');
    }
    final ClubChargeTargetType targetType = ClubChargeTargetType.fromJson(
      json['targetType'],
    );
    final Object? memberId = json['memberId'];
    if ((memberId != null && (memberId is! String || memberId.isEmpty)) ||
        (targetType == ClubChargeTargetType.guest && memberId != null)) {
      throw const FormatException('Invalid target member identity.');
    }
    return ClubChargeTarget(
      id: _string(json['id']),
      targetType: targetType,
      memberId: memberId as String?,
      displayName: _string(json['displayName']),
      amount: _integer(json['amount']),
      status: ClubPaymentStatus.fromJson(json['status']),
      paidAt: json['paidAt'] == null ? null : _dateTime(json['paidAt']),
      createdAt: _dateTime(json['createdAt']),
      updatedAt: _dateTime(json['updatedAt']),
      audits: _list(json['audits'], ClubPaymentAudit.fromJson),
    );
  }
}

class ClubDraftTargetSelection {
  const ClubDraftTargetSelection({
    required this.memberIds,
    required this.locked,
  });

  final Set<String> memberIds;
  final bool locked;
}

ClubDraftTargetSelection resolveClubDraftTargetSelection({
  required List<ClubChargeTarget> targets,
  required Set<String> currentMemberIds,
}) {
  final Set<String> selected = <String>{};
  for (final ClubChargeTarget target in targets) {
    final String? memberId = target.memberId;
    if (target.targetType != ClubChargeTargetType.member ||
        memberId == null ||
        !currentMemberIds.contains(memberId)) {
      return const ClubDraftTargetSelection(
        memberIds: <String>{},
        locked: true,
      );
    }
    selected.add(memberId);
  }
  return ClubDraftTargetSelection(memberIds: selected, locked: false);
}

class ClubChargeItem {
  const ClubChargeItem({
    required this.charge,
    this.myPayment,
    this.summary,
    this.targets = const <ClubChargeTarget>[],
  });
  final ClubCharge charge;
  final ClubMyPayment? myPayment;
  final ClubChargeSummary? summary;
  final List<ClubChargeTarget> targets;

  factory ClubChargeItem.member(Map<String, dynamic> json) {
    if (json.containsKey('summary') || json.containsKey('targets')) {
      throw const FormatException('Member response leaked targets.');
    }
    return ClubChargeItem(
      charge: ClubCharge.fromJson(_map(json['charge'])),
      myPayment: json['myPayment'] == null
          ? null
          : ClubMyPayment.fromJson(_map(json['myPayment'])),
    );
  }
  factory ClubChargeItem.manager(Map<String, dynamic> json) {
    if (json.containsKey('myPayment')) {
      throw const FormatException('Invalid manager response.');
    }
    return ClubChargeItem(
      charge: ClubCharge.fromJson(_map(json['charge'])),
      summary: ClubChargeSummary.fromJson(_map(json['summary'])),
      targets: _list(json['targets'], ClubChargeTarget.fromJson),
    );
  }
}

class ClubChargesEnvelope {
  const ClubChargesEnvelope({required this.role, required this.charges});
  final ClubRole role;
  final List<ClubChargeItem> charges;
  bool get canManage => role != ClubRole.member;
  factory ClubChargesEnvelope.fromJson(Map<String, dynamic> json) {
    final ClubRole role = ClubRole.fromJson(json['role']);
    return ClubChargesEnvelope(
      role: role,
      charges: _list(
        json['charges'],
        role == ClubRole.member
            ? ClubChargeItem.member
            : ClubChargeItem.manager,
      ),
    );
  }
}

class ClubChargeDetail {
  const ClubChargeDetail({required this.role, required this.item});
  final ClubRole role;
  final ClubChargeItem item;
  bool get canManage => role != ClubRole.member;
  factory ClubChargeDetail.fromJson(Map<String, dynamic> json) {
    final ClubRole role = ClubRole.fromJson(json['role']);
    return ClubChargeDetail(
      role: role,
      item: role == ClubRole.member
          ? ClubChargeItem.member(json)
          : ClubChargeItem.manager(json),
    );
  }
}

class ClubFinanceSummary {
  const ClubFinanceSummary({
    required this.role,
    required this.total,
    required this.draft,
    required this.open,
    required this.closed,
    required this.cancelled,
    required this.totals,
  });
  final ClubRole role;
  final int total, draft, open, closed, cancelled;
  final ClubChargeSummary totals;
  factory ClubFinanceSummary.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> charges = _map(json['charges']);
    return ClubFinanceSummary(
      role: ClubRole.fromJson(json['role']),
      total: _integer(charges['total']),
      draft: _integer(charges['draft']),
      open: _integer(charges['open']),
      closed: _integer(charges['closed']),
      cancelled: _integer(charges['cancelled']),
      totals: ClubChargeSummary.fromJson(_map(json['totals'])),
    );
  }
}

class ClubFinanceReminderResult {
  const ClubFinanceReminderResult({
    required this.eligibleMemberCount,
    required this.unpaidGuestCount,
    required this.skippedUnavailableMemberCount,
    required this.processed,
  });

  final int eligibleMemberCount;
  final int unpaidGuestCount;
  final int skippedUnavailableMemberCount;
  final bool processed;

  factory ClubFinanceReminderResult.fromJson(Map<String, dynamic> json) {
    if (json['processed'] != true) {
      throw const FormatException('Invalid finance reminder response.');
    }
    return ClubFinanceReminderResult(
      eligibleMemberCount: _integer(json['eligibleMemberCount']),
      unpaidGuestCount: _integer(json['unpaidGuestCount']),
      skippedUnavailableMemberCount: _integer(
        json['skippedUnavailableMemberCount'],
      ),
      processed: json['processed'] as bool,
    );
  }
}

class ClubChargeDraft {
  const ClubChargeDraft({
    required this.type,
    required this.title,
    required this.amount,
    required this.dueDate,
    this.memo,
    this.eventId,
    this.targetMemberIds = const <String>[],
  });
  final ClubChargeType type;
  final String title;
  final int amount;
  final String dueDate;
  final String? memo, eventId;
  final List<String> targetMemberIds;
  Map<String, dynamic> toJson() => <String, dynamic>{
    'type': type.apiValue,
    'title': title.trim(),
    'amount': amount,
    'dueDate': dueDate,
    'memo': memo?.trim().isEmpty == true ? null : memo?.trim(),
    if (type == ClubChargeType.eventFee)
      'eventId': eventId
    else
      'targetMemberIds': targetMemberIds,
  };
}

String formatKrw(int amount) {
  final String digits = amount.abs().toString();
  final StringBuffer value = StringBuffer();
  for (int i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) {
      value.write(',');
    }
    value.write(digits[i]);
  }
  return '${amount < 0 ? '-' : ''}$value원';
}

String parseFinanceDateOnly(Object? value) {
  if (value is! String || !RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value)) {
    throw const FormatException('Invalid date-only value.');
  }
  final List<int> parts = value.split('-').map(int.parse).toList();
  final DateTime date = DateTime(parts[0], parts[1], parts[2]);
  if (date.year != parts[0] || date.month != parts[1] || date.day != parts[2]) {
    throw const FormatException('Invalid date-only value.');
  }
  return value;
}

String displayFinanceDate(String value) =>
    parseFinanceDateOnly(value).replaceAll('-', '.');
bool isFinanceDateOverdue(String value, {DateTime? now}) {
  final List<int> p = parseFinanceDateOnly(value)
      .split('-')
      .map(int.parse)
      .toList();
  final DateTime due = DateTime(p[0], p[1], p[2]);
  final DateTime current = now ?? DateTime.now();
  return due.isBefore(DateTime(current.year, current.month, current.day));
}

String _string(Object? value) {
  if (value is! String || value.isEmpty) {
    throw const FormatException('Expected string.');
  }
  return value;
}

int _integer(Object? value, {int minimum = 0}) {
  if (value is! int || value < minimum) {
    throw const FormatException('Expected integer.');
  }
  return value;
}

DateTime _dateTime(Object? value) {
  if (value is! String) throw const FormatException('Expected date-time.');
  final DateTime? result = DateTime.tryParse(value);
  if (result == null) throw const FormatException('Expected date-time.');
  return result;
}

Map<String, dynamic> _map(Object? value) {
  if (value is! Map) throw const FormatException('Expected object.');
  return Map<String, dynamic>.from(value);
}

List<T> _list<T>(Object? value, T Function(Map<String, dynamic>) parse) {
  if (value is! List) throw const FormatException('Expected list.');
  return value.map((Object? item) => parse(_map(item))).toList(growable: false);
}
