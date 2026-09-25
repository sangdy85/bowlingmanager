import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_team_competition_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_team_competition_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'team result distinguishes effective pins, handicap, and applied score',
    (WidgetTester tester) async {
      final state = ClubTeamCompetitionState.fromJson(<String, dynamic>{
        'generation': 1,
        'status': 'TEAMS_FINALIZED',
        'canManage': false,
        'isCurrentCaptain': false,
        'currentTurn': null,
        'teams': <Object>[
          <String, Object?>{
            'id': 'team-a',
            'name': 'TEAM 1',
            'draftOrder': 1,
            'lanePriority': null,
            'teamHandicap': 10,
            'captainMemberId': 'member-1',
            'captainName': '팀장',
            'members': <Object>[],
          },
        ],
        'remainingParticipants': <Object>[],
        'history': <Object>[],
        'myTeam': null,
        'results': <String, Object>{
          'complete': true,
          'requiresPinTieBreakPolicy': false,
          'effectivePlayerCount': 4,
          'individual': <Object>[],
          'games': <Object>[
            <String, Object>{
              'gameNumber': 1,
              'complete': true,
              'teams': <Object>[
                <String, Object?>{
                  'teamId': 'team-a',
                  'teamName': 'TEAM 1',
                  'complete': true,
                  'rawTeamTotal': 750,
                  'excludedScores': <int>[100],
                  'normalizedTeamTotal': 650,
                  'teamHandicap': 10,
                  'handicapAppliedTotal': 660,
                  'rank': 1,
                  'points': 5,
                },
              ],
            },
          ],
          'teams': <Object>[
            <String, Object>{
              'competitionTeamId': 'team-a',
              'name': 'TEAM 1',
              'finalRank': 1,
              'memberCount': 5,
              'teamHandicap': 10,
              'totalPoints': 5,
              'rawPins': 750,
              'effectivePins': 650,
              'appliedPins': 660,
            },
          ],
        },
      });
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
                  userId: 'user-1',
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

      expect(find.textContaining('Effective 650'), findsWidgets);
      expect(find.textContaining('핸디 10'), findsWidgets);
      expect(find.textContaining('적용 660'), findsWidgets);
      expect(find.textContaining('정책 확정이 필요'), findsNothing);
    },
  );
}
