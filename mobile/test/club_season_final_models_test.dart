import 'package:bowlingmanager_mobile/features/club/domain/club_season_final_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('season final live detail parses seed snapshot and node results', () {
    final detail = ClubSeasonFinalDetail.fromJson(<String, dynamic>{
      'id': 'final-1',
      'name': '2026 최종전',
      'status': 'IN_PROGRESS',
      'competitionMode': 'MINI',
      'season': <String, dynamic>{'id': 'season-1', 'name': '2026 시즌'},
      'canManage': true,
      'canLock': false,
      'participants': <Object>[
        <String, dynamic>{
          'id': 'participant-1',
          'displayNameSnapshot': '선수 1',
          'seed': 1,
          'seasonPointsSnapshot': 50,
          'finalPlacement': null,
        },
      ],
      'nodes': <Object>[
        <String, dynamic>{
          'id': 'node-1',
          'name': 'A조 결승',
          'type': 'FINAL',
          'status': 'COMPLETED',
          'gameCount': 2,
          'entries': <Object>[
            <String, dynamic>{
              'participant': <String, dynamic>{
                'id': 'participant-1',
                'displayNameSnapshot': '선수 1',
                'seed': 1,
                'seasonPointsSnapshot': 50,
                'finalPlacement': null,
              },
            },
          ],
          'results': <Object>[
            <String, dynamic>{
              'participantId': 'participant-1',
              'rank': 1,
              'totalPins': 420,
              'average': 210.0,
            },
          ],
        },
      ],
    });
    expect(detail.nodes.single.results.single.totalPins, 420);
    expect(detail.participants.single.seed, 1);
  });

  test(
    'season final parser rejects malformed scores and nullable violations',
    () {
      expect(
        () => ClubSeasonFinalParticipant.fromJson(<String, dynamic>{
          'id': 'p',
          'displayNameSnapshot': '선수',
          'seed': '1',
          'seasonPointsSnapshot': 5,
          'finalPlacement': null,
        }),
        throwsFormatException,
      );
    },
  );
}
