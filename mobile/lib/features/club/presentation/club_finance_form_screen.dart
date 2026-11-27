import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_finance_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_finance_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubFinanceFormScreen extends ConsumerStatefulWidget {
  const ClubFinanceFormScreen({required this.teamId, this.chargeId, super.key});
  final String teamId;
  final String? chargeId;
  @override
  ConsumerState<ClubFinanceFormScreen> createState() => _State();
}

class _State extends ConsumerState<ClubFinanceFormScreen> {
  final _form = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _amount = TextEditingController();
  final _dueDate = TextEditingController();
  final _memo = TextEditingController();
  ClubChargeType _type = ClubChargeType.monthlyDues;
  final Set<String> _members = <String>{};
  String? _eventId;
  bool _initialized = false;
  bool _memberSelectionInitialized = false;
  bool _editTargetsInitialized = false;
  bool _targetEditingLocked = false;
  bool _saving = false;

  @override
  void dispose() {
    _title.dispose();
    _amount.dispose();
    _dueDate.dispose();
    _memo.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final ClubFinanceRequest financeRequest = (
      userId: user.id,
      teamId: widget.teamId,
    );
    ClubChargeDetail? editing;
    if (widget.chargeId case final String chargeId) {
      final state = ref.watch(
        clubChargeProvider((
          userId: user.id,
          teamId: widget.teamId,
          chargeId: chargeId,
        )),
      );
      if (state.isLoading) {
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      }
      if (state.hasError) {
        return Scaffold(
          appBar: AppBar(),
          body: Center(child: Text(clubFinanceErrorMessage(state.error!))),
        );
      }
      editing = state.requireValue;
      _initializeEdit(editing.item.charge);
    } else if (!_initialized) {
      _initialized = true;
      final DateTime today = DateTime.now();
      _dueDate.text = _dateValue(today);
    }
    final memberState = ref.watch(
      clubMembersProvider((userId: user.id, teamId: widget.teamId)),
    );
    final eventState = ref.watch(
      clubEventsProvider((
        userId: user.id,
        teamId: widget.teamId,
        scope: ClubEventListScope.upcoming,
      )),
    );
    if (editing == null &&
        _type != ClubChargeType.eventFee &&
        memberState.hasValue &&
        !_memberSelectionInitialized) {
      _memberSelectionInitialized = true;
      _members.addAll(
        memberState.requireValue
            .where((ClubMember item) => !item.isBlinded)
            .map((ClubMember item) => item.id),
      );
    }
    final bool canEditMemberTargets =
        editing != null &&
        editing.item.charge.status == ClubChargeStatus.draft &&
        editing.item.charge.type != ClubChargeType.eventFee;
    if (canEditMemberTargets &&
        memberState.hasValue &&
        !_editTargetsInitialized) {
      _editTargetsInitialized = true;
      final Set<String> currentMemberIds = memberState.requireValue
          .where((ClubMember item) => !item.isBlinded)
          .map((ClubMember item) => item.id)
          .toSet();
      final ClubDraftTargetSelection selection =
          resolveClubDraftTargetSelection(
            targets: editing.item.targets,
            currentMemberIds: currentMemberIds,
          );
      _targetEditingLocked = selection.locked;
      if (!selection.locked) {
        _memberSelectionInitialized = true;
        _members
          ..clear()
          ..addAll(selection.memberIds);
      }
    }
    return Scaffold(
      appBar: AppBar(title: Text(editing == null ? '새 회비/기타 정산' : '초안 수정')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: <Widget>[
            DropdownButtonFormField<ClubChargeType>(
              key: const Key('finance-type'),
              initialValue: _type,
              decoration: const InputDecoration(labelText: '종류'),
              items: ClubChargeType.values
                  .where((value) => editing != null || value != ClubChargeType.eventFee)
                  .map(
                    (ClubChargeType value) => DropdownMenuItem(
                      value: value,
                      child: Text(value.label),
                    ),
                  )
                  .toList(),
              onChanged: editing == null
                  ? (ClubChargeType? value) => setState(() {
                      _type = value!;
                      _members.clear();
                      _memberSelectionInitialized = false;
                      _eventId = null;
                    })
                  : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              key: const Key('finance-title'),
              controller: _title,
              decoration: const InputDecoration(labelText: '제목'),
              maxLength: 100,
              validator: (String? value) =>
                  value == null || value.trim().isEmpty ? '제목을 입력해주세요.' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              key: const Key('finance-amount'),
              controller: _amount,
              decoration: InputDecoration(
                labelText: '금액',
                helperText: _amountPreview,
              ),
              keyboardType: TextInputType.number,
              inputFormatters: <TextInputFormatter>[
                FilteringTextInputFormatter.digitsOnly,
              ],
              validator: (String? value) {
                final int? amount = int.tryParse(value ?? '');
                return amount == null || amount < 1 || amount > 10000000
                    ? '1원 이상 10,000,000원 이하로 입력해주세요.'
                    : null;
              },
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            TextFormField(
              key: const Key('finance-due-date'),
              controller: _dueDate,
              readOnly: true,
              decoration: const InputDecoration(
                labelText: '납부기한',
                suffixIcon: Icon(Icons.calendar_month_outlined),
              ),
              onTap: _pickDate,
              validator: (String? value) =>
                  value == null || value.isEmpty ? '납부기한을 선택해주세요.' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              key: const Key('finance-memo'),
              controller: _memo,
              decoration: const InputDecoration(labelText: '메모 (선택)'),
              maxLines: 3,
              maxLength: 500,
            ),
            const SizedBox(height: 16),
            if (editing == null) ...<Widget>[
              if (_type == ClubChargeType.eventFee)
                _EventSelector(
                  state: eventState,
                  selected: _eventId,
                  changed: (String value) => setState(() => _eventId = value),
                )
              else
                _MemberSelector(
                  state: memberState,
                  selected: _members,
                  changed: (Set<String> value) => setState(() {
                    _members
                      ..clear()
                      ..addAll(value);
                  }),
                ),
              const SizedBox(height: 18),
            ] else if (_type == ClubChargeType.eventFee) ...<Widget>[
              const _EventSnapshotNotice(),
              const SizedBox(height: 18),
            ] else if (canEditMemberTargets) ...<Widget>[
              if (_targetEditingLocked)
                const Text(
                  '현재 회원 목록과 일치하지 않는 기존 대상이 있어 대상 수정이 제한됩니다.',
                  key: Key('finance-target-edit-locked'),
                  style: TextStyle(color: AppColors.warning),
                )
              else
                _MemberSelector(
                  state: memberState,
                  selected: _members,
                  changed: (Set<String> value) => setState(() {
                    _members
                      ..clear()
                      ..addAll(value);
                  }),
                ),
              const SizedBox(height: 18),
            ],
            FilledButton(
              key: const Key('finance-save'),
              onPressed: _saving ? null : () => _save(financeRequest, editing),
              child: _saving
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(editing == null ? '초안 만들기' : '저장'),
            ),
          ],
        ),
      ),
    );
  }

  String? get _amountPreview {
    final int? value = int.tryParse(_amount.text);
    return value == null ? null : formatKrw(value);
  }

  void _initializeEdit(ClubCharge charge) {
    if (_initialized) return;
    _initialized = true;
    _type = charge.type;
    _title.text = charge.title;
    _amount.text = '${charge.amount}';
    _dueDate.text = charge.dueDate;
    _memo.text = charge.memo ?? '';
    _eventId = charge.eventId;
  }

  Future<void> _pickDate() async {
    final DateTime now = DateTime.now();
    final DateTime initial = _parseDate(_dueDate.text) ?? now;
    final DateTime? value = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 5),
    );
    if (value != null) setState(() => _dueDate.text = _dateValue(value));
  }

  Future<void> _save(
    ClubFinanceRequest request,
    ClubChargeDetail? editing,
  ) async {
    if (!_form.currentState!.validate()) return;
    if (editing == null &&
        _type != ClubChargeType.eventFee &&
        _members.isEmpty) {
      _snack('납부 대상을 1명 이상 선택해주세요.');
      return;
    }
    final bool updatingMemberTargets =
        editing != null &&
        editing.item.charge.status == ClubChargeStatus.draft &&
        editing.item.charge.type != ClubChargeType.eventFee &&
        !_targetEditingLocked;
    if (updatingMemberTargets && _members.isEmpty) {
      _snack('납부 대상을 1명 이상 선택해주세요.');
      return;
    }
    if (editing == null &&
        _type == ClubChargeType.eventFee &&
        _eventId == null) {
      _snack('일정을 선택해주세요.');
      return;
    }
    setState(() => _saving = true);
    try {
      final repository = ref.read(clubFinanceRepositoryProvider);
      late ClubChargeDetail result;
      if (editing == null) {
        result = await repository.createCharge(
          widget.teamId,
          ClubChargeDraft(
            type: _type,
            title: _title.text,
            amount: int.parse(_amount.text),
            dueDate: _dueDate.text,
            memo: _memo.text,
            eventId: _eventId,
            targetMemberIds: _members.toList(growable: false),
          ),
        );
      } else {
        result = await repository.updateCharge(
          widget.teamId,
          widget.chargeId!,
          <String, dynamic>{
            'title': _title.text.trim(),
            'amount': int.parse(_amount.text),
            'dueDate': _dueDate.text,
            'memo': _memo.text.trim().isEmpty ? null : _memo.text.trim(),
            if (updatingMemberTargets)
              'targetMemberIds': _members.toList(growable: false),
          },
        );
      }
      invalidateClubFinance(ref, request, chargeId: result.item.charge.id);
      if (!mounted) {
        return;
      }
      final String path =
          '/club/${Uri.encodeComponent(widget.teamId)}/finance/${Uri.encodeComponent(result.item.charge.id)}';
      editing == null ? context.go(path) : context.pop();
    } catch (error) {
      if (mounted) _snack(clubFinanceErrorMessage(error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _snack(String value) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(value)));
}

class _MemberSelector extends StatelessWidget {
  const _MemberSelector({
    required this.state,
    required this.selected,
    required this.changed,
  });
  final AsyncValue<List<ClubMember>> state;
  final Set<String> selected;
  final ValueChanged<Set<String>> changed;
  @override
  Widget build(BuildContext context) => state.when(
    loading: () => const Center(child: CircularProgressIndicator()),
    error: (Object error, StackTrace _) => Text(clubFinanceErrorMessage(error)),
    data: (List<ClubMember> values) {
      final List<ClubMember> active = values
          .where((ClubMember item) => !item.isBlinded)
          .toList();
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Text(
            '납부 대상',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
          Row(
            children: <Widget>[
              TextButton(
                onPressed: () =>
                    changed(active.map((ClubMember item) => item.id).toSet()),
                child: const Text('전체 선택'),
              ),
              TextButton(
                onPressed: () => changed(<String>{}),
                child: const Text('전체 해제'),
              ),
            ],
          ),
          ...active.map(
            (ClubMember item) => CheckboxListTile(
              key: Key('finance-member-${item.id}'),
              value: selected.contains(item.id),
              title: Text(item.name),
              controlAffinity: ListTileControlAffinity.leading,
              onChanged: (bool? value) {
                final Set<String> next = Set<String>.of(selected);
                value == true ? next.add(item.id) : next.remove(item.id);
                changed(next);
              },
            ),
          ),
        ],
      );
    },
  );
}

class _EventSelector extends StatelessWidget {
  const _EventSelector({
    required this.state,
    required this.selected,
    required this.changed,
  });
  final AsyncValue<ClubEventsEnvelope> state;
  final String? selected;
  final ValueChanged<String> changed;
  @override
  Widget build(BuildContext context) => state.when(
    loading: () => const Center(child: CircularProgressIndicator()),
    error: (Object error, StackTrace _) => Text(clubFinanceErrorMessage(error)),
    data: (ClubEventsEnvelope value) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        const Text(
          '일정 선택',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        const _EventSnapshotNotice(),
        const SizedBox(height: 10),
        ...value.events.map(
          (ClubEvent event) => ListTile(
            key: Key('finance-event-${event.id}'),
            leading: Icon(
              selected == event.id
                  ? Icons.radio_button_checked
                  : Icons.radio_button_unchecked,
              color: selected == event.id ? AppColors.primaryBright : null,
            ),
            title: Text(event.title),
            subtitle: Text(displayFinanceDate(event.date)),
            selected: selected == event.id,
            onTap: () => changed(event.id),
          ),
        ),
      ],
    ),
  );
}

class _EventSnapshotNotice extends StatelessWidget {
  const _EventSnapshotNotice();

  @override
  Widget build(BuildContext context) => const Text(
    '현재 참석자와 게스트를 기준으로 납부 대상이 생성됩니다.\n이후 참석 상태가 바뀌어도 자동 변경되지 않습니다.',
    key: Key('finance-event-snapshot-notice'),
    style: TextStyle(color: AppColors.textSecondary),
  );
}

String _dateValue(DateTime value) =>
    '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
DateTime? _parseDate(String value) {
  try {
    final List<int> p = parseFinanceDateOnly(value)
        .split('-')
        .map(int.parse)
        .toList();
    return DateTime(p[0], p[1], p[2]);
  } on FormatException {
    return null;
  }
}
