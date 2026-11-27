import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_finance_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_finance_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubFinanceScreen extends ConsumerWidget {
  const ClubFinanceScreen({required this.teamId, super.key});
  final String teamId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final ClubFinanceRequest request = (userId: user.id, teamId: teamId);
    final charges = ref.watch(clubChargesProvider(request));
    Future<void> refresh() async {
      ref.invalidate(clubFinanceSummaryProvider(request));
      final ClubChargesEnvelope _ = await ref.refresh(
        clubChargesProvider(request).future,
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('회비 / 정산')),
      body: charges.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (Object error, StackTrace _) =>
            _Error(message: clubFinanceErrorMessage(error), retry: refresh),
        data: (ClubChargesEnvelope envelope) => RefreshIndicator(
          onRefresh: refresh,
          child: ListView(
            key: const Key('club-finance-list'),
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
            children: <Widget>[
              Card(child: ListTile(
                leading: const Icon(Icons.payments_outlined),
                title: const Text('게임비 결제 확인'),
                subtitle: const Text('일정 상세에서 입금·현장 결제를 신고하고 관리자가 확인합니다.'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => context.push('/club/${Uri.encodeComponent(teamId)}/events'),
              )),
              const SizedBox(height: 16),
              if (envelope.canManage) ...<Widget>[
                _ManagerDashboard(request: request),
                const SizedBox(height: 16),
                FilledButton.icon(
                  key: const Key('finance-new-charge'),
                  onPressed: () => context.push(
                    '/club/${Uri.encodeComponent(teamId)}/finance/new',
                  ),
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('새 회비/기타 정산'),
                ),
              ] else
                _MemberOverview(charges: envelope.charges),
              const SizedBox(height: 22),
              Text('회비 항목', style: AppTextStyles.title),
              const SizedBox(height: 12),
              if (envelope.charges.isEmpty)
                _Empty(canManage: envelope.canManage)
              else
                ...envelope.charges.map(
                  (ClubChargeItem item) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _ChargeCard(
                      teamId: teamId,
                      item: item,
                      manager: envelope.canManage,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ManagerDashboard extends ConsumerWidget {
  const _ManagerDashboard({required this.request});
  final ClubFinanceRequest request;
  @override
  Widget build(BuildContext context, WidgetRef ref) => ref
      .watch(clubFinanceSummaryProvider(request))
      .when(
        loading: () => const Card(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator()),
          ),
        ),
        error: (Object error, StackTrace _) => Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Text(clubFinanceErrorMessage(error)),
          ),
        ),
        data: (ClubFinanceSummary value) => Card(
          key: const Key('finance-manager-summary'),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text('이번 수납 현황', style: AppTextStyles.title),
                const SizedBox(height: 16),
                _MoneyRow('예정금액', value.totals.expectedAmount),
                _MoneyRow(
                  '납부완료',
                  value.totals.paidAmount,
                  color: AppColors.success,
                ),
                _MoneyRow(
                  '미납',
                  value.totals.unpaidAmount,
                  color: AppColors.warning,
                ),
                _MoneyRow('면제', value.totals.waivedAmount),
                const Divider(height: 28),
                Text(
                  '납부 ${value.totals.paidCount}명  ·  미납 ${value.totals.unpaidCount}명  ·  면제 ${value.totals.waivedCount}명',
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ),
      );
}

class _MemberOverview extends StatelessWidget {
  const _MemberOverview({required this.charges});
  final List<ClubChargeItem> charges;
  @override
  Widget build(BuildContext context) {
    final int unpaid = charges
        .where(
          (ClubChargeItem item) =>
              item.myPayment?.status == ClubPaymentStatus.unpaid,
        )
        .length;
    final int paid = charges
        .where(
          (ClubChargeItem item) =>
              item.myPayment?.status == ClubPaymentStatus.paid,
        )
        .length;
    return Card(
      key: const Key('finance-member-summary'),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text('내 납부 현황', style: AppTextStyles.title),
            const SizedBox(height: 12),
            Text('미납 $unpaid건  ·  납부 완료 $paid건'),
          ],
        ),
      ),
    );
  }
}

class _ChargeCard extends StatelessWidget {
  const _ChargeCard({
    required this.teamId,
    required this.item,
    required this.manager,
  });
  final String teamId;
  final ClubChargeItem item;
  final bool manager;
  @override
  Widget build(BuildContext context) {
    final ClubCharge charge = item.charge;
    final ClubMyPayment? payment = item.myPayment;
    final bool overdue =
        payment?.status == ClubPaymentStatus.unpaid &&
        isFinanceDateOverdue(charge.dueDate);
    return Card(
      child: InkWell(
        key: Key('finance-charge-${charge.id}'),
        borderRadius: BorderRadius.circular(12),
        onTap: () => context.push(
          '/club/${Uri.encodeComponent(teamId)}/finance/${Uri.encodeComponent(charge.id)}',
        ),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(charge.title, style: AppTextStyles.title),
                  ),
                  _Badge(
                    label: manager
                        ? charge.status.label
                        : (payment?.status.label ?? '대상 아님'),
                    status: payment?.status,
                    chargeStatus: manager ? charge.status : null,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                formatKrw(payment?.amount ?? charge.amount),
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '${charge.type.label}  ·  납부기한 ${displayFinanceDate(charge.dueDate)}${overdue ? '  ·  기한 지남' : ''}',
                style: TextStyle(
                  color: overdue ? AppColors.error : AppColors.textSecondary,
                ),
              ),
              if (item.summary
                  case final ClubChargeSummary summary) ...<Widget>[
                const SizedBox(height: 8),
                Text(
                  '대상 ${summary.targetCount}명  ·  납부 ${summary.paidCount}  ·  미납 ${summary.unpaidCount}  ·  면제 ${summary.waivedCount}',
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _MoneyRow extends StatelessWidget {
  const _MoneyRow(this.label, this.value, {this.color});
  final String label;
  final int value;
  final Color? color;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: <Widget>[
        Text(label),
        Text(
          formatKrw(value),
          style: TextStyle(fontWeight: FontWeight.w700, color: color),
        ),
      ],
    ),
  );
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, this.status, this.chargeStatus});
  final String label;
  final ClubPaymentStatus? status;
  final ClubChargeStatus? chargeStatus;
  @override
  Widget build(BuildContext context) {
    final Color color = status == ClubPaymentStatus.paid
        ? AppColors.success
        : status == ClubPaymentStatus.unpaid
        ? AppColors.warning
        : status == ClubPaymentStatus.waived
        ? AppColors.primaryBright
        : chargeStatus == ClubChargeStatus.cancelled
        ? AppColors.error
        : AppColors.primaryBright;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .14),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.canManage});
  final bool canManage;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 40),
    child: Center(
      child: Text(
        canManage ? '아직 등록된 회비나 게임비가 없습니다.' : '현재 확인할 회비나 게임비가 없습니다.',
        textAlign: TextAlign.center,
        style: const TextStyle(color: AppColors.textSecondary),
      ),
    ),
  );
}

class _Error extends StatelessWidget {
  const _Error({required this.message, required this.retry});
  final String message;
  final Future<void> Function() retry;
  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text(message),
        const SizedBox(height: 12),
        OutlinedButton(onPressed: retry, child: const Text('다시 시도')),
      ],
    ),
  );
}
