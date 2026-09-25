import 'package:bowlingmanager_mobile/features/club/domain/club_event_competition_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses voting state without exposing other ballots', () {
    final state = ClubEventCompetitionState.fromJson(<String, dynamic>{
      'status': 'VOTING_OPEN',
      'canManage': false,
      'isParticipant': true,
      'myParticipantId': 'participant-1',
      'voteOpenAt': '2026-09-22T10:00:00.000Z',
      'voteCloseAt': '2026-09-22T10:30:00.000Z',
      'serverNow': '2026-09-22T10:10:00.000Z',
      'gameCount': 4,
      'participants': <Object>[
        <String, Object>{
          'participantId': 'participant-1',
          'memberId': 'member-1',
          'name': '회원1',
        },
        <String, Object?>{
          'participantId': 'participant-guest',
          'participantKind': 'GUEST',
          'memberId': null,
          'guestId': 'guest-1',
          'name': '게스트A',
        },
        <String, Object>{
          'participantId': 'participant-2',
          'memberId': 'member-2',
          'name': '회원2',
        },
      ],
      'voting': <String, Object>{
        'submittedCount': 1,
        'pendingCount': 3,
        'mySelections': <String>['participant-2'],
        'submittedParticipantIds': <String>['participant-1'],
      },
      'scoreComplete': false,
      'reveal': <String, Object>{'revealedCount': 0, 'totalCount': 4},
      'finalPreview': null,
    });
    expect(state.status, 'VOTING_OPEN');
    expect(state.polling, isTrue);
    expect(state.voting!.mySelections, <String>['participant-2']);
    expect(state.voting!.submittedParticipantIds, <String>['participant-1']);
    expect(
      state.participants
          .where((participant) => participant.participantKind == 'GUEST')
          .single
          .guestId,
      'guest-1',
    );
  });

  test('parses decimal published result and own selections', () {
    final state = ClubEventCompetitionState.fromJson(<String, dynamic>{
      'status': 'PUBLISHED',
      'canManage': false,
      'isParticipant': true,
      'myParticipantId': 'participant-1',
      'ranking': <Object>[_result()],
      'myResult': <String, dynamic>{
        ..._result(),
        'selections': <Object>[
          <String, Object>{
            'participantId': 'participant-2',
            'name': '회원2',
            'shareScore': 152.83333333333334,
          },
        ],
      },
    });
    expect(state.ranking!.single.finalScore, 1724.9333333333334);
    expect(
      state.myResult!.selections.single.shareScore,
      closeTo(152.83333333333334, 0.000001),
    );
    expect(state.polling, isFalse);
  });

  test('rejects malformed score types', () {
    expect(
      () => ClubEventCompetitionState.fromJson(<String, dynamic>{
        'status': 'PUBLISHED',
        'canManage': false,
        'isParticipant': true,
        'myParticipantId': null,
        'ranking': <Object>[
          <String, dynamic>{..._result(), 'finalScore': 'bad'},
        ],
        'myResult': null,
      }),
      throwsFormatException,
    );
  });
}

Map<String, dynamic> _result() => <String, dynamic>{
  'rank': 1,
  'participantId': 'participant-1',
  'memberId': 'member-1',
  'name': '회원1',
  'actualScore': 966,
  'voteCount': 4,
  'shareScore': 241.5,
  'voteBonus': 758.9333333333334,
  'finalScore': 1724.9333333333334,
  'seasonPoint': 20,
};
