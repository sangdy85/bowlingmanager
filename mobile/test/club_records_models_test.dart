import 'package:bowlingmanager_mobile/features/club/domain/club_records_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'parses statistics including empty months and integer numeric values',
    () {
      final ClubStatistics result = ClubStatistics.fromJson(
        _statisticsJson(members: <Object>[_memberJson]),
      );

      expect(result.filter, ClubRecordFilter.regular);
      expect(result.availableYears, <int>[2026, 2025]);
      expect(result.summary.average, 205);
      expect(result.summary.monthlyAverages[8], 205);
      expect(result.members.single.name, '회원 별명');
    },
  );

  test('parses an empty statistics year and empty activity page', () {
    final ClubStatistics statistics = ClubStatistics.fromJson(
      _statisticsJson(members: const <Object>[]),
    );
    final ClubActivitiesPage activities = ClubActivitiesPage.fromJson(
      <String, Object>{
        'year': 2026,
        'filter': 'ALL',
        'items': const <Object>[],
        'pagination': const <String, int>{
          'page': 1,
          'limit': 20,
          'total': 0,
          'totalPages': 0,
        },
      },
    );

    expect(statistics.members, isEmpty);
    expect(activities.items, isEmpty);
    expect(activities.hasNextPage, isFalse);
  });

  test('parses activity detail with a variable number of scores', () {
    final ClubActivityDetail detail = ClubActivityDetail.fromJson(
      <String, Object>{
        ..._activityJson,
        'participants': <Object>[
          <String, Object>{
            'rank': 1,
            'id': 'membership-1',
            'name': '회원',
            'scores': <int>[190, 200, 210, 220, 230],
            'total': 1050,
            'average': 210,
          },
        ],
      },
    );

    expect(detail.participants.single.scores.length, 5);
    expect(detail.participants.single.rank, 1);
  });

  test(
    'rejects malformed monthly, filter, activity and participant fields',
    () {
      final Map<String, dynamic> badStatistics = _statisticsJson(
        members: <Object>[_memberJson],
      );
      (badStatistics['summary']! as Map<String, Object>)['monthlyAverages'] =
          <int>[1, 2];
      expect(
        () => ClubStatistics.fromJson(badStatistics),
        throwsFormatException,
      );
      expect(() => ClubRecordFilter.fromJson('UNKNOWN'), throwsFormatException);
      expect(
        () => ClubActivity.fromJson(<String, Object>{
          ..._activityJson,
          'dailyAverage': '205',
        }),
        throwsFormatException,
      );
      expect(
        () => ClubActivityParticipant.fromJson(<String, Object>{
          'rank': 1,
          'id': 'membership-1',
          'name': '회원',
          'scores': <Object>[200, 'bad'],
          'total': 200,
          'average': 200,
        }),
        throwsFormatException,
      );
    },
  );
}

Map<String, dynamic> _statisticsJson({required List<Object> members}) =>
    <String, dynamic>{
      'year': 2026,
      'filter': 'REGULAR',
      'availableYears': <int>[2026, 2025],
      'summary': <String, Object>{
        'activityCount': 1,
        'memberCount': members.length,
        'attendanceRate': members.isEmpty ? 0 : 100,
        'gameCount': members.isEmpty ? 0 : 2,
        'monthlyAverages': <int?>[
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          members.isEmpty ? null : 205,
          null,
          null,
          null,
        ],
        'total': members.isEmpty ? 0 : 410,
        'average': members.isEmpty ? 0 : 205,
      },
      'members': members,
    };

const Map<String, Object> _memberJson = <String, Object>{
  'id': 'membership-1',
  'name': '회원 별명',
  'attendanceRate': 100,
  'attended': 1,
  'activityCount': 1,
  'gameCount': 2,
  'monthlyAverages': <int?>[
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    205,
    null,
    null,
    null,
  ],
  'total': 410,
  'average': 205,
};

const Map<String, Object> _activityJson = <String, Object>{
  'id': '2026-09-19~REGULAR',
  'date': '2026-09-19',
  'gameType': '정기전',
  'participantCount': 1,
  'gameCount': 5,
  'dailyAverage': 210,
};
