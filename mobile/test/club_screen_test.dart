import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:bowlingmanager_mobile/app/app.dart';
import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_expansion_api.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_post_image_picker.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_management_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_records_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_post_form_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_post_detail_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_season_ranking_screen.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_team_settings_screen.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/shared/widgets/bottom_navigation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';

import 'support/auth_fakes.dart';
import 'support/club_fakes.dart';
import 'support/dashboard_fakes.dart';

void main() {
  testWidgets(
    'Hidden OFF overview keeps general statistics and season ranking',
    (WidgetTester tester) async {
      final profile = _profileWithHidden(false);
      final ranking = _rankingWithHidden(false);
      await _openClubs(
        tester,
        FakeClubRepository(),
        profile: profile,
        ranking: ranking,
      );
      await tester.tap(find.byKey(const Key('club-team-1')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('club-records-link')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('club-overview')), findsOneWidget);
      expect(find.text('2026 시즌'), findsOneWidget);
      expect(find.textContaining('Bowler Hidden 기능이'), findsNothing);
      expect(find.text('다시 시도'), findsNothing);
    },
  );

  testWidgets('season settings separate general and Hidden controls', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(600, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    Future<void> pumpSettings(bool hidden) async {
      final authRepository = FakeAuthRepository()..bootstrapResult = testUser;
      await tester.pumpWidget(
        ProviderScope(
          key: ValueKey<bool>(hidden),
          overrides: [
            authRepositoryProvider.overrideWithValue(authRepository),
            clubTeamProfileProvider.overrideWith(
              (ref, request) async => _profileWithHidden(hidden),
            ),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: ClubTeamSettingsScreen(
                key: ValueKey<bool>(hidden),
                teamId: 'team-1',
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
    }

    await pumpSettings(false);
    expect(find.byKey(const Key('season-general-points')), findsOneWidget);
    expect(find.byKey(const Key('season-individual-points')), findsNothing);
    expect(find.byKey(const Key('season-team-points')), findsNothing);
    expect(find.byKey(const Key('season-event-points')), findsNothing);

    await pumpSettings(true);
    expect(find.byKey(const Key('season-general-points')), findsNothing);
    expect(find.byKey(const Key('season-individual-points')), findsOneWidget);
    expect(find.byKey(const Key('season-team-points')), findsOneWidget);
    expect(find.byKey(const Key('season-event-points')), findsOneWidget);
  });

  testWidgets('post detail displays all protected attachment images', (
    WidgetTester tester,
  ) async {
    final authRepository = FakeAuthRepository()..bootstrapResult = testUser;
    final bytes = Uint8List.fromList(
      base64Decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      ),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(authRepository),
          clubPostProvider.overrideWith(
            (ref, request) async => ClubPostDetail(
              id: request.postId,
              title: '첨부 게시글',
              content: '본문',
              authorName: '작성자',
              createdAt: DateTime(2026, 9, 23),
              canEdit: false,
              images: const <ClubPostImage>[
                ClubPostImage(id: 'image-1'),
                ClubPostImage(id: 'image-2'),
              ],
            ),
          ),
          clubPostImageProvider.overrideWith((ref, request) async => bytes),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: ClubPostDetailScreen(teamId: 'team-1', postId: 'post-1'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('post-image-image-1')), findsOneWidget);
    expect(find.byKey(const Key('post-image-image-2')), findsOneWidget);
  });

  testWidgets('post image upload failure keeps the unsaved form', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(600, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final authRepository = FakeAuthRepository()..bootstrapResult = testUser;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(authRepository),
          clubExpansionApiProvider.overrideWithValue(_FailingPostUploadApi()),
          clubPostImagePickerProvider.overrideWithValue(_TestPostImagePicker()),
        ],
        child: const MaterialApp(
          home: Scaffold(body: ClubPostFormScreen(teamId: 'team-1')),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(0), '첨부 글');
    await tester.enterText(find.byType(TextField).at(1), '본문');
    await tester.tap(find.byKey(const Key('post-add-images')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('new-post-image-0')), findsOneWidget);

    await tester.tap(find.byKey(const Key('post-save')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('club-post-form')), findsOneWidget);
    expect(find.byKey(const Key('new-post-image-0')), findsOneWidget);
    expect(find.byKey(const Key('post-save-error')), findsOneWidget);
  });

  testWidgets('team settings shows a safe error and retries', (
    WidgetTester tester,
  ) async {
    const ApiException error = ApiException(
      kind: ApiErrorKind.server,
      userMessage: '서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
    );
    final authRepository = FakeAuthRepository()..bootstrapResult = testUser;
    int requests = 0;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(authRepository),
          clubTeamProfileProvider.overrideWith((ref, request) async {
            requests += 1;
            if (requests == 1) throw error;
            return _profile;
          }),
        ],
        child: const MaterialApp(
          home: Scaffold(body: ClubTeamSettingsScreen(teamId: 'team-1')),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text(error.userMessage), findsOneWidget);
    expect(find.textContaining("Instance of 'ApiException'"), findsNothing);
    await tester.tap(find.text('다시 시도'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('club-team-settings')), findsOneWidget);
    expect(requests, 2);
  });

  testWidgets('post edit form shows a safe error and retries', (
    WidgetTester tester,
  ) async {
    const ApiException error = ApiException(
      kind: ApiErrorKind.networkUnavailable,
      userMessage: '네트워크 연결을 확인해주세요.',
    );
    final authRepository = FakeAuthRepository()..bootstrapResult = testUser;
    int requests = 0;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(authRepository),
          clubPostProvider.overrideWith((ref, request) async {
            requests += 1;
            if (requests == 1) throw error;
            return ClubPostDetail(
              id: request.postId,
              title: '제목',
              content: '본문',
              authorName: '작성자',
              createdAt: DateTime(2026, 9, 23),
              images: const <ClubPostImage>[],
              canEdit: true,
            );
          }),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: ClubPostFormScreen(teamId: 'team-1', postId: 'post-1'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text(error.userMessage), findsOneWidget);
    expect(find.textContaining("Instance of 'ApiException'"), findsNothing);
    await tester.tap(find.text('다시 시도'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('club-post-form')), findsOneWidget);
    expect(requests, 2);
  });

  testWidgets('season ranking shows fixed summary, filters and member ledger', (
    WidgetTester tester,
  ) async {
    final authRepository = FakeAuthRepository()..bootstrapResult = testUser;
    await tester.binding.setSurfaceSize(const Size(360, 720));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(authRepository),
          clubSeasonRankingProvider.overrideWith(
            (ref, request) async => _ranking,
          ),
          clubSeasonMemberProvider.overrideWith(
            (ref, request) async => _ranking.rows.single,
          ),
        ],
        child: const MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(textScaler: TextScaler.linear(1.2)),
            child: ClubSeasonRankingScreen(teamId: 'team-1'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('시즌 종합순위'), findsOneWidget);
    expect(find.byKey(const Key('season-finals-link')), findsOneWidget);
    expect(find.byKey(const Key('hidden-competition-filter')), findsOneWidget);
    expect(find.text('개인전'), findsOneWidget);
    expect(find.text('팀장'), findsOneWidget);
    expect(find.text('5P'), findsOneWidget);

    await tester.tap(find.text('팀장'));
    await tester.pumpAndSettle();
    expect(find.text('5P · 1경기'), findsOneWidget);
    expect(find.text('1월 개인전'), findsOneWidget);
  });

  testWidgets('general season ranking hides Hidden filters and finals', (
    WidgetTester tester,
  ) async {
    final authRepository = FakeAuthRepository()..bootstrapResult = testUser;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(authRepository),
          clubSeasonRankingProvider.overrideWith(
            (ref, request) async => _rankingWithHidden(false),
          ),
        ],
        child: const MaterialApp(
          home: ClubSeasonRankingScreen(teamId: 'team-1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('시즌 순위'), findsOneWidget);
    expect(find.byKey(const Key('season-finals-link')), findsNothing);
    expect(find.byKey(const Key('hidden-competition-filter')), findsNothing);
  });

  testWidgets('Club shows an empty state', (WidgetTester tester) async {
    final FakeClubRepository repository = FakeClubRepository()
      ..clubs = const <ClubSummary>[];
    await _openClubs(tester, repository);

    expect(find.text('가입한 동호회가 없습니다.'), findsOneWidget);
  });

  testWidgets('Club shows one or multiple real club cards', (
    WidgetTester tester,
  ) async {
    final FakeClubRepository repository = FakeClubRepository()
      ..clubs = const <ClubSummary>[testClub, secondClub];
    await _openClubs(tester, repository);

    expect(find.text('테스트 동호회'), findsOneWidget);
    expect(find.text('두 번째 동호회'), findsOneWidget);
    expect(find.text('팀장 · 회원 3명'), findsOneWidget);
    expect(find.text('회원 · 회원 8명'), findsOneWidget);
  });

  testWidgets('Club displays loading while the list is pending', (
    WidgetTester tester,
  ) async {
    final pending = pendingClubList();
    final FakeClubRepository repository = FakeClubRepository()
      ..pendingClubs = pending.future;
    await _openClubs(tester, repository, settleClubs: false);

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    pending.complete(const <ClubSummary>[testClub]);
    await tester.pumpAndSettle();
    expect(find.text('테스트 동호회'), findsOneWidget);
  });

  testWidgets('Club retries an initial API error', (WidgetTester tester) async {
    const ApiException error = ApiException(
      kind: ApiErrorKind.networkUnavailable,
      userMessage: '네트워크 연결을 확인해주세요.',
    );
    final FakeClubRepository repository = FakeClubRepository()
      ..clubsError = error;
    await _openClubs(tester, repository);

    expect(find.text(error.userMessage), findsOneWidget);
    repository.clubsError = null;
    await tester.tap(find.text('다시 시도'));
    await tester.pumpAndSettle();
    expect(find.text('테스트 동호회'), findsOneWidget);
    expect(repository.clubCalls, 2);
  });

  testWidgets('Club opens detail and the complete member list', (
    WidgetTester tester,
  ) async {
    final FakeClubRepository repository = FakeClubRepository();
    await _openClubs(tester, repository);

    await tester.tap(find.byKey(const Key('club-team-1')));
    await tester.pumpAndSettle();
    expect(find.text('동호회 상세'), findsOneWidget);
    expect(find.text('팀장'), findsWidgets);
    expect(find.text('3명'), findsOneWidget);

    await tester.tap(find.byKey(const Key('club-members-link')));
    await tester.pumpAndSettle();
    expect(find.text('동호회 회원'), findsOneWidget);
    expect(find.text('매니저'), findsWidgets);
    expect(find.text('회원'), findsWidgets);
    expect(find.text('핸디캡 10'), findsOneWidget);
    expect(find.byKey(const Key('member-role-member-2')), findsNothing);
    expect(find.byKey(const Key('member-remove-member-3')), findsNothing);
    expect(repository.detailTeamIds, <String>['team-1']);
    expect(repository.memberTeamIds, <String>['team-1']);
  });

  testWidgets('Club detail menu cards keep equal heights at mobile scale', (
    WidgetTester tester,
  ) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.2;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final FakeClubRepository repository = FakeClubRepository()
      ..detail = const ClubDetail(
        id: 'team-1',
        name: '테스트 동호회',
        myRole: ClubRole.owner,
        memberCount: 3,
      );
    await _openClubs(tester, repository, surfaceSize: const Size(360, 720));
    await tester.tap(find.byKey(const Key('club-team-1')));
    await tester.pumpAndSettle();

    final List<Key> menuKeys = <Key>[
      const Key('club-records-link'),
      const Key('club-events-link'),
      const Key('club-members-link'),
      const Key('club-board-link'),
      const Key('club-management-link'),
    ];
    final Set<double> heights = <double>{};
    for (final Key key in menuKeys) {
      await tester.scrollUntilVisible(
        find.byKey(key),
        120,
        scrollable: find.byType(Scrollable).first,
      );
      heights.add(tester.getSize(find.byKey(key)).height);
    }
    expect(heights, <double>{88});
    expect(tester.takeException(), isNull);
  });

  testWidgets('Club overview and member detail fit a 360px screen', (
    WidgetTester tester,
  ) async {
    final FakeClubRepository repository = FakeClubRepository();
    await _openClubs(tester, repository, surfaceSize: const Size(360, 720));
    await tester.tap(find.byKey(const Key('club-team-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('club-records-link')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('club-overview')), findsOneWidget);
    expect(find.text('2026 시즌'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.tap(find.byIcon(Icons.arrow_back_rounded).first);
    await tester.pumpAndSettle();
    if (find.byKey(const Key('club-team-1')).evaluate().isNotEmpty) {
      await tester.tap(find.byKey(const Key('club-team-1')));
      await tester.pumpAndSettle();
    }
    await tester.drag(find.byType(ListView).first, const Offset(0, -500));
    await tester.pump();
    await tester.tap(find.byKey(const Key('club-members-link')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('club-member-member-1')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('club-member-detail')), findsOneWidget);
    expect(find.text('활동 시작일 2026.01.02'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Club pull-to-refresh reloads the current user list', (
    WidgetTester tester,
  ) async {
    final FakeClubRepository repository = FakeClubRepository();
    await _openClubs(tester, repository);

    await tester.drag(find.byKey(const Key('club-list')), const Offset(0, 400));
    await tester.pumpAndSettle();
    expect(repository.clubCalls, 2);
  });

  testWidgets('management entry follows OWNER MANAGER and MEMBER roles', (
    WidgetTester tester,
  ) async {
    for (final ClubRole role in ClubRole.values) {
      final FakeClubRepository repository = FakeClubRepository()
        ..detail = ClubDetail(
          id: 'team-1',
          name: '테스트 동호회',
          myRole: role,
          memberCount: 3,
        );
      await _openClubs(tester, repository);
      await tester.tap(find.byKey(const Key('club-team-1')));
      await tester.pumpAndSettle();
      expect(
        find.byKey(const Key('club-management-link')),
        role == ClubRole.member ? findsNothing : findsOneWidget,
      );
      await tester.pumpWidget(const SizedBox());
    }
  });

  testWidgets('OWNER directly enters variable scores and prevents empty save', (
    WidgetTester tester,
  ) async {
    final FakeClubRepository repository = FakeClubRepository();
    await _openClubs(tester, repository);
    await tester.tap(find.byKey(const Key('club-team-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('club-management-link')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('club-management')), findsOneWidget);
    await tester.tap(find.byKey(const Key('management-manual-link')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('management-save')));
    await tester.pump();
    expect(find.text('참가자를 한 명 이상 추가해주세요.'), findsOneWidget);

    await tester.tap(find.byKey(const Key('management-add-participant')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('회원').last);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('participant-0-score-0')),
      '301',
    );
    await tester.tap(find.byKey(const Key('management-save')));
    await tester.pump();
    expect(find.text('모든 점수는 0에서 300 사이의 정수여야 합니다.'), findsOneWidget);
    expect(repository.createCalls, 0);
    await tester.enterText(
      find.byKey(const Key('participant-0-score-0')),
      '200',
    );
    await tester.tap(find.byKey(const Key('participant-add-game-0')));
    await tester.pump();
    await tester.enterText(
      find.byKey(const Key('participant-0-score-1')),
      '300',
    );
    await tester.tap(find.byKey(const Key('management-save')));
    await tester.pumpAndSettle();
    expect(repository.createCalls, 1);
  });

  testWidgets('activity admin actions edit and confirm deletion', (
    WidgetTester tester,
  ) async {
    final FakeClubRepository repository = FakeClubRepository();
    await _openClubs(tester, repository);
    await tester.tap(find.byKey(const Key('club-team-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('club-records-link')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('상세 기록'));
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(Key('club-activity-menu-${testClubActivity.id}')),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('삭제').last);
    await tester.pumpAndSettle();
    expect(find.textContaining('1개의 점수가 삭제됩니다.'), findsOneWidget);
    await tester.tap(find.byKey(const Key('activity-feed-delete-confirm')));
    await tester.pumpAndSettle();
    expect(repository.deleteCalls, 1);
  });

  testWidgets('manual save disables repeat taps while request is pending', (
    WidgetTester tester,
  ) async {
    final pending = Completer<ClubWriteResult>();
    final FakeClubRepository repository = FakeClubRepository()
      ..pendingCreate = pending;
    await _openClubs(tester, repository);
    await tester.tap(find.byKey(const Key('club-team-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('club-management-link')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('management-manual-link')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('management-add-participant')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('회원').last);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('participant-0-score-0')),
      '200',
    );
    await tester.tap(find.byKey(const Key('management-save')));
    await tester.pump();
    expect(repository.createCalls, 1);
    expect(
      tester
          .widget<FilledButton>(find.byKey(const Key('management-save')))
          .onPressed,
      isNull,
    );
    pending.complete(const ClubWriteResult(changedCount: 1));
    await tester.pumpAndSettle();
    expect(repository.createCalls, 1);
  });

  testWidgets('manual save keeps the form and shows a safe API error', (
    WidgetTester tester,
  ) async {
    const error = ApiException(
      kind: ApiErrorKind.server,
      userMessage: '점수를 저장하지 못했습니다.',
    );
    final FakeClubRepository repository = FakeClubRepository()
      ..managementError = error;
    await _openClubs(tester, repository);
    await tester.tap(find.byKey(const Key('club-team-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('club-management-link')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('management-manual-link')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('management-add-participant')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('회원').last);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('participant-0-score-0')),
      '200',
    );
    await tester.tap(find.byKey(const Key('management-save')));
    await tester.pumpAndSettle();
    expect(find.text(error.userMessage), findsOneWidget);
    expect(find.byKey(const Key('club-manual-score')), findsOneWidget);
  });

  testWidgets('activity edit updates variable participant scores', (
    WidgetTester tester,
  ) async {
    final FakeClubRepository repository = FakeClubRepository();
    await _openClubs(tester, repository);
    await tester.tap(find.byKey(const Key('club-team-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('club-records-link')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('상세 기록'));
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(Key('club-activity-menu-${testClubActivity.id}')),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('수정').last);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('club-activity-edit')), findsOneWidget);
    await tester.enterText(
      find.byKey(const Key('participant-0-score-0')),
      '250',
    );
    await tester.tap(find.byKey(const Key('management-save')));
    await tester.pumpAndSettle();
    expect(repository.updateCalls, 1);
  });

  testWidgets('member management keeps owner and manager protections in UI', (
    WidgetTester tester,
  ) async {
    final FakeClubRepository repository = FakeClubRepository();
    await _openClubs(tester, repository);
    await tester.tap(find.byKey(const Key('club-team-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('club-management-link')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('management-members-link')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('member-remove-member-1')), findsNothing);
    expect(find.byKey(const Key('member-role-member-2')), findsOneWidget);
    expect(find.byKey(const Key('member-remove-member-3')), findsOneWidget);
  });

  testWidgets('MANAGER can remove only MEMBER and cannot change roles', (
    WidgetTester tester,
  ) async {
    final FakeClubRepository repository = FakeClubRepository()
      ..detail = const ClubDetail(
        id: 'team-1',
        name: '테스트 동호회',
        myRole: ClubRole.manager,
        memberCount: 3,
      );
    await _openClubs(tester, repository);
    await tester.tap(find.byKey(const Key('club-team-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('club-management-link')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('management-members-link')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('member-role-member-3')), findsNothing);
    expect(find.byKey(const Key('member-remove-member-1')), findsNothing);
    expect(find.byKey(const Key('member-remove-member-2')), findsNothing);
    expect(find.byKey(const Key('member-remove-member-3')), findsOneWidget);
  });

  testWidgets(
    'Club records shows statistics, multi filters and inline results',
    (WidgetTester tester) async {
      final FakeClubRepository repository = FakeClubRepository();
      await _openClubs(tester, repository);

      await tester.tap(find.byKey(const Key('club-team-1')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('club-records-link')));
      await tester.pumpAndSettle();

      expect(find.text('나의 대회 성적'), findsOneWidget);
      expect(find.text('2월 팀전'), findsOneWidget);
      expect(find.text('불참'), findsOneWidget);
      await tester.tap(find.text('종합 기록'));
      await tester.pumpAndSettle();

      expect(find.text('동호회 기록'), findsOneWidget);
      expect(find.text('100.0% (2/2)'), findsOneWidget);
      expect(find.text('1월'), findsOneWidget);
      expect(find.text('9월'), findsOneWidget);
      expect(find.text('210'), findsWidgets);
      expect(find.textContaining('ACE'), findsNothing);
      expect(
        find.byKey(const Key('club-statistics-scroll-hint')),
        findsOneWidget,
      );

      await tester.tap(find.byKey(const Key('club-records-year')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('2025년').last);
      await tester.pumpAndSettle();
      expect(repository.statisticsCalls, 2);

      await tester.tap(find.text('전체'));
      await tester.pumpAndSettle();
      expect(repository.statisticsCalls, 3);

      await tester.tap(find.text('정기전'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('club-records-year')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('2026년').last);
      await tester.pumpAndSettle();

      await tester.tap(find.text('상세 기록'));
      await tester.pumpAndSettle();
      expect(
        find.byKey(const Key('club-activity-filter-scroll-hint')),
        findsOneWidget,
      );
      expect(
        find.byKey(Key('club-activity-${testClubActivity.id}')),
        findsOneWidget,
      );
      expect(find.text('1G'), findsOneWidget);
      expect(find.text('2G'), findsOneWidget);
      expect(find.text('3G'), findsOneWidget);
      expect(find.text('630'), findsOneWidget);
      expect(find.text('210.0'), findsOneWidget);
      expect(find.text('경기 상세'), findsNothing);

      await tester.tap(find.byKey(const Key('club-activity-filter-CASUAL')));
      await tester.pumpAndSettle();
      expect(repository.requestedActivityFeedPages.length, 2);
    },
  );

  testWidgets('Club records handles an empty statistics result', (
    WidgetTester tester,
  ) async {
    final FakeClubRepository repository = FakeClubRepository()
      ..statistics = ClubStatistics(
        year: 2026,
        filter: ClubRecordFilter.regular,
        availableYears: const <int>[2026],
        summary: const ClubStatisticsSummary(
          activityCount: 0,
          memberCount: 0,
          attendanceRate: 0,
          gameCount: 0,
          monthlyAverages: <int?>[
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
          ],
          total: 0,
          average: 0,
        ),
        members: const <ClubMemberStatistics>[],
      );
    await _openClubs(tester, repository);
    await tester.tap(find.byKey(const Key('club-team-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('club-records-link')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('종합 기록'));
    await tester.pumpAndSettle();

    expect(find.text('선택한 조건의 팀원 기록이 없습니다.'), findsOneWidget);
    expect(find.text('0회'), findsNothing);
  });

  testWidgets(
    'activity filters support empty selection and member feed has no menu',
    (WidgetTester tester) async {
      final ClubActivityFeedItem second = ClubActivityFeedItem(
        id: '2026-09-18~CASUAL',
        date: DateTime(2026, 9, 18),
        gameType: '벙개',
        participantCount: 1,
        gameCount: 1,
        dailyAverage: 200,
        participants: const <ClubActivityParticipant>[
          ClubActivityParticipant(
            rank: 1,
            id: 'member-2',
            name: '회원',
            scores: <int>[200],
            total: 200,
            average: 200,
          ),
        ],
        canManage: false,
      );
      final FakeClubRepository repository = FakeClubRepository()
        ..activityFeed = ClubActivityFeedPage(
          year: 2026,
          types: const <ClubRecordFilter>[
            ClubRecordFilter.regular,
            ClubRecordFilter.casual,
            ClubRecordFilter.house,
          ],
          currentMemberId: 'member-2',
          items: <ClubActivityFeedItem>[
            ClubActivityFeedItem(
              id: testClubActivityFeedItem.id,
              date: testClubActivityFeedItem.date,
              gameType: testClubActivityFeedItem.gameType,
              participantCount: testClubActivityFeedItem.participantCount,
              gameCount: testClubActivityFeedItem.gameCount,
              dailyAverage: testClubActivityFeedItem.dailyAverage,
              participants: testClubActivityFeedItem.participants,
              canManage: false,
            ),
            second,
          ],
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        );
      await _openClubs(tester, repository, surfaceSize: const Size(360, 720));
      await tester.tap(find.byKey(const Key('club-team-1')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('club-records-link')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('상세 기록'));
      await tester.pumpAndSettle();

      expect(find.byKey(Key('club-activity-${second.id}')), findsOneWidget);
      expect(find.byKey(Key('club-activity-menu-${second.id}')), findsNothing);

      await tester.tap(find.byKey(const Key('club-activity-filter-REGULAR')));
      await tester.pumpAndSettle();
      expect(find.text('경기 방식을 하나 이상 선택해주세요.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Club records retries a statistics error', (
    WidgetTester tester,
  ) async {
    const ApiException error = ApiException(
      kind: ApiErrorKind.networkUnavailable,
      userMessage: '네트워크 연결을 확인해주세요.',
    );
    final FakeClubRepository repository = FakeClubRepository()
      ..statisticsError = error;
    await _openClubs(tester, repository);
    await tester.tap(find.byKey(const Key('club-team-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('club-records-link')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('종합 기록'));
    await tester.pumpAndSettle();
    expect(find.text(error.userMessage), findsOneWidget);

    repository.statisticsError = null;
    await tester.tap(find.text('다시 시도'));
    await tester.pumpAndSettle();
    expect(find.text('100.0% (2/2)'), findsOneWidget);
  });

  testWidgets('Club records avoids overflow with long names and many scores', (
    WidgetTester tester,
  ) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.2;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    const String longName = '아주 긴 이름을 사용하는 동호회 회원 테스트 볼러';
    final List<ClubMemberStatistics> members =
        List<ClubMemberStatistics>.generate(
          23,
          (int index) => ClubMemberStatistics(
            id: 'member-$index',
            name: index == 0 ? longName : '회원 $index',
            attendanceRate: 100,
            attended: 12,
            activityCount: 12,
            gameCount: 48,
            monthlyAverages: const <int?>[
              200,
              201,
              202,
              203,
              204,
              205,
              206,
              207,
              208,
              209,
              210,
              211,
            ],
            total: 9840,
            average: 205,
          ),
        );
    final FakeClubRepository repository = FakeClubRepository()
      ..statistics = ClubStatistics(
        year: 2026,
        filter: ClubRecordFilter.regular,
        availableYears: const <int>[2026],
        summary: ClubStatisticsSummary(
          activityCount: 12,
          memberCount: members.length,
          attendanceRate: 100,
          gameCount: 1104,
          monthlyAverages: const <int?>[
            200,
            201,
            202,
            203,
            204,
            205,
            206,
            207,
            208,
            209,
            210,
            211,
          ],
          total: 226320,
          average: 205,
        ),
        members: members,
      )
      ..activityFeed = ClubActivityFeedPage(
        year: 2026,
        types: const <ClubRecordFilter>[
          ClubRecordFilter.regular,
          ClubRecordFilter.casual,
          ClubRecordFilter.house,
        ],
        currentMemberId: 'member-0',
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        items: <ClubActivityFeedItem>[
          ClubActivityFeedItem(
            id: testClubActivity.id,
            date: testClubActivity.date,
            gameType: testClubActivity.gameType,
            participantCount: 23,
            gameCount: 276,
            dailyAverage: 205,
            participants: List<ClubActivityParticipant>.generate(
              23,
              (int index) => ClubActivityParticipant(
                rank: index + 1,
                id: 'member-$index',
                name: index == 0 ? longName : '회원 $index',
                scores: index == 0
                    ? List<int>.generate(12, (int game) => 200 + game)
                    : const <int>[200, 201, 202, 203],
                total: index == 0 ? 2466 : 806,
                average: index == 0 ? 205.5 : 201.5,
              ),
            ),
            canManage: true,
          ),
        ],
      );

    await _openClubs(tester, repository, surfaceSize: const Size(360, 720));
    await tester.tap(find.byKey(const Key('club-team-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('club-records-link')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('종합 기록'));
    await tester.pumpAndSettle();
    expect(find.text(longName), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('상세 기록'));
    await tester.pumpAndSettle();
    expect(find.byTooltip(longName), findsOneWidget);
    expect(find.text('4G'), findsOneWidget);
    expect(find.text('12G'), findsOneWidget);
    expect(find.text('2,466'), findsOneWidget);
    expect(find.text('205.5'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('AVG').last).dx,
      lessThan(tester.getTopLeft(find.text('5G')).dx),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('nested club and capture routes keep their bottom tab selected', (
    WidgetTester tester,
  ) async {
    Future<void> expectSelected(String path, String label) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            bottomNavigationBar: AppBottomNavigation(
              currentPath: path,
              onSelected: (_) {},
            ),
          ),
        ),
      );
      final Semantics semantics = tester.widget<Semantics>(
        find.byWidgetPredicate(
          (Widget widget) =>
              widget is Semantics && widget.properties.label == label,
        ),
      );
      expect(semantics.properties.selected, isTrue);
    }

    await expectSelected('/club/team-1', '동호회');
    await expectSelected('/club/team-1/members', '동호회');
    await expectSelected('/capture/review', '촬영');
  });
}

Future<void> _openClubs(
  WidgetTester tester,
  FakeClubRepository clubRepository, {
  bool settleClubs = true,
  Size surfaceSize = const Size(600, 1200),
  ClubTeamProfile? profile,
  ClubSeasonRanking? ranking,
}) async {
  await tester.binding.setSurfaceSize(surfaceSize);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  final FakeAuthRepository authRepository = FakeAuthRepository()
    ..bootstrapResult = testUser;
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(authRepository),
        dashboardRepositoryProvider.overrideWithValue(
          FakeDashboardRepository(),
        ),
        clubRepositoryProvider.overrideWithValue(clubRepository),
        clubTeamProfileProvider.overrideWith(
          (ref, request) async => profile ?? _profile,
        ),
        clubSeasonRankingProvider.overrideWith(
          (ref, request) async => ranking ?? _ranking,
        ),
        clubMemberProfileProvider.overrideWith(
          (ref, request) async => _memberProfile,
        ),
      ],
      child: const BowlingManagerApp(),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('동호회'));
  if (settleClubs) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
}

final ClubSeason _season = ClubSeason(
  id: 'season-1',
  name: '2026 시즌',
  startDate: DateTime(2026),
  endDate: DateTime(2026, 12, 31),
  scoringMode: 'PODIUM',
  points: const <int>[5, 3, 1],
  individualPoints: const <ClubSeasonRankPoint>[
    ClubSeasonRankPoint(rank: 1, points: 5),
  ],
  teamPoints: const <ClubSeasonRankPoint>[
    ClubSeasonRankPoint(rank: 1, points: 3),
  ],
  eventPoints: const <ClubSeasonRankPoint>[
    ClubSeasonRankPoint(rank: 1, points: 5),
  ],
);

final ClubTeamProfile _profile = ClubTeamProfile(
  id: 'team-1',
  name: '테스트 동호회',
  description: '함께 즐기는 동호회입니다.',
  notice: '9월 정기전 안내',
  myRole: ClubRole.owner,
  seasonRankingEnabled: true,
  bowlerHiddenEnabled: true,
  activeSeason: _season,
);

final ClubSeasonRanking _ranking = ClubSeasonRanking(
  enabled: true,
  bowlerHiddenEnabled: true,
  season: _season,
  seasons: <ClubSeason>[_season],
  competitionType: 'ALL',
  myCompetitionHistory: <ClubSeasonPointEntry>[
    ClubSeasonPointEntry(
      id: 'entry-1',
      eventId: 'event-1',
      competitionType: 'INDIVIDUAL',
      competitionDate: DateTime(2026, 1, 10),
      competitionTitle: '1월 개인전',
      finalRank: 1,
      points: 5,
      month: 1,
    ),
    ClubSeasonPointEntry(
      id: 'absent:event-2',
      eventId: 'event-2',
      competitionType: 'TEAM',
      competitionDate: DateTime(2026, 2, 10),
      competitionTitle: '2월 팀전',
      finalRank: null,
      points: 0,
      month: 2,
      participationStatus: 'ABSENT',
    ),
  ],
  rows: <ClubSeasonRankingRow>[
    ClubSeasonRankingRow(
      rank: 1,
      id: 'member-1',
      name: '팀장',
      points: 5,
      attended: 1,
      games: 3,
      average: 210,
      gold: 1,
      silver: 0,
      bronze: 0,
      individualPoints: 5,
      competitionsPlayed: 1,
      individualWins: 1,
      entries: <ClubSeasonPointEntry>[
        ClubSeasonPointEntry(
          id: 'entry-1',
          eventId: null,
          competitionType: 'INDIVIDUAL',
          competitionDate: DateTime(2026, 1, 10),
          competitionTitle: '1월 개인전',
          finalRank: 1,
          points: 5,
          month: 1,
        ),
      ],
      monthlyHistory: <List<ClubSeasonPointEntry>>[
        <ClubSeasonPointEntry>[
          ClubSeasonPointEntry(
            id: 'entry-1',
            eventId: null,
            competitionType: 'INDIVIDUAL',
            competitionDate: DateTime(2026, 1, 10),
            competitionTitle: '1월 개인전',
            finalRank: 1,
            points: 5,
            month: 1,
          ),
        ],
        <ClubSeasonPointEntry>[],
        <ClubSeasonPointEntry>[],
        <ClubSeasonPointEntry>[],
        <ClubSeasonPointEntry>[],
        <ClubSeasonPointEntry>[],
        <ClubSeasonPointEntry>[],
        <ClubSeasonPointEntry>[],
        <ClubSeasonPointEntry>[],
        <ClubSeasonPointEntry>[],
        <ClubSeasonPointEntry>[],
        <ClubSeasonPointEntry>[],
      ],
    ),
  ],
);

ClubTeamProfile _profileWithHidden(bool enabled) => ClubTeamProfile(
  id: _profile.id,
  name: _profile.name,
  description: _profile.description,
  notice: _profile.notice,
  myRole: _profile.myRole,
  seasonRankingEnabled: true,
  bowlerHiddenEnabled: enabled,
  activeSeason: _season,
);

ClubSeasonRanking _rankingWithHidden(bool enabled) => ClubSeasonRanking(
  enabled: true,
  bowlerHiddenEnabled: enabled,
  season: _season,
  seasons: <ClubSeason>[_season],
  competitionType: 'ALL',
  rows: _ranking.rows,
);

final ClubMemberProfile _memberProfile = ClubMemberProfile(
  id: 'member-1',
  name: '팀장',
  alias: null,
  role: ClubRole.owner,
  handicap: 10,
  joinedAt: DateTime(2025),
  activityStartDate: DateTime(2026, 1, 2),
  year: 2026,
  attendanceRate: 100,
  attended: 1,
  activityCount: 1,
  gameCount: 3,
  total: 630,
  average: 210,
  monthlyAverages: const <int?>[
    210,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ],
  gold: 1,
  silver: 0,
  bronze: 0,
  recentScores: <ClubRecentRegularScore>[
    ClubRecentRegularScore(
      id: 'score-1',
      date: DateTime(2026, 1, 2),
      score: 210,
    ),
  ],
);

class _TestPostImagePicker implements ClubPostImagePicker {
  @override
  Future<List<CaptureImageData>> pickImages() async => <CaptureImageData>[
    CaptureImageData(
      bytes: Uint8List.fromList(
        base64Decode(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        ),
      ),
      fileName: 'score.png',
      mimeType: 'image/png',
    ),
  ];
}

class _FailingPostUploadApi extends ClubExpansionApi {
  _FailingPostUploadApi() : super(Dio());

  @override
  Future<String> savePost(
    String teamId, {
    String? postId,
    required String title,
    required String content,
    List<ClubPostImage> existingImages = const <ClubPostImage>[],
    List<CaptureImageData> newImages = const <CaptureImageData>[],
  }) async {
    throw const ApiException(
      kind: ApiErrorKind.badRequest,
      code: 'INVALID_IMAGE_TYPE',
      userMessage: '이미지를 업로드하지 못했습니다.',
    );
  }
}
