import 'package:bowlingmanager_mobile/features/records/domain/score_record.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses a normal scores page and pagination metadata', () {
    final ScoresPage page = ScoresPage.fromJson(_scoresData());

    expect(page.items.single.id, 'score-1');
    expect(page.items.single.score, 215);
    expect(page.items.single.gameDate, DateTime.utc(2026, 9, 15));
    expect(page.items.single.gameType, '정기전');
    expect(page.items.single.memo, 'synthetic memo');
    expect(page.items.single.team?.name, '테스트 팀');
    expect(page.pagination.page, 1);
    expect(page.pagination.limit, 20);
    expect(page.pagination.total, 21);
    expect(page.pagination.totalPages, 2);
    expect(page.pagination.hasNextPage, isTrue);
  });

  test('allows nullable gameType, memo and team', () {
    final Map<String, Object?> data = _scoresData();
    final items = data['items']! as List<Object?>;
    final item = items.single! as Map<String, Object?>;
    item['gameType'] = null;
    item['memo'] = null;
    item['team'] = null;

    final ScoreRecord record = ScoresPage.fromJson(data).items.single;

    expect(record.gameType, isNull);
    expect(record.memo, isNull);
    expect(record.team, isNull);
  });

  test('parses an empty records response', () {
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

  test('rejects invalid score field types and out-of-range values', () {
    for (final Object invalidScore in <Object>['215', 215.0, true, -1, 301]) {
      final Map<String, Object?> data = _scoresData();
      final items = data['items']! as List<Object?>;
      final item = items.single! as Map<String, Object?>;
      item['score'] = invalidScore;

      expect(() => ScoresPage.fromJson(data), throwsFormatException);
    }
  });

  test('rejects an invalid game date', () {
    final Map<String, Object?> data = _scoresData();
    final items = data['items']! as List<Object?>;
    final item = items.single! as Map<String, Object?>;
    item['gameDate'] = 'not-a-date';

    expect(() => ScoresPage.fromJson(data), throwsFormatException);
  });

  test('rejects invalid pagination metadata', () {
    final Map<String, Object?> data = _scoresData();
    final pagination = data['pagination']! as Map<String, Object?>;
    pagination['totalPages'] = 9;

    expect(() => ScoresPage.fromJson(data), throwsFormatException);
  });
}

Map<String, Object?> _scoresData() => <String, Object?>{
  'items': <Object?>[
    <String, Object?>{
      'id': 'score-1',
      'score': 215,
      'gameDate': '2026-09-15T00:00:00.000Z',
      'gameType': '정기전',
      'memo': 'synthetic memo',
      'team': <String, Object>{'id': 'team-1', 'name': '테스트 팀'},
    },
  ],
  'pagination': <String, Object>{
    'page': 1,
    'limit': 20,
    'total': 21,
    'totalPages': 2,
  },
};
