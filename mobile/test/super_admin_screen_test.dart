import 'package:bowlingmanager_mobile/app/app.dart';
import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/admin/application/super_admin_providers.dart';
import 'package:bowlingmanager_mobile/features/admin/data/super_admin_repository.dart';
import 'package:bowlingmanager_mobile/features/admin/domain/super_admin_team.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';
import 'support/club_fakes.dart';
import 'support/dashboard_fakes.dart';

void main() {
  testWidgets('SUPER_ADMIN sees the menu', (WidgetTester tester) async {
    await _openProfile(
      tester,
      _user('SUPER_ADMIN'),
      _FakeSuperAdminRepository(),
    );
    expect(find.byKey(const Key('profile-super-admin')), findsOneWidget);
  });

  for (final String role in <String>['OWNER', 'MANAGER', 'MEMBER']) {
    testWidgets('$role does not see the super admin menu', (
      WidgetTester tester,
    ) async {
      await _openProfile(tester, _user(role), _FakeSuperAdminRepository());
      expect(find.byKey(const Key('profile-super-admin')), findsNothing);
    });
  }

  testWidgets('team list shows code, Hidden and Season states', (
    WidgetTester tester,
  ) async {
    await _openTeamFeatures(tester, _FakeSuperAdminRepository());

    expect(find.text('테스트 동호회'), findsOneWidget);
    expect(find.text('팀 코드 TEST01'), findsOneWidget);
    expect(find.text('Season ON'), findsOneWidget);
    expect(find.text('Bowler Hidden OFF'), findsOneWidget);
    expect(find.text('두 번째 동호회'), findsOneWidget);
    expect(find.text('Season OFF'), findsOneWidget);
    expect(find.text('Bowler Hidden ON'), findsOneWidget);
  });

  testWidgets('toggle requires confirmation and refreshes the server state', (
    WidgetTester tester,
  ) async {
    final _FakeSuperAdminRepository repository = _FakeSuperAdminRepository();
    await _openTeamFeatures(tester, repository);

    await tester.tap(find.byKey(const Key('super-admin-hidden-team-1')));
    await tester.pumpAndSettle();
    expect(find.text('Bowler Hidden 활성화'), findsOneWidget);
    expect(
      find.text(
        'Bowler Hidden을 활성화하면 개인전, 팀전, 이벤트전, 통합 시즌 및 Final 기능을 사용할 수 있습니다.',
      ),
      findsOneWidget,
    );
    expect(repository.toggleCalls, 0);

    await tester.tap(find.byKey(const Key('super-admin-toggle-confirm')));
    await tester.pumpAndSettle();
    expect(repository.toggleCalls, 1);
    expect(repository.lastEnabled, isTrue);
    expect(find.text('Bowler Hidden ON'), findsNWidgets(2));
  });

  testWidgets('turning Hidden off also requires confirmation', (
    WidgetTester tester,
  ) async {
    final _FakeSuperAdminRepository repository = _FakeSuperAdminRepository();
    await _openTeamFeatures(tester, repository);

    await tester.tap(find.byKey(const Key('super-admin-hidden-team-2')));
    await tester.pumpAndSettle();
    expect(find.text('Bowler Hidden 비활성화'), findsOneWidget);
    expect(repository.toggleCalls, 0);

    await tester.tap(find.byKey(const Key('super-admin-toggle-confirm')));
    await tester.pumpAndSettle();
    expect(repository.toggleCalls, 1);
    expect(repository.lastEnabled, isFalse);
  });

  testWidgets('API failure keeps state and shows only a safe error', (
    WidgetTester tester,
  ) async {
    final _FakeSuperAdminRepository repository = _FakeSuperAdminRepository()
      ..toggleError = const ApiException(
        kind: ApiErrorKind.forbidden,
        userMessage: '슈퍼 관리자 권한이 필요합니다.',
      );
    await _openTeamFeatures(tester, repository);

    await tester.tap(find.byKey(const Key('super-admin-hidden-team-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('super-admin-toggle-confirm')));
    await tester.pumpAndSettle();

    expect(find.text('슈퍼 관리자 권한이 필요합니다.'), findsOneWidget);
    expect(find.text('Bowler Hidden OFF'), findsOneWidget);
  });
}

const List<SuperAdminTeam> _teams = <SuperAdminTeam>[
  SuperAdminTeam(
    id: 'team-1',
    name: '테스트 동호회',
    code: 'TEST01',
    bowlerHiddenEnabled: false,
    seasonRankingEnabled: true,
  ),
  SuperAdminTeam(
    id: 'team-2',
    name: '두 번째 동호회',
    code: 'TEST02',
    bowlerHiddenEnabled: true,
    seasonRankingEnabled: false,
  ),
];

AuthUser _user(String role) => AuthUser(
  id: 'user-$role',
  email: 'user@example.com',
  name: '테스트 관리자',
  role: role,
  handicap: null,
);

Future<void> _openProfile(
  WidgetTester tester,
  AuthUser user,
  SuperAdminRepository repository,
) async {
  await tester.binding.setSurfaceSize(const Size(600, 1200));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  final FakeAuthRepository auth = FakeAuthRepository()..bootstrapResult = user;
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(auth),
        dashboardRepositoryProvider.overrideWithValue(
          FakeDashboardRepository(),
        ),
        clubRepositoryProvider.overrideWithValue(FakeClubRepository()),
        superAdminRepositoryProvider.overrideWithValue(repository),
      ],
      child: const BowlingManagerApp(),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('MY'));
  await tester.pumpAndSettle();
}

Future<void> _openTeamFeatures(
  WidgetTester tester,
  SuperAdminRepository repository,
) async {
  await _openProfile(tester, _user('SUPER_ADMIN'), repository);
  await tester.tap(find.byKey(const Key('profile-super-admin')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('super-admin-team-features')));
  await tester.pumpAndSettle();
}

class _FakeSuperAdminRepository implements SuperAdminRepository {
  List<SuperAdminTeam> teams = List<SuperAdminTeam>.of(_teams);
  Object? fetchError;
  Object? toggleError;
  int toggleCalls = 0;
  bool? lastEnabled;

  @override
  Future<List<SuperAdminTeam>> fetchTeams() async {
    if (fetchError case final Object error) throw error;
    return List<SuperAdminTeam>.unmodifiable(teams);
  }

  @override
  Future<SuperAdminTeam> setBowlerHiddenEnabled({
    required String teamId,
    required bool enabled,
  }) async {
    toggleCalls += 1;
    lastEnabled = enabled;
    if (toggleError case final Object error) throw error;
    final int index = teams.indexWhere(
      (SuperAdminTeam team) => team.id == teamId,
    );
    final SuperAdminTeam current = teams[index];
    final SuperAdminTeam updated = SuperAdminTeam(
      id: current.id,
      name: current.name,
      code: current.code,
      bowlerHiddenEnabled: enabled,
      seasonRankingEnabled: current.seasonRankingEnabled,
    );
    teams[index] = updated;
    return updated;
  }
}
