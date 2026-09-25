import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_competition_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_team_competition_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_event_competition_card.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_event_detail_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_team_competition_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'guest dialog closes before parent refresh without lifecycle assertion',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(home: _DialogHarness(guest: true)),
      );
      await tester.tap(find.text('열기'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '게스트A');
      await tester.tap(find.text('추가'));
      await tester.pumpAndSettle();
      expect(find.text('게스트A'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'manual group dialog closes before parent refresh without lifecycle assertion',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(home: _DialogHarness(guest: false)),
      );
      await tester.tap(find.text('열기'));
      await tester.pumpAndSettle();
      expect(find.text('A조'), findsOneWidget);
      expect(find.text('E조'), findsOneWidget);
      await tester.tap(find.text('C조'));
      await tester.pumpAndSettle();
      expect(find.text('C'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('TEAM lucky draw shows guest and manager auto remainder action', (
    tester,
  ) async {
    final state = ClubTeamCompetitionState.fromJson(_teamState());
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          clubTeamCompetitionProvider.overrideWith(
            (ref, request) async => state,
          ),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ClubTeamCompetitionCard(
                userId: 'captain-user',
                teamId: 'team-1',
                eventId: 'event-1',
                competitionMode: ClubCompetitionMode.official,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('게스트A'), findsWidgets);
    expect(find.text('행운권 뽑기'), findsOneWidget);
    expect(find.text('남은 인원 자동 배정'), findsOneWidget);
    expect(find.textContaining('행운권 당첨 → 게스트B'), findsNothing);
    await tester.tap(find.text('드래프트 기록'));
    await tester.pumpAndSettle();
    expect(find.textContaining('행운권 당첨 → 게스트B'), findsOneWidget);
  });

  testWidgets(
    'EVENT open voting exposes guest candidate and manager proxy form',
    (tester) async {
      final state = ClubEventCompetitionState.fromJson(_eventState());
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            clubEventCompetitionProvider.overrideWith(
              (ref, request) async => state,
            ),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: ClubEventCompetitionCard(
                  userId: 'owner',
                  teamId: 'team-1',
                  eventId: 'event-1',
                  competitionMode: ClubCompetitionMode.official,
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('게스트A'), findsWidgets);
      expect(find.text('투표 완료 (0 / 3)'), findsOneWidget);
      expect(find.text('대리 투표'), findsOneWidget);
      await tester.tap(find.text('대리 투표'));
      await tester.pumpAndSettle();
      expect(find.text('누구의 투표를 입력하시겠습니까?'), findsOneWidget);
      expect(find.text('게스트 · 게스트A'), findsOneWidget);
      await tester.tap(find.text('게스트 · 게스트A'));
      await tester.pumpAndSettle();
      expect(find.text('게스트A 대리 투표'), findsOneWidget);
      expect(find.text('대리 투표 완료'), findsOneWidget);
    },
  );

  testWidgets('EVENT member cannot see manager proxy voting action', (
    tester,
  ) async {
    final state = ClubEventCompetitionState.fromJson(
      _eventState()..['canManage'] = false,
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          clubEventCompetitionProvider.overrideWith(
            (ref, request) async => state,
          ),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ClubEventCompetitionCard(
                userId: 'member-user',
                teamId: 'team-1',
                eventId: 'event-1',
                competitionMode: ClubCompetitionMode.official,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('투표 완료 (0 / 3)'), findsOneWidget);
    expect(find.text('대리 투표'), findsNothing);
  });
}

class _DialogHarness extends StatefulWidget {
  const _DialogHarness({required this.guest});
  final bool guest;
  @override
  State<_DialogHarness> createState() => _DialogHarnessState();
}

class _DialogHarnessState extends State<_DialogHarness> {
  String value = '-';
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Column(
      children: [
        Text(value),
        FilledButton(
          onPressed: () async {
            final result = widget.guest
                ? await showClubGuestDialog(context)
                : await showClubManualGroupDialog(context, '참가자');
            if (mounted && result != null) setState(() => value = result);
          },
          child: const Text('열기'),
        ),
      ],
    ),
  );
}

Map<String, dynamic> _teamState() => <String, dynamic>{
  'generation': 1,
  'status': 'LUCKY_DRAW',
  'canManage': true,
  'isCurrentCaptain': true,
  'currentTurn': <String, Object>{
    'pickNumber': 4,
    'roundNumber': 2,
    'direction': 'REVERSE',
    'competitionTeamId': 'ct-1',
    'captainName': '팀장',
  },
  'teams': <Object>[
    <String, Object?>{
      'id': 'ct-1',
      'name': 'TEAM 1',
      'draftOrder': 1,
      'lanePriority': null,
      'teamHandicap': 0,
      'captainMemberId': 'member-1',
      'captainName': '팀장',
      'members': <Object>[],
    },
  ],
  'remainingParticipants': <Object>[
    <String, Object?>{
      'participantId': 'participant-g1',
      'participantKind': 'GUEST',
      'memberId': null,
      'guestId': 'guest-1',
      'name': '게스트A',
      'assignmentType': null,
      'assignmentOrder': null,
      'laneSlot': null,
    },
  ],
  'history': <Object>[
    <String, Object>{
      'id': 'pick-3',
      'pickNumber': 3,
      'roundNumber': 1,
      'pickType': 'LUCKY_DRAW_WIN',
      'teamName': 'TEAM 1',
      'selectedDisplayName': '게스트B',
    },
  ],
  'myTeam': 'ct-1',
  'results': <String, Object?>{
    'complete': false,
    'requiresPinTieBreakPolicy': false,
    'effectivePlayerCount': null,
    'individual': <Object>[],
    'games': <Object>[],
    'teams': <Object>[],
  },
};

Map<String, dynamic> _eventState() => <String, dynamic>{
  'status': 'VOTING_OPEN',
  'canManage': true,
  'isParticipant': true,
  'myParticipantId': 'p1',
  'voteOpenAt': '2026-09-25T00:00:00.000Z',
  'voteCloseAt': '2099-09-25T00:30:00.000Z',
  'serverNow': '2026-09-25T00:05:00.000Z',
  'gameCount': 1,
  'participants': <Object>[
    <String, Object?>{
      'participantId': 'p1',
      'participantKind': 'MEMBER',
      'memberId': 'm1',
      'guestId': null,
      'name': '팀장',
    },
    <String, Object?>{
      'participantId': 'p2',
      'participantKind': 'MEMBER',
      'memberId': 'm2',
      'guestId': null,
      'name': '회원2',
    },
    <String, Object?>{
      'participantId': 'p3',
      'participantKind': 'MEMBER',
      'memberId': 'm3',
      'guestId': null,
      'name': '회원3',
    },
    <String, Object?>{
      'participantId': 'pg',
      'participantKind': 'GUEST',
      'memberId': null,
      'guestId': 'g1',
      'name': '게스트A',
    },
  ],
  'voting': <String, Object>{
    'submittedCount': 0,
    'pendingCount': 4,
    'mySelections': <String>[],
    'submittedParticipantIds': <String>[],
  },
  'scoreComplete': false,
  'reveal': <String, Object>{'revealedCount': 0, 'totalCount': 4},
  'finalPreview': null,
};
