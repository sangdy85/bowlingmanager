import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses options and normalized OCR players', () {
    final CaptureOptions options = CaptureOptions.fromJson(<String, Object>{
      'gameTypes': <String>['정기전', '기타'],
      'teams': <Object>[
        <String, Object>{
          'id': 'team-1',
          'name': '테스트 팀',
          'members': <Object>[
            <String, Object>{'id': 'member-1', 'name': '회원'},
          ],
        },
      ],
    });
    final OcrPlayer player = OcrPlayer.fromJson(<String, Object?>{
      'name': '회원',
      'scores': <int>[0, 300],
      'matchedMemberId': null,
    });

    expect(options.gameTypes, <String>['정기전', '기타']);
    expect(options.teams.single.members.single.id, 'member-1');
    expect(player.scores, <int>[0, 300]);
    expect(player.matchedMemberId, isNull);
  });

  test(
    'rejects malformed envelopes, nullable violations and invalid scores',
    () {
      expect(
        () => CaptureOptions.fromJson(<String, Object>{'teams': <Object>[]}),
        throwsFormatException,
      );
      expect(
        () => OcrPlayer.fromJson(<String, Object?>{
          'name': '회원',
          'scores': <Object>[301],
          'matchedMemberId': null,
        }),
        throwsFormatException,
      );
      expect(
        () => OcrPlayer.fromJson(<String, Object?>{
          'name': '회원',
          'scores': <Object>[200],
          'matchedMemberId': 1,
        }),
        throwsFormatException,
      );
    },
  );

  test('draft validation accepts integers only from zero through 300', () {
    const CapturePlayerDraft valid = CapturePlayerDraft(
      inputId: 0,
      name: '회원',
      scoreTexts: <String>['0', '300'],
      memberId: null,
    );
    expect(valid.validatedScores(), <int>[0, 300]);
    expect(
      valid.copyWith(scoreTexts: <String>['1.5']).validatedScores(),
      isNull,
    );
    expect(
      valid.copyWith(scoreTexts: <String>['301']).validatedScores(),
      isNull,
    );
    expect(valid.copyWith(scoreTexts: <String>['']).validatedScores(), isNull);
  });

  test(
    'draft keeps Korean, English, numbers, spaces and punctuation unchanged',
    () {
      const CapturePlayerDraft draft = CapturePlayerDraft(
        inputId: 7,
        name: 'initial',
        scoreTexts: <String>['200'],
        memberId: null,
      );
      for (final String value in <String>[
        '테스트',
        '배볼러',
        '정기전 9월 모임',
        '서울 볼링장',
        '안녕하세요 테스트입니다.',
        '홍길동',
        'Bowler 123!',
      ]) {
        expect(draft.copyWith(name: value).name, value);
      }
    },
  );
}
