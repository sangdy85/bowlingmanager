import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_season_ranking_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('ranking labels stay fixed and both row panes scroll together', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(360, 720));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ClubSeasonRankingGrid(
            onMember: null,
            hidden: true,
            rows: <ClubSeasonRankingRow>[
              for (int i = 1; i <= 25; i++)
                ClubSeasonRankingRow(
                  rank: i,
                  id: 'member-$i',
                  name: '회원 $i',
                  points: 100 - i,
                  attended: 1,
                  games: 3,
                  average: 200,
                  gold: 0,
                  silver: 0,
                  bronze: 0,
                  monthlyPoints: List<int>.filled(12, i),
                ),
            ],
          ),
        ),
      ),
    );
    final Offset headerBefore = tester.getTopLeft(find.text('이름'));
    final Offset monthBefore = tester.getTopLeft(find.text('1월'));
    await tester.drag(
      find.byKey(const Key('season-ranking-left-rows')),
      const Offset(0, -500),
    );
    await tester.pumpAndSettle();
    expect(tester.getTopLeft(find.text('이름')), headerBefore);
    expect(tester.getTopLeft(find.text('1월')), monthBefore);
    final left = tester.widget<SingleChildScrollView>(
      find.byKey(const Key('season-ranking-left-rows')),
    );
    final right = tester.widget<SingleChildScrollView>(
      find.byKey(const Key('season-ranking-score-rows')),
    );
    expect(left.controller!.offset, greaterThan(0));
    expect(right.controller!.offset, left.controller!.offset);
    await tester.dragFrom(const Offset(280, 300), const Offset(0, -200));
    await tester.pumpAndSettle();
    expect(right.controller!.offset, left.controller!.offset);
    expect(tester.takeException(), isNull);
  });
}
