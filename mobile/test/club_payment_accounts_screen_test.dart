import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_events_api.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_payment_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_payment_accounts_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'support/auth_fakes.dart';

void main() {
  Future<void> pump(WidgetTester tester, _AccountsApi api) async {
    await tester.binding.setSurfaceSize(const Size(450, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final auth = FakeAuthRepository()..bootstrapResult = testUser;
    await tester.pumpWidget(ProviderScope(overrides: [
      authRepositoryProvider.overrideWithValue(auth),
      clubEventsApiProvider.overrideWithValue(api),
    ], child: const MaterialApp(home: ClubPaymentAccountsScreen(teamId: 'team-1'))));
    await tester.pumpAndSettle();
  }

  testWidgets('dues and game fee settings save to separate kinds', (tester) async {
    final api = _AccountsApi();
    await pump(tester, api);
    for (final kind in <String>['DUES', 'GAME_FEE']) {
      await tester.tap(find.byKey(Key('payment-account-$kind')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('payment-account-bank')), '카카오뱅크');
      await tester.enterText(find.byKey(const Key('payment-account-number')), '3333121234567');
      await tester.enterText(find.byKey(const Key('payment-account-holder')), '총무');
      await tester.tap(find.widgetWithText(FilledButton, '저장'));
      await tester.pumpAndSettle();
      expect(api.saved.last['kind'], kind);
      expect(api.saved.last['revision'], 0);
      expect(find.byType(AlertDialog), findsNothing);
    }
    expect(api.saved.length, 2);
  });

  testWidgets('stale settings can reload the current account and retry its revision', (tester) async {
    final api = _AccountsApi()..staleOnFirstSave = true;
    await pump(tester, api);
    await tester.tap(find.byKey(const Key('payment-account-GAME_FEE')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('payment-account-bank')), '카카오뱅크');
    await tester.enterText(find.byKey(const Key('payment-account-number')), '3333121234567');
    await tester.enterText(find.byKey(const Key('payment-account-holder')), '총무');
    await tester.tap(find.widgetWithText(FilledButton, '저장'));
    await tester.pumpAndSettle();
    expect(find.text('최신 계좌 불러오기'), findsOneWidget);
    expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, '저장')).onPressed, isNull);
    await tester.tap(find.text('최신 계좌 불러오기'));
    await tester.pumpAndSettle();
    expect(tester.widget<TextFormField>(find.byKey(const Key('payment-account-number'))).controller!.text, '111122223333');
    await tester.tap(find.widgetWithText(FilledButton, '저장'));
    await tester.pumpAndSettle();
    expect(api.saved.last['revision'], 7);
    expect(api.saved.last['accountNumber'], '111122223333');
    expect(find.byType(AlertDialog), findsNothing);
    expect(tester.takeException(), isNull);
  });
}

class _AccountsApi extends ClubEventsApi {
  _AccountsApi() : super(Dio());
  bool staleOnFirstSave = false;
  final saved = <Map<String, dynamic>>[];
  final accounts = <ClubPaymentAccount>[];
  @override
  Future<List<ClubPaymentAccount>> fetchPaymentAccounts(String teamId) async => List.of(accounts);
  @override
  Future<void> savePaymentAccount(String teamId, Map<String, dynamic> body) async {
    saved.add(Map.of(body));
    if (staleOnFirstSave && saved.length == 1) {
      accounts.add(const ClubPaymentAccount(id: 'existing', kind: 'GAME_FEE', revision: 7,
        bankName: '카카오뱅크', accountNumber: '111122223333', holderName: '새 예금주'));
      throw const ApiException(kind: ApiErrorKind.unknown, code: 'STALE_ACCOUNT', userMessage: '다른 관리자가 계좌를 변경했습니다.');
    }
    accounts.removeWhere((account) => account.kind == body['kind']);
    accounts.add(ClubPaymentAccount(id: body['kind'] as String, kind: body['kind'] as String,
      revision: (body['revision'] as int) + 1, bankName: body['bankName'] as String,
      accountNumber: body['accountNumber'] as String, holderName: body['holderName'] as String));
  }
}
