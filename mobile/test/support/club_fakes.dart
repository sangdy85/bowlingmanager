import 'dart:async';

import 'package:bowlingmanager_mobile/features/club/data/club_api.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_repository.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_records_models.dart';

const ClubSummary testClub = ClubSummary(
  id: 'team-1',
  name: '테스트 동호회',
  myRole: ClubRole.owner,
  memberCount: 3,
);

const ClubSummary secondClub = ClubSummary(
  id: 'team-2',
  name: '두 번째 동호회',
  myRole: ClubRole.member,
  memberCount: 8,
);

const ClubDetail testClubDetail = ClubDetail(
  id: 'team-1',
  name: '테스트 동호회',
  myRole: ClubRole.owner,
  memberCount: 3,
);

const List<ClubMember> testClubMembers = <ClubMember>[
  ClubMember(id: 'member-1', name: '팀장', role: ClubRole.owner, handicap: 10),
  ClubMember(
    id: 'member-2',
    name: '매니저',
    role: ClubRole.manager,
    handicap: null,
  ),
  ClubMember(id: 'member-3', name: '회원', role: ClubRole.member, handicap: 20),
];

const ClubStatistics testClubStatistics = ClubStatistics(
  year: 2026,
  filter: ClubRecordFilter.regular,
  availableYears: <int>[2026, 2025],
  summary: ClubStatisticsSummary(
    activityCount: 2,
    memberCount: 1,
    attendanceRate: 100,
    gameCount: 3,
    monthlyAverages: <int?>[
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      210,
      null,
      null,
      null,
    ],
    total: 630,
    average: 210,
  ),
  members: <ClubMemberStatistics>[
    ClubMemberStatistics(
      id: 'member-1',
      name: '팀장',
      attendanceRate: 100,
      attended: 2,
      activityCount: 2,
      gameCount: 3,
      monthlyAverages: <int?>[
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        210,
        null,
        null,
        null,
      ],
      total: 630,
      average: 210,
    ),
  ],
);

final ClubActivity testClubActivity = ClubActivity(
  id: '2026-09-19~REGULAR',
  date: DateTime(2026, 9, 19),
  gameType: '정기전',
  participantCount: 1,
  gameCount: 3,
  dailyAverage: 210,
);

final ClubActivityDetail testClubActivityDetail = ClubActivityDetail(
  id: testClubActivity.id,
  date: testClubActivity.date,
  gameType: testClubActivity.gameType,
  participantCount: 1,
  gameCount: 3,
  dailyAverage: 210,
  participants: const <ClubActivityParticipant>[
    ClubActivityParticipant(
      rank: 1,
      id: 'member-1',
      name: '팀장',
      scores: <int>[200, 210, 220],
      total: 630,
      average: 210,
    ),
  ],
);

ClubActivitiesPage testClubActivitiesPage({int page = 1, int totalPages = 1}) =>
    ClubActivitiesPage(
      year: 2026,
      filter: ClubRecordFilter.regular,
      items: <ClubActivity>[testClubActivity],
      page: page,
      limit: 20,
      total: 1,
      totalPages: totalPages,
    );

class FakeClubApi implements ClubApi {
  List<ClubSummary> clubs = <ClubSummary>[testClub];
  ClubDetail detail = testClubDetail;
  List<ClubMember> members = testClubMembers;
  Object? error;

  @override
  Future<ClubActivitiesPage> fetchClubActivities({
    required String teamId,
    required int year,
    required ClubRecordFilter filter,
    required int page,
    required int limit,
  }) async {
    if (error case final Object currentError) throw currentError;
    return testClubActivitiesPage(page: page);
  }

  @override
  Future<ClubActivityDetail> fetchClubActivity({
    required String teamId,
    required String activityId,
  }) async {
    if (error case final Object currentError) throw currentError;
    return testClubActivityDetail;
  }

  @override
  Future<ClubStatistics> fetchClubStatistics({
    required String teamId,
    required int year,
    required ClubRecordFilter filter,
  }) async {
    if (error case final Object currentError) throw currentError;
    return testClubStatistics;
  }

  @override
  Future<List<ClubSummary>> fetchClubs() async {
    if (error case final Object currentError) throw currentError;
    return clubs;
  }

  @override
  Future<ClubDetail> fetchClubDetail(String teamId) async {
    if (error case final Object currentError) throw currentError;
    return detail;
  }

  @override
  Future<List<ClubMember>> fetchClubMembers(String teamId) async {
    if (error case final Object currentError) throw currentError;
    return members;
  }
}

class FakeClubRepository implements ClubRepository {
  List<ClubSummary> clubs = <ClubSummary>[testClub];
  ClubDetail detail = testClubDetail;
  List<ClubMember> members = testClubMembers;
  Object? clubsError;
  Object? detailError;
  Object? membersError;
  Future<List<ClubSummary>>? pendingClubs;
  int clubCalls = 0;
  int detailCalls = 0;
  int memberCalls = 0;
  final List<String> detailTeamIds = <String>[];
  final List<String> memberTeamIds = <String>[];
  ClubStatistics statistics = testClubStatistics;
  ClubActivitiesPage activities = testClubActivitiesPage();
  ClubActivityDetail activityDetail = testClubActivityDetail;
  Object? statisticsError;
  Object? activitiesError;
  Object? activityError;
  int statisticsCalls = 0;
  int activityCalls = 0;
  final List<int> requestedActivityPages = <int>[];
  final Map<int, ClubActivitiesPage> activityPages =
      <int, ClubActivitiesPage>{};
  final Map<int, Object> activityPageErrors = <int, Object>{};

  @override
  Future<ClubActivitiesPage> fetchClubActivities({
    required String teamId,
    required int year,
    required ClubRecordFilter filter,
    required int page,
    required int limit,
  }) async {
    requestedActivityPages.add(page);
    if (activityPageErrors[page] case final Object error) throw error;
    if (activitiesError case final Object error) throw error;
    return activityPages[page] ?? activities;
  }

  @override
  Future<ClubActivityDetail> fetchClubActivity({
    required String teamId,
    required String activityId,
  }) async {
    activityCalls += 1;
    if (activityError case final Object error) throw error;
    return activityDetail;
  }

  @override
  Future<ClubStatistics> fetchClubStatistics({
    required String teamId,
    required int year,
    required ClubRecordFilter filter,
  }) async {
    statisticsCalls += 1;
    if (statisticsError case final Object error) throw error;
    return statistics;
  }

  @override
  Future<List<ClubSummary>> fetchClubs() async {
    clubCalls += 1;
    if (pendingClubs case final Future<List<ClubSummary>> pending) {
      return pending;
    }
    if (clubsError case final Object error) throw error;
    return clubs;
  }

  @override
  Future<ClubDetail> fetchClubDetail(String teamId) async {
    detailCalls += 1;
    detailTeamIds.add(teamId);
    if (detailError case final Object error) throw error;
    return detail;
  }

  @override
  Future<List<ClubMember>> fetchClubMembers(String teamId) async {
    memberCalls += 1;
    memberTeamIds.add(teamId);
    if (membersError case final Object error) throw error;
    return members;
  }
}

Completer<List<ClubSummary>> pendingClubList() =>
    Completer<List<ClubSummary>>();
