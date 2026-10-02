import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses club summaries, detail and nullable member handicap', () {
    final ClubSummary summary = ClubSummary.fromJson(<String, dynamic>{
      'id': 'team-1',
      'name': '테스트 동호회',
      'myRole': 'OWNER',
      'memberCount': 3,
      'bowlerHiddenEnabled': true,
    });
    final ClubDetail detail = ClubDetail.fromJson(<String, dynamic>{
      'id': 'team-1',
      'name': '테스트 동호회',
      'myRole': 'MANAGER',
      'memberCount': 3,
      'inviteUrl': 'https://www.bowlingmanager.co.kr/invite/team/TEST01',
    });
    final ClubMember member = ClubMember.fromJson(<String, dynamic>{
      'id': 'membership-1',
      'name': '회원',
      'role': 'MEMBER',
      'handicap': null,
    });

    expect(summary.myRole, ClubRole.owner);
    expect(summary.bowlerHiddenEnabled, isTrue);
    expect(detail.myRole, ClubRole.manager);
    expect(
      detail.inviteUrl.toString(),
      'https://www.bowlingmanager.co.kr/invite/team/TEST01',
    );
    expect(member.handicap, isNull);
    expect(member.role.label, '회원');
  });

  test('accepts integer handicap and rejects malformed fields', () {
    final ClubMember member = ClubMember.fromJson(<String, dynamic>{
      'id': 'membership-1',
      'name': '회원',
      'role': 'MEMBER',
      'handicap': 15,
    });
    expect(member.handicap, 15);

    for (final Map<String, dynamic> json in <Map<String, dynamic>>[
      <String, dynamic>{
        'id': '',
        'name': '회원',
        'role': 'MEMBER',
        'handicap': null,
      },
      <String, dynamic>{
        'id': 'membership-1',
        'name': '회원',
        'role': 'MEMBER',
        'handicap': '15',
      },
      <String, dynamic>{
        'id': 'membership-1',
        'name': '회원',
        'role': 'UNKNOWN',
        'handicap': null,
      },
    ]) {
      expect(() => ClubMember.fromJson(json), throwsFormatException);
    }
  });

  test('rejects malformed club summary types and unknown roles', () {
    expect(
      () => ClubSummary.fromJson(<String, dynamic>{
        'id': 'team-1',
        'name': '테스트 동호회',
        'myRole': 'UNKNOWN',
        'memberCount': 3,
      }),
      throwsFormatException,
    );
    expect(
      () => ClubSummary.fromJson(<String, dynamic>{
        'id': 'team-1',
        'name': '테스트 동호회',
        'myRole': 'MEMBER',
        'memberCount': '3',
      }),
      throwsFormatException,
    );
    expect(
      () => ClubSummary.fromJson(<String, dynamic>{
        'id': 'team-1',
        'name': '테스트 동호회',
        'myRole': 'MEMBER',
        'memberCount': 3,
        'bowlerHiddenEnabled': 'true',
      }),
      throwsFormatException,
    );
  });

  test('invite share text uses the server-provided HTTPS URL exactly', () {
    final ClubDetail detail = ClubDetail(
      id: 'team-1',
      name: '테스트 동호회',
      myRole: ClubRole.member,
      memberCount: 3,
      inviteUrl: Uri.parse(
        'https://www.bowlingmanager.co.kr/invite/team/TEST01',
      ),
    );
    expect(
      buildClubInviteShareText(detail),
      '테스트 동호회 동호회에 초대합니다 🎳\n\n'
      'BowlingManager에서 일정, 정모 기록과 시즌 순위를 함께 확인하세요.\n\n'
      'https://www.bowlingmanager.co.kr/invite/team/TEST01',
    );
  });
}
