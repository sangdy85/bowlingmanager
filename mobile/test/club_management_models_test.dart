import 'package:bowlingmanager_mobile/features/club/domain/club_management_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses admin edit response with nullable memo and variable scores', () {
    final result = ClubActivityEditEnvelope.fromJson(<String, dynamic>{
      'role': 'MANAGER',
      'activity': <String, dynamic>{
        'id': '2026-09-19~REGULAR',
        'revision': 'revision',
        'date': '2026-09-19',
        'gameType': '정기전',
        'memo': null,
        'scoreCount': 2,
        'participants': <Object>[
          <String, Object?>{
            'memberId': null,
            'name': '게스트',
            'scores': <Object>[
              <String, Object>{'id': 'a', 'score': 0},
              <String, Object>{'id': 'b', 'score': 300},
            ],
          },
        ],
      },
    });
    expect(result.role, ClubRole.manager);
    expect(result.activity.memo, isNull);
    expect(
      result.activity.participants.single.scores.map((score) => score.value),
      <int>[0, 300],
    );
  });

  test('rejects malformed editable scores and role', () {
    Map<String, dynamic> payload(Object score) => <String, dynamic>{
      'role': 'OWNER',
      'activity': <String, dynamic>{
        'id': 'id',
        'revision': 'revision',
        'date': '2026-09-19',
        'gameType': '정기전',
        'memo': null,
        'scoreCount': 1,
        'participants': <Object>[
          <String, Object?>{
            'memberId': 'member',
            'name': '회원',
            'scores': <Object>[
              <String, Object>{'id': 'score', 'score': score},
            ],
          },
        ],
      },
    };
    for (final Object score in <Object>[-1, 301, 1.5, '200']) {
      expect(
        () => ClubActivityEditEnvelope.fromJson(payload(score)),
        throwsFormatException,
      );
    }
    final invalidRole = payload(200)..['role'] = 'SUPER_ADMIN';
    expect(
      () => ClubActivityEditEnvelope.fromJson(invalidRole),
      throwsFormatException,
    );
  });
}
