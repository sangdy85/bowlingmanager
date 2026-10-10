import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_payment_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final clubPaymentAccountsProvider = FutureProvider.autoDispose
    .family<List<ClubPaymentAccount>, ({String userId, String teamId})>((ref, request) =>
      ref.watch(clubEventsApiProvider).fetchPaymentAccounts(request.teamId),
      retry: (int retryCount, Object error) => null);

class ClubPaymentAccountsScreen extends ConsumerWidget {
  const ClubPaymentAccountsScreen({required this.teamId, super.key});
  final String teamId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) {
      return const Center(child: CircularProgressIndicator());
    }
    final provider = clubPaymentAccountsProvider((userId: user.id, teamId: teamId));
    return Scaffold(
      appBar: AppBar(title: const Text('회비 및 게임비 계좌 설정')),
      body: ref.watch(provider).when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: <Widget>[
          Text(clubErrorMessage(error)),
          TextButton(onPressed: () => ref.invalidate(provider), child: const Text('다시 시도')),
        ])),
        data: (accounts) => RefreshIndicator(
          onRefresh: () => ref.refresh(provider.future),
          child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.all(20), children: <Widget>[
            const Text('회원에게 안내할 은행명, 계좌번호, 예금주를 설정합니다.'),
            const SizedBox(height: 16),
            for (final kind in const <String>['DUES', 'GAME_FEE'])
              Builder(builder: (context) {
                final matching = accounts.where((account) => account.kind == kind);
                final account = matching.isEmpty ? null : matching.first;
                final title = kind == 'DUES' ? '회비계좌 설정' : '게임비 계좌 설정';
                return Card(child: ListTile(
                  key: Key('payment-account-$kind'),
                  leading: const Icon(Icons.account_balance_outlined),
                  title: Text(title),
                  subtitle: Text(account == null ? '설정된 계좌가 없습니다.' :
                    '${account.bankName}\n${account.accountNumber}\n예금주: ${account.holderName}'),
                  isThreeLine: account != null,
                  trailing: const Icon(Icons.edit_outlined),
                  onTap: () async {
                    final saved = await showDialog<bool>(context: context,
                      barrierDismissible: false,
                      builder: (_) => _AccountEditor(teamId: teamId, kind: kind, title: title, account: account));
                    if (saved == true && context.mounted) {
                      ref.invalidate(provider);
                      ref.invalidate(clubEventProvider);
                      ref.invalidate(clubEventsProvider);
                    }
                  },
                ));
              }),
            const SizedBox(height: 16),
            const Text('회비는 계좌 정보만 설정합니다. 회비 납부 확인 기능은 추후 추가됩니다.'),
            const SizedBox(height: 8),
            const Text('게임비 계좌는 일정 상세에서 참석 회원에게 표시됩니다. 입금 내역은 관리자가 직접 확인합니다.'),
          ]),
        ),
      ),
    );
  }
}

class _AccountEditor extends ConsumerStatefulWidget {
  const _AccountEditor({required this.teamId, required this.kind, required this.title, this.account});
  final String teamId;
  final String kind;
  final String title;
  final ClubPaymentAccount? account;
  @override
  ConsumerState<_AccountEditor> createState() => _AccountEditorState();
}
class _AccountEditorState extends ConsumerState<_AccountEditor> {
  final _form = GlobalKey<FormState>();
  late final _bank = TextEditingController(text: widget.account?.bankName ?? '');
  late final _number = TextEditingController(text: widget.account?.accountNumber ?? '');
  late final _holder = TextEditingController(text: widget.account?.holderName ?? '');
  bool _saving = false;
  bool _staleAccount = false;
  late int _revision = widget.account?.revision ?? 0;
  String? _error;
  @override
  void dispose() {
    _bank.dispose(); _number.dispose(); _holder.dispose();
    super.dispose();
  }
  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !_saving,
    child: AlertDialog(
      title: Text(widget.title),
      content: SingleChildScrollView(child: Form(key: _form, child: Column(mainAxisSize: MainAxisSize.min, children: <Widget>[
        TextFormField(key: const Key('payment-account-bank'), controller: _bank, enabled: !_saving, maxLength: 40,
          decoration: const InputDecoration(labelText: '은행명', hintText: '예: 카카오뱅크'),
          validator: (value) => value == null || value.trim().isEmpty ? '은행명을 입력해주세요.' : null),
        TextFormField(key: const Key('payment-account-number'), controller: _number, enabled: !_saving, maxLength: 40,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: '계좌번호'),
          validator: (value) => RegExp(r'^\d{6,30}$').hasMatch((value ?? '').replaceAll(RegExp(r'[ -]'), '')) ? null : '계좌번호를 확인해주세요.'),
        TextFormField(key: const Key('payment-account-holder'), controller: _holder, enabled: !_saving, maxLength: 60,
          decoration: const InputDecoration(labelText: '예금주'),
          validator: (value) => value == null || value.trim().isEmpty ? '예금주를 입력해주세요.' : null),
        if (_error != null) Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        if (_staleAccount) TextButton(
          onPressed: _saving ? null : _reloadAccount,
          child: const Text('최신 계좌 불러오기'),
        ),
      ]))),
      actions: <Widget>[
        TextButton(onPressed: _saving ? null : () => Navigator.pop(context, false), child: const Text('취소')),
        FilledButton(onPressed: _saving || _staleAccount ? null : _save, child: Text(_saving ? '저장 중…' : '저장')),
      ],
    ),
  );
  Future<void> _save() async {
    if (!_form.currentState!.validate()) {
      return;
    }
    setState(() { _saving = true; _error = null; });
    try {
      await ref.read(clubEventsApiProvider).savePaymentAccount(widget.teamId, <String, dynamic>{
        'kind': widget.kind, 'bankName': _bank.text.trim(), 'accountNumber': _number.text.trim(),
        'holderName': _holder.text.trim(), 'revision': _revision,
      });
      if (mounted) {
        setState(() => _saving = false);
        Navigator.pop(context, true);
      }
    } on Object catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = error is ApiException ? error.userMessage : clubErrorMessage(error);
          _staleAccount = error is ApiException && error.code == 'STALE_ACCOUNT';
        });
      }
    }
  }

  Future<void> _reloadAccount() async {
    setState(() => _saving = true);
    try {
      final accounts = await ref.read(clubEventsApiProvider).fetchPaymentAccounts(widget.teamId);
      if (!mounted) {
        return;
      }
      final matching = accounts.where((account) => account.kind == widget.kind);
      final account = matching.isEmpty ? null : matching.first;
      setState(() {
        _bank.text = account?.bankName ?? '';
        _number.text = account?.accountNumber ?? '';
        _holder.text = account?.holderName ?? '';
        _revision = account?.revision ?? 0;
        _error = null;
        _staleAccount = false;
        _saving = false;
      });
    } on Object catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = error is ApiException ? error.userMessage : clubErrorMessage(error);
        });
      }
    }
  }
}
