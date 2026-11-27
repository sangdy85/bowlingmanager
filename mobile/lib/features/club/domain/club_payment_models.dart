enum ClubGameFeeStatus {
  unpaid('UNPAID', '미결제'),
  transferRequested('TRANSFER_REQUESTED', '입금 확인 요청'),
  cashRequested('CASH_REQUESTED', '현장 결제 확인 요청'),
  transferConfirmed('TRANSFER_CONFIRMED', '입금 최종 확인'),
  cashConfirmed('CASH_CONFIRMED', '현장 결제 최종 확인');

  const ClubGameFeeStatus(this.apiValue, this.label);
  final String apiValue;
  final String label;
  bool get isPending => this == transferRequested || this == cashRequested;
  bool get isConfirmed => this == transferConfirmed || this == cashConfirmed;
  String get userLabel => isConfirmed ? '$label 완료' : label;
  static ClubGameFeeStatus fromJson(Object? value) => values.firstWhere(
    (item) => item.apiValue == value,
    orElse: () => throw const FormatException('Invalid game fee status.'),
  );
}

class ClubPaymentAccount {
  const ClubPaymentAccount({
    required this.bankName,
    required this.accountNumber,
    required this.holderName,
    this.id,
    this.kind,
    this.revision = 0,
  });
  final String? id;
  final String? kind;
  final String bankName;
  final String accountNumber;
  final String holderName;
  final int revision;
  factory ClubPaymentAccount.fromJson(Map<String, dynamic> json) =>
      ClubPaymentAccount(
        id: json['id'] as String?,
        kind: json['kind'] as String?,
        bankName: json['bankName'] as String,
        accountNumber: json['accountNumber'] as String,
        holderName: json['holderName'] as String,
        revision: json['revision'] as int? ?? 0,
      );
}

class ClubGameFee {
  const ClubGameFee({
    this.status = ClubGameFeeStatus.unpaid,
    this.revision = 0,
    this.account,
  });
  final ClubGameFeeStatus status;
  final int revision;
  final ClubPaymentAccount? account;
  factory ClubGameFee.fromJson(Map<String, dynamic> json) => ClubGameFee(
    status: ClubGameFeeStatus.fromJson(json['status']),
    revision: json['revision'] as int,
    account: json['account'] == null ? null : ClubPaymentAccount.fromJson(
      Map<String, dynamic>.from(json['account'] as Map),
    ),
  );
}
