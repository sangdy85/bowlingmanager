import 'dart:async';

import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_expansion_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_records_state.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_records_models.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_expansion_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_screen.dart';
import 'package:bowlingmanager_mobile/features/home/application/dashboard_providers.dart';
import 'package:bowlingmanager_mobile/features/records/application/records_providers.dart';
import 'package:bowlingmanager_mobile/shared/widgets/bowling_medal.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubRecordsScreen extends ConsumerStatefulWidget {
  const ClubRecordsScreen({
    required this.teamId,
    this.initialSection = 0,
    this.initialYear,
    this.targetActivityId,
    this.targetFilter,
    super.key,
  });

  final String teamId;
  final int initialSection;
  final int? initialYear;
  final String? targetActivityId;
  final ClubRecordFilter? targetFilter;

  @override
  ConsumerState<ClubRecordsScreen> createState() => _ClubRecordsScreenState();
}

class _ClubRecordsScreenState extends ConsumerState<ClubRecordsScreen> {
  late int _year;
  ClubRecordFilter _filter = ClubRecordFilter.regular;
  late final Set<ClubRecordFilter> _activityFilters;
  late int _section;

  @override
  void initState() {
    super.initState();
    _year = widget.initialYear ?? DateTime.now().year;
    _section = widget.initialSection.clamp(0, 2);
    _activityFilters = <ClubRecordFilter>{
      widget.targetFilter ?? ClubRecordFilter.regular,
    };
  }

  @override
  Widget build(BuildContext context) {
    final AuthUser? user = ref.watch(authControllerProvider).user;
    if (user == null) return const Center(child: CircularProgressIndicator());
    final ClubStatisticsRequest request = (
      userId: user.id,
      teamId: widget.teamId,
      year: _year,
      filter: _filter,
    );
    final ClubActivityFeedRequest feedRequest = (
      userId: user.id,
      teamId: widget.teamId,
      year: _year,
      typesKey: clubActivityTypesKey(_activityFilters),
      targetActivityId: widget.targetActivityId,
    );
    final AsyncValue<ClubStatistics> statistics = ref.watch(
      clubStatisticsProvider(request),
    );
    final List<int> years = statistics.value?.availableYears ?? <int>[_year];

    return Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 20, 8),
          child: Row(
            children: <Widget>[
              IconButton(
                key: const Key('club-records-back'),
                onPressed: context.pop,
                icon: const Icon(Icons.arrow_back_rounded),
              ),
              const SizedBox(width: 6),
              const Expanded(child: Text('동호회 기록', style: AppTextStyles.title)),
              DropdownButton<int>(
                key: const Key('club-records-year'),
                value: _year,
                underline: const SizedBox.shrink(),
                items: years
                    .map(
                      (int year) => DropdownMenuItem<int>(
                        value: year,
                        child: Text('$year년'),
                      ),
                    )
                    .toList(growable: false),
                onChanged: (int? value) {
                  if (value != null) setState(() => _year = value);
                },
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: SegmentedButton<int>(
            segments: const <ButtonSegment<int>>[
              ButtonSegment<int>(
                value: 0,
                icon: Icon(Icons.dashboard_outlined),
                label: Text('종합 순위'),
              ),
              ButtonSegment<int>(
                value: 1,
                icon: Icon(Icons.query_stats_rounded),
                label: Text('종합 기록'),
              ),
              ButtonSegment<int>(
                value: 2,
                icon: Icon(Icons.event_note_rounded),
                label: Text('상세 기록'),
              ),
            ],
            selected: <int>{_section},
            onSelectionChanged: (Set<int> selected) {
              setState(() => _section = selected.single);
            },
          ),
        ),
        if (_section != 0)
          SizedBox(
            height: 48,
            child: _section == 1
                ? ListView.separated(
                    key: const Key('club-record-filters'),
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    scrollDirection: Axis.horizontal,
                    itemCount: ClubRecordFilter.values.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 8),
                    itemBuilder: (BuildContext context, int index) {
                      final ClubRecordFilter filter =
                          ClubRecordFilter.values[index];
                      return ChoiceChip(
                        label: Text(filter.label),
                        selected: filter == _filter,
                        onSelected: (_) => setState(() => _filter = filter),
                      );
                    },
                  )
                : Stack(
                    children: <Widget>[
                      ListView(
                        key: const Key('club-activity-filters'),
                        padding: const EdgeInsets.only(left: 20, right: 52),
                        scrollDirection: Axis.horizontal,
                        children: <Widget>[
                          FilterChip(
                            key: const Key('club-activity-filter-all'),
                            label: const Text('전체'),
                            selected:
                                _activityFilters.length ==
                                ClubRecordFilter.values.length - 1,
                            onSelected: (bool selected) => setState(() {
                              _activityFilters
                                ..clear()
                                ..addAll(
                                  selected
                                      ? ClubRecordFilter.values.where(
                                          (ClubRecordFilter filter) =>
                                              filter != ClubRecordFilter.all,
                                        )
                                      : const <ClubRecordFilter>[],
                                );
                            }),
                          ),
                          const SizedBox(width: 8),
                          for (final ClubRecordFilter filter
                              in ClubRecordFilter.values.where(
                                (ClubRecordFilter value) =>
                                    value != ClubRecordFilter.all,
                              )) ...<Widget>[
                            FilterChip(
                              key: Key(
                                'club-activity-filter-${filter.apiValue}',
                              ),
                              label: Text(filter.label),
                              selected: _activityFilters.contains(filter),
                              onSelected: (bool selected) => setState(() {
                                if (selected) {
                                  _activityFilters.add(filter);
                                } else {
                                  _activityFilters.remove(filter);
                                }
                              }),
                            ),
                            const SizedBox(width: 8),
                          ],
                        ],
                      ),
                      Positioned(
                        top: 0,
                        right: 0,
                        bottom: 0,
                        child: IgnorePointer(
                          child: Semantics(
                            label: '오른쪽으로 스크롤하면 더 많은 경기 분류가 있습니다.',
                            child: Container(
                              key: const Key(
                                'club-activity-filter-scroll-hint',
                              ),
                              width: 44,
                              alignment: Alignment.centerRight,
                              padding: const EdgeInsets.only(right: 8),
                              decoration: const BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.centerLeft,
                                  end: Alignment.centerRight,
                                  colors: <Color>[
                                    Color(0x0007111F),
                                    AppColors.background,
                                  ],
                                ),
                              ),
                              child: const Icon(
                                Icons.chevron_right_rounded,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
        Expanded(
          child: switch (_section) {
            0 => _OverviewBody(
              request: (userId: user.id, teamId: widget.teamId),
              year: _year,
            ),
            1 => _StatisticsBody(request: request, value: statistics),
            _ => _ActivitiesBody(
              request: feedRequest,
              targetActivityId: widget.targetActivityId,
            ),
          },
        ),
      ],
    );
  }
}

class _OverviewBody extends ConsumerWidget {
  const _OverviewBody({required this.request, required this.year});
  final ClubExpansionRequest request;
  final int year;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(clubTeamProfileProvider(request));
    final rankingRequest = (
      userId: request.userId,
      teamId: request.teamId,
      seasonId: null as String?,
      year: year,
      competitionType: 'ALL',
    );
    if (profile.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    final error = profile.error;
    if (error != null) {
      return ListView(
        padding: const EdgeInsets.all(20),
        children: <Widget>[
          ClubErrorCard(
            message: clubErrorMessage(error),
            onRetry: () async {
              ref.invalidate(clubTeamProfileProvider(request));
              await ref.read(clubTeamProfileProvider(request).future);
            },
          ),
        ],
      );
    }
    final ClubTeamProfile team = profile.requireValue;
    final AsyncValue<ClubSeasonRanking>? ranking = team.seasonRankingEnabled
        ? ref.watch(clubSeasonRankingProvider(rankingRequest))
        : null;
    if (ranking?.isLoading == true) {
      return const Center(child: CircularProgressIndicator());
    }
    if (ranking?.hasError == true) {
      return ListView(
        padding: const EdgeInsets.all(20),
        children: <Widget>[
          ClubErrorCard(
            message: clubErrorMessage(ranking!.error!),
            onRetry: () =>
                ref.refresh(clubSeasonRankingProvider(rankingRequest).future),
          ),
        ],
      );
    }
    final ClubSeasonRanking? season = ranking?.requireValue;
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(clubTeamProfileProvider(request));
        if (team.seasonRankingEnabled) {
          ref.invalidate(clubSeasonRankingProvider(rankingRequest));
        }
        await Future.wait(<Future<Object?>>[
          ref.read(clubTeamProfileProvider(request).future),
          if (team.seasonRankingEnabled)
            ref.read(clubSeasonRankingProvider(rankingRequest).future),
        ]);
      },
      child: ListView(
        key: const Key('club-overview'),
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
        children: <Widget>[
          if (!team.seasonRankingEnabled)
            const _EmptyCard(message: '시즌 순위표가 비활성화되어 있습니다.')
          else if (season?.season == null)
            const _EmptyCard(message: '활성 시즌 설정이 없습니다.')
          else ...<Widget>[
            Text(season!.season!.name, style: AppTextStyles.headline),
            Text(
              '${_date(season.season!.startDate)} ~ ${_date(season.season!.endDate)}',
              style: const TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            Card(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  columns: const <DataColumn>[
                    DataColumn(label: Text('순위')),
                    DataColumn(label: Text('이름')),
                    DataColumn(label: Text('POINT')),
                    DataColumn(label: Text('🥇')),
                    DataColumn(label: Text('🥈')),
                    DataColumn(label: Text('🥉')),
                  ],
                  rows: season.rows
                      .map(
                        (row) => DataRow(
                          cells: <DataCell>[
                            DataCell(
                              row.rank <= 3
                                  ? Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: <Widget>[
                                        BowlingMedalIcon(
                                          position: row.rank,
                                          size: 18,
                                        ),
                                        Text('${row.rank}'),
                                      ],
                                    )
                                  : Text('${row.rank}'),
                            ),
                            DataCell(Text(row.name)),
                            DataCell(Text('${row.points}')),
                            DataCell(Text('${row.gold}')),
                            DataCell(Text('${row.silver}')),
                            DataCell(Text('${row.bronze}')),
                          ],
                        ),
                      )
                      .toList(),
                ),
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => context.push(
                '/club/${Uri.encodeComponent(request.teamId)}/records/season',
              ),
              icon: const Icon(Icons.leaderboard_rounded),
              label: const Text('전체 순위'),
            ),
            if (season.rows.isNotEmpty) ...<Widget>[
              const SizedBox(height: 14),
              _MedalLeaders(rows: season.rows),
            ],
            const SizedBox(height: 22),
            const Text('나의 대회 성적', style: AppTextStyles.title),
            const SizedBox(height: 10),
            _MyCompetitionHistory(items: season.myCompetitionHistory),
          ],
        ],
      ),
    );
  }
}

class _MyCompetitionHistory extends StatelessWidget {
  const _MyCompetitionHistory({required this.items});

  final List<ClubSeasonPointEntry> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const _EmptyCard(message: '공식 대회 기록이 없습니다.');
    }
    final Map<int, List<ClubSeasonPointEntry>> byMonth =
        <int, List<ClubSeasonPointEntry>>{};
    for (final ClubSeasonPointEntry item in items) {
      byMonth.putIfAbsent(item.month, () => <ClubSeasonPointEntry>[]).add(item);
    }
    return Column(
      children: <Widget>[
        for (final int month in byMonth.keys.toList()..sort())
          Card(
            child: ExpansionTile(
              initiallyExpanded:
                  month == byMonth.keys.reduce((a, b) => a > b ? a : b),
              title: Text('$month월'),
              children: byMonth[month]!
                  .map(
                    (ClubSeasonPointEntry item) => ListTile(
                      dense: true,
                      title: Text(item.competitionTitle),
                      subtitle: Text(
                        _competitionTypeLabel(item.competitionType),
                      ),
                      trailing: Text(
                        item.participationStatus == 'ABSENT'
                            ? '불참'
                            : item.finalRank == null
                            ? '${item.points}P'
                            : '${item.finalRank}위 · ${item.points}P',
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
      ],
    );
  }
}

String _competitionTypeLabel(String value) => switch (value) {
  'INDIVIDUAL' => '개인전 · OFFICIAL',
  'TEAM' => '팀전 · OFFICIAL',
  'EVENT' => '이벤트전 · OFFICIAL',
  _ => 'OFFICIAL',
};

class _StatisticsBody extends ConsumerWidget {
  const _StatisticsBody({required this.request, required this.value});

  final ClubStatisticsRequest request;
  final AsyncValue<ClubStatistics> value;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return value.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (Object error, StackTrace stackTrace) => ListView(
        padding: const EdgeInsets.all(20),
        children: <Widget>[
          ClubErrorCard(
            message: clubErrorMessage(error),
            onRetry: () => ref.refresh(clubStatisticsProvider(request).future),
          ),
        ],
      ),
      data: (ClubStatistics data) => RefreshIndicator(
        onRefresh: () => ref.refresh(clubStatisticsProvider(request).future),
        child: ListView(
          key: const Key('club-statistics-list'),
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
          children: <Widget>[
            if (data.members.isEmpty)
              const _EmptyCard(message: '선택한 조건의 팀원 기록이 없습니다.')
            else
              _MemberStatisticsTable(members: data.members),
          ],
        ),
      ),
    );
  }
}

enum _StatisticsSort { name, attendance, games, month, total, average }

class _MemberStatisticsTable extends StatefulWidget {
  const _MemberStatisticsTable({required this.members});
  final List<ClubMemberStatistics> members;
  @override
  State<_MemberStatisticsTable> createState() => _MemberStatisticsTableState();
}

class _MemberStatisticsTableState extends State<_MemberStatisticsTable> {
  _StatisticsSort _sort = _StatisticsSort.attendance;
  int _month = 0;
  bool _ascending = false;
  static const double _rowHeight = 48;
  static const double _nameWidth = 112;
  static const double _cellWidth = 66;

  List<ClubMemberStatistics> get _rows {
    final rows = [...widget.members];
    int compare(ClubMemberStatistics left, ClubMemberStatistics right) {
      int value = switch (_sort) {
        _StatisticsSort.name => left.name.compareTo(right.name),
        _StatisticsSort.attendance => left.attendanceRate.compareTo(
          right.attendanceRate,
        ),
        _StatisticsSort.games => left.gameCount.compareTo(right.gameCount),
        _StatisticsSort.month => (left.monthlyAverages[_month] ?? -1).compareTo(
          right.monthlyAverages[_month] ?? -1,
        ),
        _StatisticsSort.total => left.total.compareTo(right.total),
        _StatisticsSort.average => left.average.compareTo(right.average),
      };
      if (!_ascending) value = -value;
      return value != 0 ? value : left.name.compareTo(right.name);
    }

    rows.sort(compare);
    return rows;
  }

  void _select(_StatisticsSort sort, [int month = 0]) => setState(() {
    if (_sort == sort && (sort != _StatisticsSort.month || _month == month)) {
      _ascending = !_ascending;
    } else {
      _sort = sort;
      _month = month;
      _ascending = sort == _StatisticsSort.name;
    }
  });

  @override
  Widget build(BuildContext context) {
    final rows = _rows;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: _nameWidth,
            child: Column(
              children: <Widget>[
                _StatCell(
                  width: _nameWidth,
                  text: '이름',
                  header: true,
                  onTap: () => _select(_StatisticsSort.name),
                ),
                for (int i = 0; i < rows.length; i++)
                  _StatCell(
                    width: _nameWidth,
                    text: rows[i].name,
                    background: i.isOdd
                        ? AppColors.surfaceElevated.withValues(alpha: 0.45)
                        : null,
                  ),
              ],
            ),
          ),
          Expanded(
            child: Stack(
              children: <Widget>[
                SingleChildScrollView(
                  key: const Key('club-statistics-horizontal'),
                  scrollDirection: Axis.horizontal,
                  child: Column(
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          _StatCell(
                            text: '출석률',
                            width: 104,
                            header: true,
                            onTap: () => _select(_StatisticsSort.attendance),
                          ),
                          _StatCell(
                            text: '게임',
                            header: true,
                            onTap: () => _select(_StatisticsSort.games),
                          ),
                          _StatCell(
                            text: '평균',
                            width: 76,
                            header: true,
                            onTap: () => _select(_StatisticsSort.average),
                          ),
                          for (int month = 0; month < 12; month++)
                            _StatCell(
                              text: '${month + 1}월',
                              header: true,
                              onTap: () =>
                                  _select(_StatisticsSort.month, month),
                            ),
                          _StatCell(
                            text: '총점',
                            width: 84,
                            header: true,
                            onTap: () => _select(_StatisticsSort.total),
                          ),
                        ],
                      ),
                      for (int i = 0; i < rows.length; i++)
                        Row(
                          children: <Widget>[
                            _StatCell(
                              text:
                                  '${rows[i].attendanceRate.toStringAsFixed(1)}% (${rows[i].attended}/${rows[i].activityCount})',
                              width: 104,
                              background: i.isOdd
                                  ? AppColors.surfaceElevated.withValues(
                                      alpha: 0.45,
                                    )
                                  : null,
                            ),
                            _StatCell(
                              text: '${rows[i].gameCount}',
                              background: i.isOdd
                                  ? AppColors.surfaceElevated.withValues(
                                      alpha: 0.45,
                                    )
                                  : null,
                            ),
                            _StatCell(
                              text: rows[i].average.toStringAsFixed(1),
                              width: 76,
                              background: i.isOdd
                                  ? AppColors.surfaceElevated.withValues(
                                      alpha: 0.45,
                                    )
                                  : null,
                            ),
                            for (int month = 0; month < 12; month++)
                              _StatCell(
                                text:
                                    '${rows[i].monthlyAverages[month] ?? '-'}',
                                background: i.isOdd
                                    ? AppColors.surfaceElevated.withValues(
                                        alpha: 0.45,
                                      )
                                    : null,
                              ),
                            _StatCell(
                              text: _number(rows[i].total),
                              width: 84,
                              background: i.isOdd
                                  ? AppColors.surfaceElevated.withValues(
                                      alpha: 0.45,
                                    )
                                  : null,
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
                const Positioned(
                  top: 7,
                  right: 4,
                  child: IgnorePointer(
                    child: Icon(
                      Icons.swipe_left_rounded,
                      key: Key('club-statistics-scroll-hint'),
                      size: 22,
                      color: AppColors.primaryBright,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatCell extends StatelessWidget {
  const _StatCell({
    required this.text,
    this.width = _MemberStatisticsTableState._cellWidth,
    this.header = false,
    this.onTap,
    this.background,
  });
  final String text;
  final double width;
  final bool header;
  final VoidCallback? onTap;
  final Color? background;
  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    child: Container(
      height: _MemberStatisticsTableState._rowHeight,
      width: width,
      color: background ?? (header ? AppColors.surfaceElevated : null),
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Text(
        text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 12,
          fontWeight: header ? FontWeight.w800 : FontWeight.w600,
          color: header ? AppColors.textSecondary : AppColors.textPrimary,
        ),
      ),
    ),
  );
}

class _MedalLeaders extends StatelessWidget {
  const _MedalLeaders({required this.rows});

  final List<ClubSeasonRankingRow> rows;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Text('메달 리더', style: TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          Text('🥇 ${_leaders((row) => row.gold)}'),
          Text('🥈 ${_leaders((row) => row.silver)}'),
          Text('🥉 ${_leaders((row) => row.bronze)}'),
        ],
      ),
    ),
  );

  String _leaders(int Function(ClubSeasonRankingRow row) countOf) {
    final max = rows.fold<int>(0, (value, row) {
      final count = countOf(row);
      return count > value ? count : value;
    });
    if (max == 0) return '-';
    final names = rows
        .where((row) => countOf(row) == max)
        .map((row) => row.name)
        .join(', ');
    return '$names $max회';
  }
}

class _ActivitiesBody extends ConsumerStatefulWidget {
  const _ActivitiesBody({required this.request, this.targetActivityId});

  final ClubActivityFeedRequest request;
  final String? targetActivityId;

  @override
  ConsumerState<_ActivitiesBody> createState() => _ActivitiesBodyState();
}

class _ActivitiesBodyState extends ConsumerState<_ActivitiesBody> {
  final GlobalKey _targetKey = GlobalKey();
  Timer? _highlightTimer;
  bool _scrollScheduled = false;
  bool _highlightTarget = true;

  @override
  void didUpdateWidget(covariant _ActivitiesBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.targetActivityId != widget.targetActivityId) {
      _scrollScheduled = false;
      _highlightTarget = true;
      _highlightTimer?.cancel();
    }
  }

  @override
  void dispose() {
    _highlightTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final request = widget.request;
    if (request.typesKey.isEmpty) {
      return ListView(
        key: const Key('club-activities-empty-selection'),
        padding: const EdgeInsets.all(20),
        children: const <Widget>[_EmptyCard(message: '경기 방식을 하나 이상 선택해주세요.')],
      );
    }
    final provider = clubActivityFeedControllerProvider(request);
    final AsyncValue<ClubActivityFeedState> value = ref.watch(provider);
    final ClubActivityFeedController controller = ref.read(provider.notifier);
    return value.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (Object error, StackTrace stackTrace) => ListView(
        padding: const EdgeInsets.all(20),
        children: <Widget>[
          ClubErrorCard(
            message: clubErrorMessage(error),
            onRetry: controller.retryInitial,
          ),
        ],
      ),
      data: (ClubActivityFeedState data) {
        _scheduleTargetScroll(data);
        return RefreshIndicator(
          onRefresh: controller.refreshActivities,
          child: ListView(
            key: const Key('club-activities-list'),
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
            children: <Widget>[
              if (data.refreshErrorMessage case final String message) ...[
                ClubErrorCard(
                  message: message,
                  onRetry: controller.refreshActivities,
                ),
                const SizedBox(height: 12),
              ],
              if (data.items.isEmpty)
                const _EmptyCard(message: '선택한 경기 방식의 활동 기록이 없습니다.')
              else
                for (final ClubActivityFeedItem activity in data.items) ...[
                  Container(
                    key: activity.id == widget.targetActivityId
                        ? _targetKey
                        : null,
                    child: _ActivityFeedCard(
                      request: request,
                      activity: activity,
                      currentMemberId: data.currentMemberId,
                      targetHighlighted:
                          _highlightTarget &&
                          activity.id == widget.targetActivityId,
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              if (data.isLoadingMore)
                const Padding(
                  padding: EdgeInsets.all(18),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (data.paginationErrorMessage case final String message)
                ClubErrorCard(
                  message: message,
                  onRetry: controller.loadNextPage,
                )
              else if (data.hasNextPage)
                OutlinedButton.icon(
                  key: const Key('club-activities-load-more'),
                  onPressed: controller.loadNextPage,
                  icon: const Icon(Icons.expand_more_rounded),
                  label: const Text('더 보기'),
                ),
            ],
          ),
        );
      },
    );
  }

  void _scheduleTargetScroll(ClubActivityFeedState data) {
    if (_scrollScheduled ||
        widget.targetActivityId == null ||
        !data.items.any((item) => item.id == widget.targetActivityId)) {
      return;
    }
    _scrollScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      final targetContext = _targetKey.currentContext;
      if (targetContext == null) return;
      await Scrollable.ensureVisible(
        targetContext,
        duration: const Duration(milliseconds: 300),
        alignment: 0.12,
      );
      if (!mounted) return;
      _highlightTimer?.cancel();
      _highlightTimer = Timer(const Duration(seconds: 2), () {
        if (mounted) setState(() => _highlightTarget = false);
      });
    });
  }
}

enum _ActivityAction { edit, delete }

class _ActivityFeedCard extends ConsumerStatefulWidget {
  const _ActivityFeedCard({
    required this.request,
    required this.activity,
    required this.currentMemberId,
    this.targetHighlighted = false,
  });

  final ClubActivityFeedRequest request;
  final ClubActivityFeedItem activity;
  final String? currentMemberId;
  final bool targetHighlighted;

  @override
  ConsumerState<_ActivityFeedCard> createState() => _ActivityFeedCardState();
}

class _ActivityFeedCardState extends ConsumerState<_ActivityFeedCard> {
  bool _working = false;

  @override
  Widget build(BuildContext context) {
    final ClubActivityFeedItem activity = widget.activity;
    final int maxGames = activity.participants.fold<int>(
      0,
      (int value, ClubActivityParticipant participant) =>
          participant.scores.length > value ? participant.scores.length : value,
    );
    return Card(
      key: Key('club-activity-${activity.id}'),
      color: widget.targetHighlighted
          ? AppColors.primary.withValues(alpha: 0.14)
          : null,
      shape: widget.targetHighlighted
          ? RoundedRectangleBorder(
              side: const BorderSide(color: AppColors.primaryBright, width: 2),
              borderRadius: BorderRadius.circular(12),
            )
          : null,
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: <Widget>[
                          DecoratedBox(
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 9,
                                vertical: 5,
                              ),
                              child: Text(
                                activity.gameType ?? '기록',
                                style: const TextStyle(
                                  color: AppColors.primaryBright,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                          Text(
                            _date(activity.date),
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${activity.participantCount}명 · '
                        '${activity.gameCount}게임 · '
                        'AVG ${activity.dailyAverage.toStringAsFixed(1)}',
                        style: const TextStyle(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                if (activity.canManage)
                  PopupMenuButton<_ActivityAction>(
                    key: Key('club-activity-menu-${activity.id}'),
                    enabled: !_working,
                    tooltip: '활동 관리',
                    onSelected: (_ActivityAction action) {
                      if (action == _ActivityAction.edit) {
                        _editActivity();
                      } else {
                        _deleteActivity();
                      }
                    },
                    itemBuilder: (BuildContext context) =>
                        const <PopupMenuEntry<_ActivityAction>>[
                          PopupMenuItem<_ActivityAction>(
                            value: _ActivityAction.edit,
                            child: Text('수정'),
                          ),
                          PopupMenuItem<_ActivityAction>(
                            value: _ActivityAction.delete,
                            child: Text('삭제'),
                          ),
                        ],
                  ),
              ],
            ),
            const SizedBox(height: 14),
            _ActivityResultTable(
              activity: activity,
              maxGames: maxGames,
              currentMemberId: widget.currentMemberId,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _editActivity() async {
    await context.push(
      '/club/${Uri.encodeComponent(widget.request.teamId)}/records/'
      '${Uri.encodeComponent(widget.activity.id)}/edit',
    );
    ref.invalidate(clubActivityFeedControllerProvider);
  }

  Future<void> _deleteActivity() async {
    if (_working) return;
    setState(() => _working = true);
    try {
      final editable = await ref
          .read(clubRepositoryProvider)
          .fetchEditableActivity(
            teamId: widget.request.teamId,
            activityId: widget.activity.id,
          );
      if (!mounted) return;
      final bool confirmed =
          await showDialog<bool>(
            context: context,
            builder: (BuildContext dialogContext) => AlertDialog(
              title: const Text('활동 기록 삭제'),
              content: Text(
                '${_date(widget.activity.date)} '
                '${widget.activity.gameType ?? '기록'} 기록을 삭제할까요?\n'
                '${editable.activity.scoreCount}개의 점수가 삭제됩니다.',
              ),
              actions: <Widget>[
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext, false),
                  child: const Text('취소'),
                ),
                FilledButton(
                  key: const Key('activity-feed-delete-confirm'),
                  onPressed: () => Navigator.pop(dialogContext, true),
                  child: const Text('삭제'),
                ),
              ],
            ),
          ) ??
          false;
      if (!confirmed) return;
      await ref
          .read(clubRepositoryProvider)
          .deleteActivity(
            teamId: widget.request.teamId,
            activityId: widget.activity.id,
            revision: editable.activity.revision,
          );
      _invalidateCaches();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('활동 기록을 삭제했습니다.')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(clubErrorMessage(error))));
      }
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  void _invalidateCaches() {
    ref.invalidate(clubActivityFeedControllerProvider);
    ref.invalidate(clubActivitiesControllerProvider);
    ref.invalidate(clubStatisticsProvider);
    ref.invalidate(clubActivityProvider);
    ref.invalidate(clubActivityEditProvider);
    ref.invalidate(dashboardProvider(widget.request.userId));
    ref.invalidate(recordsControllerProvider(widget.request.userId));
  }
}

class _ActivityResultTable extends StatelessWidget {
  const _ActivityResultTable({
    required this.activity,
    required this.maxGames,
    required this.currentMemberId,
  });

  static const double _headerHeight = 38;
  static const double _rowHeight = 46;
  static const double _rankWidth = 32;
  static const double _nameWidth = 62;
  static const double _scoreWidth = 34;
  static const double _totalWidth = 44;
  static const double _averageWidth = 46;

  final ClubActivityFeedItem activity;
  final int maxGames;
  final String? currentMemberId;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.divider),
        borderRadius: BorderRadius.circular(10),
      ),
      child: SingleChildScrollView(
        key: Key('activity-score-scroll-${activity.id}'),
        scrollDirection: Axis.horizontal,
        child: Column(
          children: <Widget>[
            _ScoreHeader(maxGames: maxGames),
            for (int index = 0; index < activity.participants.length; index++)
              _ScoreParticipantRow(
                participant: activity.participants[index],
                maxGames: maxGames,
                highlighted: activity.participants[index].id == currentMemberId,
                alternate: index.isOdd,
              ),
          ],
        ),
      ),
    );
  }
}

class _ScoreHeader extends StatelessWidget {
  const _ScoreHeader({required this.maxGames});
  final int maxGames;

  @override
  Widget build(BuildContext context) => Container(
    height: _ActivityResultTable._headerHeight,
    color: AppColors.surfaceElevated,
    child: Row(
      children: <Widget>[
        const _TableCell(
          width: _ActivityResultTable._rankWidth,
          text: '순위',
          header: true,
        ),
        const _TableCell(
          width: _ActivityResultTable._nameWidth,
          text: '이름',
          header: true,
        ),
        for (int index = 0; index < maxGames.clamp(0, 4); index++)
          _TableCell(
            width: _ActivityResultTable._scoreWidth,
            text: '${index + 1}G',
            header: true,
          ),
        const _TableCell(
          width: _ActivityResultTable._totalWidth,
          text: '총점',
          header: true,
        ),
        const _TableCell(
          width: _ActivityResultTable._averageWidth,
          text: 'AVG',
          header: true,
        ),
        for (int index = 4; index < maxGames; index++)
          _TableCell(
            width: _ActivityResultTable._scoreWidth,
            text: '${index + 1}G',
            header: true,
          ),
      ],
    ),
  );
}

class _ScoreParticipantRow extends StatelessWidget {
  const _ScoreParticipantRow({
    required this.participant,
    required this.maxGames,
    required this.highlighted,
    required this.alternate,
  });
  final ClubActivityParticipant participant;
  final int maxGames;
  final bool highlighted;
  final bool alternate;

  @override
  Widget build(BuildContext context) => Container(
    height: _ActivityResultTable._rowHeight,
    color: _rowColor(highlighted, alternate),
    child: Row(
      children: <Widget>[
        _TableCell(
          width: _ActivityResultTable._rankWidth,
          text: '${participant.rank}',
          emphasized: participant.rank <= 3,
        ),
        _TableCell(
          width: _ActivityResultTable._nameWidth,
          text: participant.name,
          tooltip: participant.name,
        ),
        for (int index = 0; index < maxGames.clamp(0, 4); index++)
          _TableCell(
            width: _ActivityResultTable._scoreWidth,
            text: index < participant.scores.length
                ? '${participant.scores[index]}'
                : '-',
          ),
        _TableCell(
          width: _ActivityResultTable._totalWidth,
          text: _number(participant.total),
          emphasized: true,
        ),
        _TableCell(
          width: _ActivityResultTable._averageWidth,
          text: participant.average.toStringAsFixed(1),
          emphasized: true,
          average: true,
        ),
        for (int index = 4; index < maxGames; index++)
          _TableCell(
            width: _ActivityResultTable._scoreWidth,
            text: index < participant.scores.length
                ? '${participant.scores[index]}'
                : '-',
          ),
      ],
    ),
  );
}

class _TableCell extends StatelessWidget {
  const _TableCell({
    required this.width,
    required this.text,
    this.header = false,
    this.emphasized = false,
    this.average = false,
    this.tooltip,
  });
  final double width;
  final String text;
  final bool header;
  final bool emphasized;
  final bool average;
  final String? tooltip;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: width,
    child: Center(
      child: Tooltip(
        message: tooltip ?? '',
        excludeFromSemantics: tooltip == null,
        child: Text(
          text,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: average
                ? AppColors.primaryBright
                : header
                ? AppColors.textSecondary
                : AppColors.textPrimary,
            fontSize: 12,
            fontWeight: header || emphasized
                ? FontWeight.w800
                : FontWeight.w500,
          ),
        ),
      ),
    ),
  );
}

Color? _rowColor(bool highlighted, bool alternate) {
  if (highlighted) return AppColors.primary.withValues(alpha: 0.22);
  if (alternate) return AppColors.surfaceElevated.withValues(alpha: 0.48);
  return null;
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 40),
        child: Center(child: Text(message)),
      ),
    );
  }
}

String _date(DateTime value) =>
    '${value.year}.${value.month.toString().padLeft(2, '0')}.'
    '${value.day.toString().padLeft(2, '0')}';

String _number(int value) => value.toString().replaceAllMapped(
  RegExp(r'\B(?=(\d{3})+(?!\d))'),
  (_) => ',',
);
