import 'package:bowlingmanager_mobile/features/club/domain/club_competition_score_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/competition_score_ocr.dart';
import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses member and guest competition score snapshots', () {
    final entry = ClubCompetitionScoreEntry.fromJson(<String, dynamic>{
      'event': <String, Object?>{
        'id': 'event-1',
        'teamName': '테스트 동호회',
        'title': '개인전',
        'date': '2026-09-26',
        'gameType': '정기전',
        'competitionType': 'INDIVIDUAL',
        'competitionMode': 'OFFICIAL',
        'status': 'GROUPS_READY',
      },
      'gameCount': 2,
      'readOnly': false,
      'participants': <Object>[
        <String, Object?>{
          'participantId': 'member:m1',
          'participantKind': 'MEMBER',
          'memberId': 'm1',
          'guestId': null,
          'name': '회원',
          'group': 'A',
          'competitionTeamName': null,
          'scores': <int>[200, 210],
        },
        <String, Object?>{
          'participantId': 'guest:g1',
          'participantKind': 'GUEST',
          'memberId': null,
          'guestId': 'g1',
          'name': '게스트',
          'group': 'E',
          'competitionTeamName': null,
          'scores': <int>[180, 190],
        },
      ],
    });
    expect(entry.gameCount, 2);
    expect(entry.teamName, '테스트 동호회');
    expect(entry.competitionMode, 'OFFICIAL');
    expect(entry.participants.map((item) => item.name), <String>['회원', '게스트']);
    expect(entry.participants.last.scores, <int>[180, 190]);
  });

  test('rejects malformed score range and event envelope', () {
    expect(
      () => ClubCompetitionScoreParticipant.fromJson(<String, dynamic>{
        'participantId': 'm1',
        'participantKind': 'MEMBER',
        'name': '회원',
        'scores': <int>[301],
      }),
      throwsFormatException,
    );
    expect(
      () => ClubCompetitionScoreEntry.fromJson(<String, dynamic>{
        'event': <String, Object>{},
        'gameCount': 0,
        'readOnly': false,
        'participants': <Object>[],
      }),
      throwsFormatException,
    );
  });

  test('matches OCR by member id or a unique exact name only', () {
    final entry = _entry(<ClubCompetitionScoreParticipant>[
      _participant('member:1', '동명이인', memberId: 'm1'),
      _participant('member:2', '동명이인', memberId: 'm2'),
      _participant('guest:1', '게스트', guestId: 'g1'),
    ]);
    final result = matchCompetitionOcrPlayers(entry, const <OcrPlayer>[
      OcrPlayer(
        name: '다른 OCR 이름',
        scores: <int>[200, 210],
        matchedMemberId: 'm2',
      ),
      OcrPlayer(name: '게스트', scores: <int>[180, 190], matchedMemberId: null),
      OcrPlayer(name: '동명이인', scores: <int>[170, 175], matchedMemberId: null),
      OcrPlayer(name: '게임수 오류', scores: <int>[160], matchedMemberId: null),
    ]);
    expect(result.matches.keys, containsAll(<String>['member:2', 'guest:1']));
    expect(result.matches, isNot(contains('member:1')));
    expect(result.unmatchedNames, <String>['동명이인', '게임수 오류']);
  });
}

ClubCompetitionScoreParticipant _participant(
  String id,
  String name, {
  String? memberId,
  String? guestId,
}) => ClubCompetitionScoreParticipant(
  participantId: id,
  participantKind: memberId == null ? 'GUEST' : 'MEMBER',
  memberId: memberId,
  guestId: guestId,
  name: name,
  group: null,
  competitionTeamName: null,
  scores: const <int>[],
);

ClubCompetitionScoreEntry _entry(
  List<ClubCompetitionScoreParticipant> participants,
) => ClubCompetitionScoreEntry(
  eventId: 'event-1',
  teamName: '테스트 동호회',
  title: '개인전',
  date: '2026-09-26',
  gameType: '정기전',
  competitionType: 'INDIVIDUAL',
  competitionMode: 'OFFICIAL',
  status: 'GROUPS_READY',
  gameCount: 2,
  readOnly: false,
  participants: participants,
);
