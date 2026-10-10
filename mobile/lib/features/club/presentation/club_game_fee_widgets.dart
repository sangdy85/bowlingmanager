import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_payment_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

typedef GameFeeAction = Future<void> Function(Map<String, dynamic> body);

class ClubGameFeeActions extends StatelessWidget {
  const ClubGameFeeActions({required this.event, required this.working, required this.onAction, super.key});
  final ClubEvent event;
  final bool working;
  final GameFeeAction onAction;

  @override
  Widget build(BuildContext context) {
    final fee = event.myGameFee;
    if (fee.status == ClubGameFeeStatus.unpaid) {
      return Wrap(spacing: 8, runSpacing: 8, children: <Widget>[
        OutlinedButton.icon(
          key: const Key('game-fee-transfer'),
          onPressed: working ? null : () => _request(context, true),
          icon: const Icon(Icons.account_balance_outlined),
          label: const Text('게임비 입금'),
        ),
        OutlinedButton.icon(
          key: const Key('game-fee-cash'),
          onPressed: working ? null : () => _request(context, false),
          icon: const Icon(Icons.payments_outlined),
          label: const Text('현장 결제'),
        ),
      ]);
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
      Text(fee.status.userLabel, key: const Key('my-game-fee-status'),
        style: const TextStyle(fontWeight: FontWeight.w700)),
      if (fee.status.isPending) ...<Widget>[
        const Text('관리자가 확인하면 최종 확인 완료로 표시됩니다.'),
        TextButton(
          onPressed: working ? null : () async {
            final cancel = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      scrollable: true,
              title: const Text('확인 요청 취소'),
              content: const Text('신고만 취소되며 입금이나 결제가 환불되지는 않습니다.'),
              actions: <Widget>[
                TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('돌아가기')),
                FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('요청 취소')),
              ],
            ));
            if (cancel == true && context.mounted) {
              await onAction(<String, dynamic>{'action': 'CANCEL_REQUEST', 'revision': fee.revision});
            }
          },
          child: const Text('확인 요청 취소'),
        ),
      ],
    ]);
  }

  Future<void> _request(BuildContext context, bool transfer) async {
    final account = event.gameFeeAccount;
    final allowed = !transfer || account != null;
    final done = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      scrollable: true,
      title: Text(transfer ? '게임비 입금' : '현장 결제'),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
        if (transfer && account != null) ...<Widget>[
          PaymentAccountDetails(account: account),
          const SizedBox(height: 12),
          const Text('은행 앱에서 입금한 뒤 입금 완료를 눌러주세요.'),
        ] else if (transfer)
          const Text('게임비 입금 계좌가 아직 설정되지 않았습니다. 관리자에게 문의해주세요.')
        else
          const Text('현장에서 실제로 결제한 뒤 현장 결제 완료를 눌러주세요.'),
        if (allowed) const Text('관리자의 확인을 거쳐 최종 완료됩니다.'),
      ]),
      actions: <Widget>[
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('닫기')),
        if (allowed) FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: Text(transfer ? '입금 완료' : '현장 결제 완료'),
        ),
      ],
    ));
    if (done == true && context.mounted) {
      await onAction(<String, dynamic>{
        'action': transfer ? 'REQUEST_TRANSFER' : 'REQUEST_CASH',
        'revision': event.myGameFee.revision,
        if (transfer) 'accountId': account!.id,
        if (transfer) 'accountRevision': account!.revision,
      });
    }
  }
}

class ClubGameFeeAdminStatus extends StatelessWidget {
  const ClubGameFeeAdminStatus({required this.item, required this.working, required this.onAction, super.key});
  final ClubEventAttendanceItem item;
  final bool working;
  final GameFeeAction onAction;

  @override
  Widget build(BuildContext context) {
    final fee = item.gameFee ?? const ClubGameFee();
    return Wrap(spacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: <Widget>[
      Text(fee.status.label),
      if (fee.status.isPending) OutlinedButton(
        onPressed: working ? null : () => _confirm(context, fee),
        child: Text(fee.status == ClubGameFeeStatus.transferRequested ? '입금 확인' : '현장 결제 확인'),
      ),
    ]);
  }

  Future<void> _confirm(BuildContext context, ClubGameFee fee) async {
    final transfer = fee.status == ClubGameFeeStatus.transferRequested;
    final confirmed = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      scrollable: true,
      title: Text(transfer ? '입금 확인' : '현장 결제 확인'),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
        Text('${item.name}님의 ${transfer ? '입금 내역' : '현장 결제'}을 확인하셨나요?'),
        if (fee.account != null) ...<Widget>[
          const SizedBox(height: 12),
          const Text('입금 신고 당시 계좌'),
          PaymentAccountDetails(account: fee.account!),
        ],
        const SizedBox(height: 12),
        const Text('확인하면 회원에게 최종 확인 완료로 표시됩니다.'),
      ]),
      actions: <Widget>[
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('취소')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(transfer ? '입금 확인' : '현장 결제 확인')),
      ],
    ));
    if (confirmed == true && context.mounted) {
      await onAction(<String, dynamic>{
        'action': transfer ? 'CONFIRM_TRANSFER' : 'CONFIRM_CASH',
        'memberId': item.memberId,
        'revision': fee.revision,
      });
    }
  }
}

class PaymentAccountDetails extends StatelessWidget {
  const PaymentAccountDetails({required this.account, super.key});
  final ClubPaymentAccount account;
  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start,
    children: <Widget>[
      Text(account.bankName),
      SelectableText(account.accountNumber),
      Text('예금주: ${account.holderName}'),
      TextButton.icon(
        onPressed: () async {
          await Clipboard.setData(ClipboardData(text: account.accountNumber));
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('계좌번호를 복사했습니다.')));
          }
        },
        icon: const Icon(Icons.copy_outlined), label: const Text('계좌번호 복사'),
      ),
    ],
  );
}
