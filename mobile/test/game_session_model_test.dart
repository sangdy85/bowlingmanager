import 'package:bowlingmanager_mobile/core/domain/game_session.dart';
import 'package:bowlingmanager_mobile/features/records/domain/score_record.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses a grouped session with variable scores and summaries', () {
    final ScoresPage page = ScoresPage.fromJson(_scoresData());
    final GameSession session = page.items.single;

    expect(session.id, 'session-1');
    expect(session.scores.map((GameSessionScore item) => item.score), <int>[
      202,
      213,
      208,
    ]);
    expect(session.total, 623);
    expect(session.average, 207.7);
    expect(session.gameType, '정기전');
    expect(session.team?.name, '테스트 팀');
    expect(session.scores.first.memo, '첫 게임');
    expect(session.rank, isNull);
    expect(page.pagination.hasNextPage, isTrue);
  });

  test('parses nullable and valid rank metadata', () {
    for (final int position in <int>[1, 2, 3, 5]) {
      final Map<String, Object?> data = _scoresData();
      final item =
          (data['items']! as List<Object?>).single! as Map<String, Object?>;
      item['rank'] = <String, int>{
        'position': position,
        'participantCount': 13,
      };
      final GameSessionRank? rank = ScoresPage.fromJson(data).items.single.rank;
      expect(rank?.position, position);
      expect(rank?.participantCount, 13);
    }

    final Map<String, Object?> nullable = _scoresData();
    ((nullable['items']! as List<Object?>).single!
            as Map<String, Object?>)['rank'] =
        null;
    expect(ScoresPage.fromJson(nullable).items.single.rank, isNull);
  });

  test('rejects malformed rank metadata', () {
    for (final Object? rank in <Object?>[
      <String, Object>{'position': 0, 'participantCount': 3},
      <String, Object>{'position': 4, 'participantCount': 3},
      <String, Object>{'position': 1, 'participantCount': 0},
      <String, Object>{'position': '1', 'participantCount': 3},
      <String, Object>{'position': 1, 'participantCount': 3.0},
      '1위',
    ]) {
      final Map<String, Object?> data = _scoresData();
      ((data['items']! as List<Object?>).single!
              as Map<String, Object?>)['rank'] =
          rank;
      expect(() => ScoresPage.fromJson(data), throwsFormatException);
    }
  });

  test('allows nullable type, team and score memo', () {
    final Map<String, Object?> data = _scoresData();
    final item =
        (data['items']! as List<Object?>).single! as Map<String, Object?>;
    item['gameType'] = null;
    item['team'] = null;
    final score =
        (item['scores']! as List<Object?>).first! as Map<String, Object?>;
    score['memo'] = null;

    final GameSession session = ScoresPage.fromJson(data).items.single;
    expect(session.gameType, isNull);
    expect(session.team, isNull);
    expect(session.scores.first.memo, isNull);
  });

  test('rejects malformed summaries and out-of-range personal scores', () {
    for (final void Function(Map<String, Object?>) mutate
        in <void Function(Map<String, Object?>)>[
          (Map<String, Object?> item) => item['total'] = 999,
          (Map<String, Object?> item) => item['average'] = 999,
          (Map<String, Object?> item) => item['gameCount'] = 1,
          (Map<String, Object?> item) {
            final score =
                (item['scores']! as List<Object?>).first!
                    as Map<String, Object?>;
            score['score'] = 301;
          },
        ]) {
      final Map<String, Object?> data = _scoresData();
      mutate((data['items']! as List<Object?>).single! as Map<String, Object?>);
      expect(() => ScoresPage.fromJson(data), throwsFormatException);
    }
  });

  test('parses empty grouped pagination', () {
    final ScoresPage page = ScoresPage.fromJson(<String, Object>{
      'items': <Object>[],
      'pagination': <String, Object>{
        'page': 1,
        'limit': 20,
        'total': 0,
        'totalPages': 0,
      },
    });
    expect(page.items, isEmpty);
    expect(page.pagination.hasNextPage, isFalse);
  });
}

Map<String, Object?> _scoresData() => <String, Object?>{
  'items': <Object?>[
    <String, Object?>{
      'id': 'session-1',
      'source': 'PERSONAL',
      'gameDate': '2026-09-15T00:00:00.000Z',
      'gameType': '정기전',
      'team': <String, Object>{'id': 'team-1', 'name': '테스트 팀'},
      'scores': <Object>[
        <String, Object?>{'id': 's1', 'score': 202, 'memo': '첫 게임'},
        <String, Object?>{'id': 's2', 'score': 213, 'memo': null},
        <String, Object?>{'id': 's3', 'score': 208, 'memo': null},
      ],
      'total': 623,
      'average': 207.7,
      'gameCount': 3,
    },
  ],
  'pagination': <String, Object>{
    'page': 1,
    'limit': 20,
    'total': 21,
    'totalPages': 2,
  },
};
