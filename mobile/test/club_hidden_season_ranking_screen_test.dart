import 'dart:convert';

import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_season_ranking_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';

void main() {
  testWidgets('IMAGE season renders only authenticated ranking images', (
    tester,
  ) async {
    final auth = FakeAuthRepository()..bootstrapResult = testUser;
    final ranking = ClubSeasonRanking.fromJson(<String, dynamic>{
      'enabled': true,
      'bowlerHiddenEnabled': true,
      'competitionType': 'ALL',
      'rankingMode': 'IMAGE',
      'season': <String, dynamic>{
        'id': 'season-image',
        'name': '2025 시즌',
        'status': 'COMPLETED',
        'rankingMode': 'IMAGE',
        'startDate': '2025-01-01',
        'endDate': '2025-12-31',
        'scoringMode': 'FULL_RANK',
        'points': <int>[50, 30, 20],
      },
      'seasons': <Object>[],
      'rankings': <Object>[],
      'competitionColumns': <Object>[],
      'rankingImages': <Object>[
        <String, Object>{'id': 'image-1', 'size': 1024, 'displayOrder': 0},
      ],
    });
    final bytes = base64Decode(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(auth),
          clubSeasonRankingProvider.overrideWith(
            (ref, request) async => ranking,
          ),
          clubRankingImageProvider.overrideWith((ref, request) async => bytes),
        ],
        child: const MaterialApp(
          home: ClubSeasonRankingScreen(teamId: 'team-1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('2025 시즌 순위표'), findsOneWidget);
    expect(
      find.byKey(const Key('season-ranking-image-image-1')),
      findsOneWidget,
    );
    expect(find.byKey(const Key('hidden-competition-filter')), findsNothing);
    expect(find.text('순위  이름  총P'), findsNothing);
    expect(find.text('나의 대회 성적'), findsNothing);
    await tester.tap(find.byKey(const Key('season-ranking-image-image-1')));
    await tester.pumpAndSettle();
    expect(find.byType(InteractiveViewer), findsOneWidget);
  });

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
      expect(find.text('순위'), findsOneWidget);
      expect(find.text('이름'), findsOneWidget);
      expect(find.text('총P'), findsOneWidget);
      expect(find.text('120P'), findsOneWidget);
      expect(find.text('기초P'), findsOneWidget);
      expect(find.text('조정P'), findsOneWidget);
      expect(find.byType(SingleChildScrollView), findsWidgets);
      expect(find.byType(Scrollbar), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'past DATA season shows point ranking and final snapshot at 412px',
    (tester) async {
      tester.view.physicalSize = const Size(412, 915);
      tester.view.devicePixelRatio = 1;
      tester.platformDispatcher.textScaleFactorTestValue = 1.2;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      final auth = FakeAuthRepository()..bootstrapResult = testUser;
      final ranking = ClubSeasonRanking.fromJson(<String, dynamic>{
        'enabled': true,
        'bowlerHiddenEnabled': true,
        'competitionType': 'ALL',
        'rankingMode': 'DATA',
        'season': <String, Object>{
          'id': 'season-2025',
          'name': '2025 시즌',
          'status': 'COMPLETED',
          'lifecycleStatus': 'ENDED',
          'rankingMode': 'DATA',
          'startDate': '2025-01-01',
          'endDate': '2025-12-31',
          'scoringMode': 'FULL_RANK',
          'points': <int>[50, 30, 20],
        },
        'seasons': <Object>[],
        'rankings': <Object>[
          <String, Object>{
            'rank': 2,
            'id': 'member-1',
            'name': '회원1',
            'points': 178,
            'attended': 2,
            'games': 0,
            'average': 0,
            'gold': 0,
            'silver': 0,
            'bronze': 0,
          },
        ],
        'finalRanking': <String, Object>{
          'id': 'final-1',
          'revision': 1,
          'rankingMode': 'DATA',
          'finalizedAt': '2026-01-02T00:00:00Z',
          'finalizedBy': <String, String>{'id': 'manager', 'name': '관리자'},
          'entries': <Object>[
            <String, Object>{
              'id': 'entry-1',
              'memberId': 'member-1',
              'displayName': '회원1',
              'rank': 1,
              'totalPoints': 178,
            },
          ],
        },
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

      expect(find.text('최종 확정 순위 · 1차'), findsOneWidget);
      expect(find.text('1위'), findsOneWidget);
      expect(find.text('178P'), findsWidgets);
      expect(find.text('종료'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
