import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_season_ranking_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';

void main() {
  testWidgets(
    'Hidden ranking prioritizes total and scrollable monthly points at 360px',
    (tester) async {
      tester.view.physicalSize = const Size(360, 720);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final auth = FakeAuthRepository()..bootstrapResult = testUser;
      final ranking = ClubSeasonRanking.fromJson(<String, dynamic>{
        'enabled': true,
        'bowlerHiddenEnabled': true,
        'competitionType': 'ALL',
        'season': <String, dynamic>{
          'id': 'season-1',
          'name': '2026 시즌',
          'status': 'ACTIVE',
          'startDate': '2026-01-01T00:00:00.000Z',
          'endDate': '2026-12-31T00:00:00.000Z',
          'scoringMode': 'FULL_RANK',
          'points': <int>[50, 30, 20],
        },
        'seasons': <Object>[],
        'rankings': <Object>[
          <String, dynamic>{
            'rank': 1,
            'id': 'member-1',
            'name': '회원1',
            'points': 120,
            'attended': 3,
            'games': 0,
            'average': 0,
            'gold': 0,
            'silver': 0,
            'bronze': 0,
            'openingBalancePoints': 30,
            'adjustmentPoints': -10,
            'nonMonthlyPoints': 20,
            'monthlyPoints': <int>[50, 30, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            'monthlyHistory': List<Object>.generate(12, (_) => <Object>[]),
          },
        ],
      });
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authRepositoryProvider.overrideWithValue(auth),
            clubSeasonRankingProvider.overrideWith(
              (ref, request) async => ranking,
            ),
          ],
          child: const MaterialApp(
            home: ClubSeasonRankingScreen(teamId: 'team-1'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('순위  이름  총P'), findsOneWidget);
      expect(find.text('120P'), findsOneWidget);
      expect(find.text('기초P'), findsOneWidget);
      expect(find.text('조정P'), findsOneWidget);
      expect(find.byType(SingleChildScrollView), findsWidgets);
      expect(tester.takeException(), isNull);
    },
  );
}
