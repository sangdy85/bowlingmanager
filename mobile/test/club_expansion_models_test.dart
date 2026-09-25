import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'member profile parses nullable fields, 12 months and recent scores',
    () {
      final profile = ClubMemberProfile.fromJson(_memberJson());
      expect(profile.name, '별명');
      expect(profile.alias, '별명');
      expect(profile.role, ClubRole.member);
      expect(profile.handicap, isNull);
      expect(profile.activityStartDate, DateTime(2026, 1, 2));
      expect(profile.monthlyAverages, hasLength(12));
      expect(profile.recentScores.single.score, 210);
    },
  );

  test(
    'member profile supports no attendance and rejects malformed monthly data',
    () {
      final empty = _memberJson()
        ..['activityStartDate'] = null
        ..['attendanceRate'] = 0
        ..['attended'] = 0
        ..['gameCount'] = 0
        ..['total'] = 0
        ..['average'] = 0
        ..['recentRegularScores'] = <Object>[];
      expect(ClubMemberProfile.fromJson(empty).activityStartDate, isNull);

      final malformed = _memberJson()
        ..['monthlyAverages'] = <Object?>[
          '210',
          ...List<Object?>.filled(11, null),
        ];
      expect(
        () => ClubMemberProfile.fromJson(malformed),
        throwsFormatException,
      );
    },
  );

  test('season ranking parses enabled and disabled contracts', () {
    final disabled = ClubSeasonRanking.fromJson(<String, dynamic>{
      'enabled': false,
      'bowlerHiddenEnabled': false,
      'season': null,
      'rankings': <Object>[],
    });
    expect(disabled.enabled, isFalse);
    expect(disabled.rows, isEmpty);

    final enabled = ClubSeasonRanking.fromJson(<String, dynamic>{
      'enabled': true,
      'bowlerHiddenEnabled': true,
      'season': _seasonJson(),
      'seasons': <Object>[_seasonJson()],
      'competitionType': 'ALL',
      'rankings': <Object>[
        <String, dynamic>{
          'rank': 1,
          'id': 'member-1',
          'name': '별명',
          'points': 12,
          'attended': 3,
          'games': 9,
          'average': 203.4,
          'gold': 2,
          'silver': 1,
          'bronze': 0,
          'individualPoints': 50,
          'teamPoints': 20,
          'eventPoints': 0,
          'competitionsPlayed': 3,
          'individualWins': 1,
          'teamWins': 0,
          'eventWins': 0,
          'entries': <Object>[_seasonEntryJson()],
          'monthlyHistory': <Object>[
            <Object>[_seasonEntryJson()],
            ...List<Object>.filled(11, const <Object>[]),
          ],
        },
      ],
    });
    expect(enabled.season?.scoringMode, 'PODIUM');
    expect(enabled.rows.single.points, 12);
    expect(enabled.rows.single.individualPoints, 50);
    expect(enabled.rows.single.monthlyHistory.first, hasLength(1));
    expect(enabled.seasons.single.teamPoints.first.points, 35);
  });

  test('season ranking rejects malformed point ledger and point tables', () {
    final season = _seasonJson();
    (season['pointTables'] as Map<String, dynamic>)['team'] = <Object>[
      <String, Object>{'rank': 0, 'points': 35},
    ];
    expect(() => ClubSeason.fromJson(season), throwsFormatException);

    final entry = _seasonEntryJson()..['month'] = 13;
    expect(() => ClubSeasonPointEntry.fromJson(entry), throwsFormatException);
  });

  test('board models parse list pagination and author edit permission', () {
    final page = ClubPostsPage.fromJson(<String, dynamic>{
      'items': <Object>[
        <String, dynamic>{
          'id': 'post-1',
          'title': '공지',
          'authorName': '작성자',
          'createdAt': '2026-09-22T00:00:00.000Z',
          'updatedAt': '2026-09-22T00:00:00.000Z',
          'imageCount': 1,
        },
      ],
      'pagination': <String, int>{
        'page': 1,
        'limit': 20,
        'total': 1,
        'totalPages': 1,
      },
    });
    expect(page.items.single.imageCount, 1);

    final detail = ClubPostDetail.fromJson(<String, dynamic>{
      'id': 'post-1',
      'title': '공지',
      'content': '본문',
      'authorName': '작성자',
      'createdAt': '2026-09-22T00:00:00.000Z',
      'updatedAt': '2026-09-22T00:00:00.000Z',
      'images': <Object>[],
      'canEdit': true,
    });
    expect(detail.canEdit, isTrue);
  });
}

Map<String, dynamic> _memberJson() => <String, dynamic>{
  'id': 'member-1',
  'name': '별명',
  'alias': '별명',
  'role': 'MEMBER',
  'handicap': null,
  'joinedAt': '2025-01-01T00:00:00.000Z',
  'activityStartDate': '2026-01-02',
  'year': 2026,
  'attendanceRate': 50,
  'attended': 1,
  'activityCount': 2,
  'gameCount': 1,
  'total': 210,
  'average': 210,
  'monthlyAverages': <int?>[
    210,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ],
  'medals': <String, int>{'gold': 1, 'silver': 0, 'bronze': 0},
  'recentRegularScores': <Object>[
    <String, dynamic>{'id': 'score-1', 'date': '2026-01-02', 'score': 210},
  ],
};

Map<String, dynamic> _seasonJson() => <String, dynamic>{
  'id': 'season-1',
  'name': '2026 시즌',
  'startDate': '2026-01-01',
  'endDate': '2026-12-31',
  'enabled': true,
  'scoringMode': 'PODIUM',
  'points': <int>[5, 3, 1],
  'status': 'ACTIVE',
  'pointTables': <String, dynamic>{
    'individual': <Object>[
      <String, int>{'rank': 1, 'points': 50},
    ],
    'team': <Object>[
      <String, int>{'rank': 1, 'points': 35},
    ],
    'event': <Object>[
      <String, int>{'rank': 1, 'points': 50},
    ],
  },
};

Map<String, dynamic> _seasonEntryJson() => <String, dynamic>{
  'id': 'entry-1',
  'eventId': 'event-1',
  'competitionType': 'INDIVIDUAL',
  'competitionDate': '2026-01-10T03:00:00.000Z',
  'competitionTitle': '1월 개인전',
  'finalRank': 1,
  'points': 50,
  'month': 1,
};
