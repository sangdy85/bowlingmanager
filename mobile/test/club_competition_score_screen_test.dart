import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_event_providers.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_competition_score_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_competition_score_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/auth_fakes.dart';

void main() {
  testWidgets(
    'score screen uses the configured game count without an inline override',
    (tester) async {
      final auth = FakeAuthRepository()..bootstrapResult = testUser;
      const entry = ClubCompetitionScoreEntry(
        eventId: 'event-1',
        teamName: '테스트팀',
        title: '개인전',
        date: '2026-09-27',
        gameType: '정기전',
        competitionType: 'INDIVIDUAL',
        competitionMode: 'OFFICIAL',
        status: 'GROUPS_READY',
        gameCount: 4,
        readOnly: false,
        participants: <ClubCompetitionScoreParticipant>[
          ClubCompetitionScoreParticipant(
            participantId: 'member:m1',
            participantKind: 'MEMBER',
            memberId: 'm1',
            guestId: null,
            name: '회원1',
            group: 'A',
            competitionTeamName: null,
            scores: <int>[],
          ),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authRepositoryProvider.overrideWithValue(auth),
            clubCompetitionScoresProvider.overrideWith(
              (ref, request) async => entry,
            ),
          ],
          child: const MaterialApp(
            home: ClubCompetitionScoreScreen(
              teamId: 'team-1',
              eventId: 'event-1',
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.byKey(const Key('competition-game-count-stepper')),
        findsNothing,
      );
      expect(find.text('4게임'), findsWidgets);
      expect(find.byType(TextFormField), findsNWidgets(4));
      expect(tester.takeException(), isNull);
    },
  );
}
