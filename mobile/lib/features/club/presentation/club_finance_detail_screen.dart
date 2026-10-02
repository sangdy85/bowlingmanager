import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_finance_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_finance_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubFinanceDetailScreen extends ConsumerStatefulWidget {
  const ClubFinanceDetailScreen({
    required this.teamId,
    required this.chargeId,
    super.key,
  });
  final String teamId, chargeId;
  @override
  ConsumerState<ClubFinanceDetailScreen> createState() => _State();
}

class _State extends ConsumerState<ClubFinanceDetailScreen> {
  bool _busy = false;
  bool _reminderConfirmationOpen = false;
  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final ClubChargeRequest request = (
      userId: user.id,
      teamId: widget.teamId,
      chargeId: widget.chargeId,
    );
    final state = ref.watch(clubChargeProvider(request));
    return Scaffold(
      appBar: AppBar(title: const Text('회비 상세')),
      body: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (Object error, StackTrace _) =>
            Center(child: Text(clubFinanceErrorMessage(error))),
        data: (ClubChargeDetail detail) => RefreshIndicator(
          onRefresh: () => ref.refresh(clubChargeProvider(request).future),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(20),
            children: <Widget>[
              _ChargeInfo(detail: detail),
              const SizedBox(height: 16),
              if (detail.canManage) ...<Widget>[
                _ManagerActions(
                  detail: detail,
                  busy: _busy,
                  changeStatus: (ClubChargeStatus status) =>
                      _changeStatus(request, detail, status),
                ),
                if (detail.item.charge.status ==
                    ClubChargeStatus.open) ...<Widget>[
                  const SizedBox(height: 10),
                  _ReminderAction(
                    detail: detail,
                    busy: _busy || _reminderConfirmationOpen,
                    remind: () => _remindUnpaid(request),
                  ),
                ],
                if (detail.item.charge.status ==
                    ClubChargeStatus.draft) ...<Widget>[
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: _busy
                        ? null
                        : () => context.push(
                            '/club/${Uri.encodeComponent(widget.teamId)}/finance/${Uri.encodeComponent(widget.chargeId)}/edit',
                          ),
                    icon: const Icon(Icons.edit_outlined),
                    label: const Text('초안 수정'),
                  ),
                ],
                const SizedBox(height: 22),
                Text('납부 대상', style: AppTextStyles.title),
                const SizedBox(height: 10),
                ..._sorted(detail.item.targets).map(
                  (ClubChargeTarget target) => _TargetRow(
                    target: target,
                    open: detail.item.charge.status == ClubChargeStatus.open,
                    busy: _busy,
                    act: (ClubPaymentAction action) =>
                        _payment(request, target, action),
                  ),
                ),
              ] else
                _MemberMessage(
                  payment: detail.item.myPayment,
                  amount:
                      detail.item.myPayment?.amount ??
                      detail.item.charge.amount,
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _changeStatus(
    ClubChargeRequest request,
    ClubChargeDetail detail,
    ClubChargeStatus status,
  ) async {
    final String prompt = status == ClubChargeStatus.cancelled
        ? '이 회비 항목을 취소할까요?'
        : status == ClubChargeStatus.closed
        ? '이 회비 항목을 마감할까요?'
        : '회원에게 공개할까요?';
    if (!await _confirm(prompt)) return;
    await _mutate(
      request,
      () => ref.read(clubFinanceRepositoryProvider).updateCharge(
        widget.teamId,
        widget.chargeId,
        <String, dynamic>{'status': status.apiValue},
      ),
    );
  }

  Future<void> _payment(
    ClubChargeRequest request,
    ClubChargeTarget target,
    ClubPaymentAction action,
  ) async {
    final String prompt = switch (action) {
      ClubPaymentAction.markPaid =>
        '${target.displayName}님의 ${formatKrw(target.amount)} 납부를 확인했나요?',
      ClubPaymentAction.markUnpaid => '납부 상태를 미납으로 되돌릴까요?',
      ClubPaymentAction.waive => '${target.displayName}님을 납부 대상에서 면제할까요?',
      ClubPaymentAction.unwaive => '${target.displayName}님의 면제를 취소할까요?',
    };
    if (!await _confirm(prompt)) return;
    await _mutate(
      request,
      () => ref
          .read(clubFinanceRepositoryProvider)
          .updatePayment(widget.teamId, widget.chargeId, target.id, action),
    );
  }

  Future<void> _remindUnpaid(ClubChargeRequest request) async {
    if (_busy || _reminderConfirmationOpen) return;
    setState(() => _reminderConfirmationOpen = true);
    final bool confirmed;
    try {
      confirmed = await _confirmReminder();
    } finally {
      if (mounted && _reminderConfirmationOpen) {
        setState(() => _reminderConfirmationOpen = false);
      }
    }
    if (!mounted || !confirmed || _busy) return;
    setState(() => _busy = true);
    try {
      final ClubFinanceReminderResult result = await ref
          .read(clubFinanceRepositoryProvider)
          .remindUnpaidMembers(widget.teamId, widget.chargeId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('미납 알림 요청을 처리했습니다. 대상 ${result.eligibleMemberCount}명'),
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(clubFinanceErrorMessage(error))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _mutate(
    ClubChargeRequest request,
    Future<Object> Function() action,
  ) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
      if (!mounted) {
        return;
      }
      invalidateClubFinance(ref, (
        userId: request.userId,
        teamId: request.teamId,
      ), chargeId: request.chargeId);
      await ref.read(clubChargeProvider(request).future);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(clubFinanceErrorMessage(error))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _confirm(String text) async =>
      await showDialog<bool>(
        context: context,
        builder: (BuildContext context) => AlertDialog(
          content: Text(text),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('아니요'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('확인'),
            ),
          ],
        ),
      ) ??
      false;

  Future<bool> _confirmReminder() async =>
      await showDialog<bool>(
        context: context,
        builder: (BuildContext context) => AlertDialog(
          title: const Text('미납 회원에게 알림을 보낼까요?'),
          content: const Text(
            '앱을 사용하는 미납 회원에게 납부 확인 알림을 등록합니다.\n'
            '같은 회비는 같은 날 같은 회원에게 중복 알림이 생성되지 않습니다.',
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('취소'),
            ),
            FilledButton(
              key: const Key('finance-reminder-confirm'),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('알림 등록'),
            ),
          ],
        ),
      ) ??
      false;
}

class _ChargeInfo extends StatelessWidget {
  const _ChargeInfo({required this.detail});
  final ClubChargeDetail detail;
  @override
  Widget build(BuildContext context) {
    final ClubCharge charge = detail.item.charge;
    final ClubMyPayment? p = detail.item.myPayment;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(charge.title, style: AppTextStyles.headline),
                ),
                Text(
                  charge.status.label,
                  style: const TextStyle(
                    color: AppColors.primaryBright,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            _row('종류', charge.type.label),
            _row('납부 금액', formatKrw(p?.amount ?? charge.amount)),
            _row('납부 기한', displayFinanceDate(charge.dueDate)),
            if (p != null) _row('납부 상태', p.status.label),
            if (p?.paidAt != null)
              _row('확인 일시', p!.paidAt!.toLocal().toString().substring(0, 16)),
            if (charge.memo?.isNotEmpty == true) ...<Widget>[
              const Divider(height: 28),
              Text(charge.memo!),
            ],
            if (charge.status == ClubChargeStatus.draft) ...<Widget>[
              const SizedBox(height: 14),
              const Text(
                '아직 회원에게 공개되지 않았습니다.',
                style: TextStyle(color: AppColors.warning),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _row(String a, String b) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: <Widget>[
        Text(a, style: const TextStyle(color: AppColors.textSecondary)),
        Text(b, style: const TextStyle(fontWeight: FontWeight.w700)),
      ],
    ),
  );
}

class _ManagerActions extends StatelessWidget {
  const _ManagerActions({
    required this.detail,
    required this.busy,
    required this.changeStatus,
  });
  final ClubChargeDetail detail;
  final bool busy;
  final ValueChanged<ClubChargeStatus> changeStatus;
  @override
  Widget build(BuildContext context) {
    final status = detail.item.charge.status;
    if (status == ClubChargeStatus.closed ||
        status == ClubChargeStatus.cancelled) {
      return const SizedBox.shrink();
    }
    return Row(
      children: <Widget>[
        Expanded(
          child: FilledButton(
            onPressed: busy
                ? null
                : () => changeStatus(
                    status == ClubChargeStatus.draft
                        ? ClubChargeStatus.open
                        : ClubChargeStatus.closed,
                  ),
            child: Text(status == ClubChargeStatus.draft ? '회원에게 공개' : '마감'),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: OutlinedButton(
            onPressed: busy
                ? null
                : () => changeStatus(ClubChargeStatus.cancelled),
            child: const Text('취소'),
          ),
        ),
      ],
    );
  }
}

class _ReminderAction extends StatelessWidget {
  const _ReminderAction({
    required this.detail,
    required this.busy,
    required this.remind,
  });

  final ClubChargeDetail detail;
  final bool busy;
  final VoidCallback remind;

  @override
  Widget build(BuildContext context) {
    final List<ClubChargeTarget> unpaid = detail.item.targets
        .where(
          (ClubChargeTarget target) =>
              target.status == ClubPaymentStatus.unpaid,
        )
        .toList(growable: false);
    final bool hasEligibleMember = unpaid.any(
      (ClubChargeTarget target) =>
          target.targetType == ClubChargeTargetType.member &&
          target.memberId != null,
    );
    final bool hasGuest = unpaid.any(
      (ClubChargeTarget target) =>
          target.targetType == ClubChargeTargetType.guest,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        OutlinedButton.icon(
          key: const Key('finance-reminder-button'),
          onPressed: busy || !hasEligibleMember ? null : remind,
          icon: busy
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.notifications_active_outlined),
          label: const Text('미납자에게 알림'),
        ),
        if (!hasEligibleMember)
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: Text(
              '알림 가능한 회원 미납자가 없습니다.',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          )
        else if (hasGuest)
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: Text(
              '게스트는 앱 알림 대상에서 제외됩니다.',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
      ],
    );
  }
}

class _MemberMessage extends StatelessWidget {
  const _MemberMessage({required this.payment, required this.amount});
  final ClubMyPayment? payment;
  final int amount;
  @override
  Widget build(BuildContext context) {
    if (payment == null) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(20),
          child: Text('이 항목의 납부 대상이 아닙니다.'),
        ),
      );
    }
    final String message = switch (payment!.status) {
      ClubPaymentStatus.unpaid =>
        '아직 납부 확인 전입니다.\n운영진이 안내한 방법으로 납부한 뒤 확인을 기다려주세요.',
      ClubPaymentStatus.paid => '운영진이 납부 완료로 확인했습니다.',
      ClubPaymentStatus.waived => '운영진이 납부 대상에서 면제했습니다.',
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(message),
            if (payment!.status == ClubPaymentStatus.unpaid) ...<Widget>[
              const SizedBox(height: 14),
              OutlinedButton.icon(
                key: const Key('finance-copy-amount'),
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: '$amount'));
                  ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(const SnackBar(content: Text('금액을 복사했습니다.')));
                },
                icon: const Icon(Icons.copy_rounded),
                label: const Text('금액 복사'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _TargetRow extends StatelessWidget {
  const _TargetRow({
    required this.target,
    required this.open,
    required this.busy,
    required this.act,
  });
  final ClubChargeTarget target;
  final bool open, busy;
  final ValueChanged<ClubPaymentAction> act;
  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Row(
                    children: <Widget>[
                      Flexible(
                        child: Text(
                          target.displayName,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                      if (target.targetType ==
                          ClubChargeTargetType.guest) ...<Widget>[
                        const SizedBox(width: 8),
                        const Chip(label: Text('게스트')),
                      ],
                    ],
                  ),
                ),
                Text('${formatKrw(target.amount)} · ${target.status.label}'),
              ],
            ),
            if (open) ...<Widget>[
              const SizedBox(height: 10),
              Row(children: _buttons()),
            ],
          ],
        ),
      ),
    );
  }

  List<Widget> _buttons() {
    final List<(String, ClubPaymentAction)> actions = switch (target.status) {
      ClubPaymentStatus.unpaid => <(String, ClubPaymentAction)>[
        ('납부 확인', ClubPaymentAction.markPaid),
        ('면제', ClubPaymentAction.waive),
      ],
      ClubPaymentStatus.paid => <(String, ClubPaymentAction)>[
        ('납부 확인 취소', ClubPaymentAction.markUnpaid),
      ],
      ClubPaymentStatus.waived => <(String, ClubPaymentAction)>[
        ('면제 취소', ClubPaymentAction.unwaive),
      ],
    };
    return actions
        .map(
          ((String, ClubPaymentAction) item) => Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: OutlinedButton(
                onPressed: busy ? null : () => act(item.$2),
                child: Text(item.$1),
              ),
            ),
          ),
        )
        .toList();
  }
}

List<ClubChargeTarget> _sorted(List<ClubChargeTarget> values) {
  final List<ClubChargeTarget> result = List<ClubChargeTarget>.of(values);
  result.sort((ClubChargeTarget a, ClubChargeTarget b) {
    final int status = a.status.index.compareTo(b.status.index);
    return status != 0 ? status : a.displayName.compareTo(b.displayName);
  });
  return result;
}
