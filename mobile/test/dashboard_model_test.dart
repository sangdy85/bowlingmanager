import 'package:bowlingmanager_mobile/features/home/domain/dashboard.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'integrated response preserves year, all sources and nullable fields',
    () {
      final dashboard = Dashboard.fromJson(<String, dynamic>{
        'year': 2026,
        'average': 310,
        'highScore': 320,
        'gameCount': 3,
        'recentAverage': 310,
        'recentScores': <Object>[
          for (final source in ['PERSONAL', 'LEAGUE', 'TOURNAMENT'])
            <String, dynamic>{
              'id': '$source:fixture',
              'source': source,
              'score': 310,
              'gameDate': '2026-06-01T00:00:00.000Z',
              'gameType': null,
              'memo': null,
              'team': null,
            },
        ],
        'recentSessions': <Object>[
          for (final source in ['PERSONAL', 'LEAGUE', 'TOURNAMENT'])
            _session(source: source),
        ],
      });
      expect(dashboard.year, 2026);
      expect(dashboard.highScore, 320);
      expect(
        dashboard.recentScores.map((s) => s.source),
        DashboardScoreSource.values,
      );
      expect(
        dashboard.recentScores.every(
          (s) => s.team == null && s.gameType == null && s.memo == null,
        ),
        isTrue,
      );
    },
  );

  test('unknown or missing source and malformed year are rejected', () {
    for (final source in [null, 'UNKNOWN', 1]) {
      expect(
        () => DashboardScore.fromJson(<String, dynamic>{
          'id': 'fixture',
          'source': source,
          'score': 200,
          'gameDate': '2026-06-01T00:00:00.000Z',
        }),
        throwsA(isA<FormatException>()),
      );
    }
    for (final year in [null, '2026', 2026.5, 1899, 2101]) {
      expect(
        () => Dashboard.fromJson(<String, dynamic>{
          'year': year,
          'average': 0,
          'highScore': 0,
          'gameCount': 0,
          'recentAverage': 0,
          'recentScores': <Object>[],
          'recentSessions': <Object>[],
        }),
        throwsA(isA<FormatException>()),
      );
    }
  });

  test('Dashboard.fromJson parses a valid dashboard response', () {
    final Dashboard dashboard = Dashboard.fromJson(<String, dynamic>{
      'year': 2026,
      'average': 187.45,
      'highScore': 245,
      'gameCount': 36,
      'recentAverage': 201.7,
      'recentScores': <Object>[
        <String, dynamic>{
          'id': 'score-1',
          'source': 'PERSONAL',
          'score': 215,
          'gameDate': '2026-09-15T00:00:00.000Z',
          'gameType': '연습',
          'memo': '릴리스 점검',
          'team': <String, dynamic>{'id': 'team-1', 'name': '테스트 팀'},
        },
      ],
      'recentSessions': <Object>[_session()],
    });

    expect(dashboard.average, 187.45);
    expect(dashboard.highScore, 245);
    expect(dashboard.gameCount, 36);
    expect(dashboard.recentAverage, 201.7);
    expect(dashboard.recentScores, hasLength(1));
    expect(dashboard.recentScores.single.score, 215);
    expect(dashboard.recentScores.single.team?.name, '테스트 팀');
  });

  test('Dashboard.fromJson accepts the zero-game response', () {
    final Dashboard dashboard = Dashboard.fromJson(<String, dynamic>{
      'year': 2026,
      'average': 0,
      'highScore': 0,
      'gameCount': 0,
      'recentAverage': 0,
      'recentScores': <Object>[],
      'recentSessions': <Object>[],
    });

    expect(dashboard.average, 0);
    expect(dashboard.highScore, 0);
    expect(dashboard.gameCount, 0);
    expect(dashboard.recentScores, isEmpty);
    expect(dashboard.recentAverage, 0);
  });

  test('Dashboard.fromJson accepts an empty recent score list', () {
    final Dashboard dashboard = Dashboard.fromJson(<String, dynamic>{
      'year': 2026,
      'average': 180,
      'highScore': 220,
      'gameCount': 12,
      'recentAverage': 0,
      'recentScores': <Object>[],
      'recentSessions': <Object>[],
    });

    expect(dashboard.recentScores, isEmpty);
  });

  test('Dashboard.fromJson rejects invalid field and score types', () {
    expect(
      () => Dashboard.fromJson(<String, dynamic>{
        'year': 2026,
        'average': '187.4',
        'highScore': 245,
        'gameCount': 36,
        'recentAverage': 201.7,
        'recentScores': <Object>[],
        'recentSessions': <Object>[],
      }),
      throwsA(isA<FormatException>()),
    );

    expect(
      () => Dashboard.fromJson(<String, dynamic>{
        'year': 2026,
        'average': 187.4,
        'highScore': 245,
        'gameCount': 36,
        'recentAverage': 201.7,
        'recentScores': <Object>[
          <String, dynamic>{
            'id': 'score-1',
            'source': 'PERSONAL',
            'score': '215',
            'gameDate': '2026-09-15T00:00:00.000Z',
            'gameType': null,
            'memo': null,
            'team': null,
          },
        ],
        'recentSessions': <Object>[],
      }),
      throwsA(isA<FormatException>()),
    );
  });
}

Map<String, Object?> _session({String source = 'PERSONAL'}) =>
    <String, Object?>{
      'id': '$source:session',
      'source': source,
      'gameDate': '2026-06-01T00:00:00.000Z',
      'gameType': null,
      'team': null,
      'scores': <Object>[
        <String, Object?>{'id': '$source:score', 'score': 310, 'memo': null},
      ],
      'total': 310,
      'average': 310,
      'gameCount': 1,
    };
