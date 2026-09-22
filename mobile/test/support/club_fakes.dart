import 'dart:async';

import 'package:bowlingmanager_mobile/features/club/data/club_api.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_repository.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';

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

class FakeClubApi implements ClubApi {
  List<ClubSummary> clubs = <ClubSummary>[testClub];
  ClubDetail detail = testClubDetail;
  List<ClubMember> members = testClubMembers;
  Object? error;

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
