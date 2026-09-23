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
}
