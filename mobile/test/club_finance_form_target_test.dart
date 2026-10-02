import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_finance_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_events_api.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_events_repository.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_finance_api.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_finance_repository.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_finance_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_finance_form_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'support/auth_fakes.dart';
import 'support/club_fakes.dart';

void main() {
  testWidgets('DRAFT monthly dues preselects duplicate names by memberId', (
    WidgetTester tester,
  ) async {
    final FakeClubRepository clubs = FakeClubRepository()
      ..members = const <ClubMember>[
        ClubMember(
          id: 'member-1',
          name: '동명이인',
          role: ClubRole.member,
          handicap: null,
        ),
        ClubMember(
          id: 'member-2',
          name: '동명이인',
          role: ClubRole.member,
          handicap: null,
        ),
      ];
    await _pumpForm(
      tester,
      _FinanceApi(_detail(targets: <ClubChargeTarget>[_target('member-2')])),
      clubs,
    );
    expect(
      tester
          .widget<CheckboxListTile>(
            find.byKey(const Key('finance-member-member-1')),
          )
          .value,
      isFalse,
    );
    expect(
      tester
          .widget<CheckboxListTile>(
            find.byKey(const Key('finance-member-member-2')),
          )
          .value,
      isTrue,
    );
    expect(find.byKey(const Key('finance-target-edit-locked')), findsNothing);
  });

  testWidgets('missing or deleted member locks DRAFT target editing', (
    WidgetTester tester,
  ) async {
    final FakeClubRepository clubs = FakeClubRepository()
      ..members = const <ClubMember>[
        ClubMember(
          id: 'member-1',
          name: '현재 회원',
          role: ClubRole.member,
          handicap: null,
        ),
      ];
    await _pumpForm(
      tester,
      _FinanceApi(
        _detail(
          targets: <ClubChargeTarget>[
            _target('deleted-member', memberId: null),
          ],
        ),
      ),
      clubs,
    );
    expect(find.byKey(const Key('finance-target-edit-locked')), findsOneWidget);
    expect(find.byType(CheckboxListTile), findsNothing);
  });

  testWidgets('EVENT_FEE edit keeps snapshot notice without member selector', (
    WidgetTester tester,
  ) async {
    final ClubChargeDetail detail = _detail(
      type: ClubChargeType.eventFee,
      eventId: 'event-1',
      targets: <ClubChargeTarget>[_target('guest', guest: true)],
    );
    await _pumpForm(tester, _FinanceApi(detail), FakeClubRepository());
    expect(
      find.byKey(const Key('finance-event-snapshot-notice')),
      findsOneWidget,
    );
    expect(find.byType(CheckboxListTile), findsNothing);
  });

  testWidgets('target edit sends IDs and refreshes the watched detail', (
    WidgetTester tester,
  ) async {
    final FakeClubRepository clubs = FakeClubRepository()
      ..members = const <ClubMember>[
        ClubMember(
          id: 'member-1',
          name: '회원 1',
          role: ClubRole.member,
          handicap: null,
        ),
        ClubMember(
          id: 'member-2',
          name: '회원 2',
          role: ClubRole.member,
          handicap: null,
        ),
      ];
    final _FinanceApi finance = _FinanceApi(
      _detail(targets: <ClubChargeTarget>[_target('member-2')]),
    );
    final GoRouter router = GoRouter(
      initialLocation: '/',
      routes: <RouteBase>[
        GoRoute(
          path: '/',
          builder: (BuildContext context, GoRouterState state) => Scaffold(
            body: Center(
              child: FilledButton(
                key: const Key('open-form'),
                onPressed: () => context.push('/form'),
                child: const Text('수정'),
              ),
            ),
          ),
        ),
        GoRoute(
          path: '/form',
          builder: (BuildContext context, GoRouterState state) =>
              const ClubFinanceFormScreen(
                teamId: 'team-1',
                chargeId: 'charge-1',
              ),
        ),
      ],
    );
    addTearDown(router.dispose);
    await _pump(
      tester,
      MaterialApp.router(routerConfig: router),
      finance,
      clubs,
    );
    await tester.tap(find.byKey(const Key('open-form')));
    await _settle(tester);
    final Finder member = find.byKey(const Key('finance-member-member-1'));
    tester.widget<CheckboxListTile>(member).onChanged!(true);
    await tester.pump();
    await tester.drag(find.byType(ListView), const Offset(0, -700));
    await tester.pump();
    final Finder save = find.byKey(const Key('finance-save'));
    await tester.tap(save);
    await _settle(tester);
    expect((finance.lastUpdate?['targetMemberIds'] as List).toSet(), <String>{
      'member-1',
      'member-2',
    });
    expect(finance.detailCalls, greaterThanOrEqualTo(2));
  });
}

Future<void> _pumpForm(
  WidgetTester tester,
  _FinanceApi finance,
  FakeClubRepository clubs,
) => _pump(
  tester,
  const MaterialApp(
    home: ClubFinanceFormScreen(teamId: 'team-1', chargeId: 'charge-1'),
  ),
  finance,
  clubs,
);
Future<void> _pump(
  WidgetTester tester,
  Widget child,
  _FinanceApi finance,
  FakeClubRepository clubs,
) async {
  final FakeAuthRepository auth = FakeAuthRepository()
    ..bootstrapResult = testUser;
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(auth),
        clubRepositoryProvider.overrideWithValue(clubs),
        clubEventsRepositoryProvider.overrideWithValue(
          ClubEventsRepository(_EventsApi()),
        ),
        clubFinanceRepositoryProvider.overrideWithValue(
          ClubFinanceRepository(finance),
        ),
      ],
      child: child,
    ),
  );
  await _settle(tester);
}

Future<void> _settle(WidgetTester tester) async {
  for (int i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

class _FinanceApi extends ClubFinanceApi {
  _FinanceApi(this.detail) : super(Dio());
  ClubChargeDetail detail;
  int detailCalls = 0;
  Map<String, dynamic>? lastUpdate;
  @override
  Future<ClubChargeDetail> fetchCharge(String teamId, String chargeId) async {
    detailCalls++;
    return detail;
  }

  @override
  Future<ClubChargeDetail> updateCharge(
    String teamId,
    String chargeId,
    Map<String, dynamic> changes,
  ) async {
    lastUpdate = changes;
    return detail;
  }
}

class _EventsApi extends ClubEventsApi {
  _EventsApi() : super(Dio());
  @override
  Future<ClubEventsEnvelope> fetchEvents(
    String teamId,
    ClubEventListScope scope,
  ) async =>
      const ClubEventsEnvelope(role: ClubRole.manager, events: <ClubEvent>[]);
}

final DateTime _stamp = DateTime.utc(2026, 10, 1);
ClubChargeTarget _target(String id, {String? memberId, bool guest = false}) =>
    ClubChargeTarget(
      id: 'target-$id',
      targetType: guest
          ? ClubChargeTargetType.guest
          : ClubChargeTargetType.member,
      memberId: guest ? null : (memberId ?? id),
      displayName: '동명이인',
      amount: 30000,
      status: ClubPaymentStatus.unpaid,
      createdAt: _stamp,
      updatedAt: _stamp,
      audits: const <ClubPaymentAudit>[],
    );
ClubChargeDetail _detail({
  ClubChargeType type = ClubChargeType.monthlyDues,
  String? eventId,
  required List<ClubChargeTarget> targets,
}) => ClubChargeDetail(
  role: ClubRole.manager,
  item: ClubChargeItem(
    charge: ClubCharge(
      id: 'charge-1',
      eventId: eventId,
      type: type,
      title: '10월 회비',
      amount: 30000,
      dueDate: '2026-10-10',
      status: ClubChargeStatus.draft,
      memo: null,
      createdAt: _stamp,
      updatedAt: _stamp,
    ),
    summary: ClubChargeSummary(
      targetCount: targets.length,
      paidCount: 0,
      unpaidCount: targets.length,
      waivedCount: 0,
      expectedAmount: 30000 * targets.length,
      paidAmount: 0,
      unpaidAmount: 30000 * targets.length,
      waivedAmount: 0,
    ),
    targets: targets,
  ),
);
