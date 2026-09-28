import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/home/domain/dashboard.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses lifecycle and immutable final ranking snapshot', () {
    final ranking = ClubSeasonRanking.fromJson(<String, dynamic>{
      'enabled': true,
      'bowlerHiddenEnabled': true,
      'season': <String, Object>{
        'id': 'season-2025',
        'name': '2025 시즌',
        'startDate': '2025-01-01',
        'endDate': '2025-12-31',
        'status': 'COMPLETED',
        'lifecycleStatus': 'ENDED',
        'scoringMode': 'FULL_RANK',
        'rankingMode': 'DATA',
        'points': <int>[50, 30, 20],
      },
      'seasons': <Object>[],
      'rankings': <Object>[],
      'finalRanking': <String, Object>{
        'id': 'final-2',
        'revision': 2,
        'rankingMode': 'DATA',
        'finalizedAt': '2026-01-02T00:00:00.000Z',
        'finalizedBy': <String, String>{'id': 'manager', 'name': '관리자'},
        'entries': <Object>[
          <String, Object?>{
            'id': 'entry-1',
            'memberId': null,
            'displayName': '당시 회원',
            'rank': 1,
            'totalPoints': 183,
          },
        ],
      },
    });

    expect(ranking.season!.lifecycleStatus, 'ENDED');
    expect(ranking.finalRanking!.revision, 2);
    expect(ranking.finalRanking!.entries.single.memberId, isNull);
    expect(ranking.finalRanking!.entries.single.displayName, '당시 회원');
    expect(ranking.finalRanking!.entries.single.totalPoints, 183);
  });

  test('records season summary preserves current and past rank separately', () {
    final summary = DashboardSeasonSummary.fromJson(<String, dynamic>{
      'teamId': 'team-1',
      'teamName': '배볼러',
      'seasonId': 'season-2025',
      'seasonName': '2025 시즌',
      'startDate': '2025-01-01',
      'endDate': '2025-12-31',
      'lifecycleStatus': 'ENDED',
      'rankingMode': 'DATA',
      'rank': 2,
      'points': 178,
      'finalRank': 1,
      'finalizedAt': '2026-01-02T00:00:00.000Z',
    });

    expect(summary.rank, 2);
    expect(summary.points, 178);
    expect(summary.finalRank, 1);
    expect(summary.lifecycleStatus, 'ENDED');
  });

  test('rejects malformed lifecycle and final rank response', () {
    expect(
      () => DashboardSeasonSummary.fromJson(<String, dynamic>{
        'teamId': 'team-1',
        'teamName': '배볼러',
        'seasonId': 'season',
        'seasonName': '시즌',
        'startDate': '2026-01-01',
        'endDate': '2026-12-31',
        'lifecycleStatus': 'BROKEN',
        'rankingMode': 'DATA',
        'rank': 1,
        'points': 1,
        'finalRank': null,
        'finalizedAt': null,
      }),
      throwsFormatException,
    );
  });
}
