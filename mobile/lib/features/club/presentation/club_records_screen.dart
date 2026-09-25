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
    super.key,
  });

  final String teamId;
  final int initialSection;

  @override
  ConsumerState<ClubRecordsScreen> createState() => _ClubRecordsScreenState();
}

class _ClubRecordsScreenState extends ConsumerState<ClubRecordsScreen> {
  late int _year;
  ClubRecordFilter _filter = ClubRecordFilter.regular;
  final Set<ClubRecordFilter> _activityFilters = <ClubRecordFilter>{
    ClubRecordFilter.regular,
    ClubRecordFilter.casual,
    ClubRecordFilter.house,
  };
  late int _section;

  @override
  void initState() {
    super.initState();
    _year = DateTime.now().year;
    _section = widget.initialSection.clamp(0, 2);
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
    );
    final ClubActivityFeedRequest overviewFeedRequest = (
      userId: user.id,
      teamId: widget.teamId,
      year: _year,
      typesKey: clubActivityTypesKey(const <ClubRecordFilter>{
        ClubRecordFilter.regular,
      }),
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
                label: Text('종합'),
              ),
              ButtonSegment<int>(
                value: 1,
                icon: Icon(Icons.query_stats_rounded),
                label: Text('팀원 통계'),
              ),
              ButtonSegment<int>(
                value: 2,
                icon: Icon(Icons.event_note_rounded),
                label: Text('활동 일지'),
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
              statistics: statistics,
              feedRequest: overviewFeedRequest,
            ),
            1 => _StatisticsBody(request: request, value: statistics),
            _ => _ActivitiesBody(request: feedRequest),
          },
        ),
      ],
    );
  }
}

class _OverviewBody extends ConsumerWidget {
  const _OverviewBody({
    required this.request,
    required this.statistics,
    required this.feedRequest,
  });
  final ClubExpansionRequest request;
  final AsyncValue<ClubStatistics> statistics;
  final ClubActivityFeedRequest feedRequest;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(clubTeamProfileProvider(request));
    final rankingRequest = (
      userId: request.userId,
      teamId: request.teamId,
      seasonId: null as String?,
      competitionType: 'ALL',
    );
    final recentFeed = ref.watch(
      clubActivityFeedControllerProvider(feedRequest),
    );
    if (profile.isLoading || statistics.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    final error = profile.error ?? statistics.error;
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
    final ClubStatisticsSummary summary = statistics.requireValue.summary;
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(clubTeamProfileProvider(request));
        if (team.seasonRankingEnabled) {
          ref.invalidate(clubSeasonRankingProvider(rankingRequest));
        }
        ref.invalidate(clubActivityFeedControllerProvider(feedRequest));
        await Future.wait(<Future<Object?>>[
          ref.read(clubTeamProfileProvider(request).future),
          if (team.seasonRankingEnabled)
            ref.read(clubSeasonRankingProvider(rankingRequest).future),
          ref.read(clubActivityFeedControllerProvider(feedRequest).future),
        ]);
      },
      child: ListView(
        key: const Key('club-overview'),
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
        children: <Widget>[
          if (team.notice?.isNotEmpty == true)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text('공지 · ${team.notice}'),
              ),
            ),
          if (team.description?.isNotEmpty == true) ...<Widget>[
            const SizedBox(height: 10),
            Text(
              team.description!,
              style: const TextStyle(color: AppColors.textSecondary),
            ),
          ],
          const SizedBox(height: 14),
          _SummaryCard(summary: summary),
          const SizedBox(height: 16),
          _RecentRegularCard(value: recentFeed),
          const SizedBox(height: 16),
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
                      .take(5)
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
          ],
        ],
      ),
    );
  }
}

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
            _SummaryCard(summary: data.summary),
            const SizedBox(height: 18),
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
                    alignLeft: true,
                  ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
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
                      for (int month = 0; month < 12; month++)
                        _StatCell(
                          text: '${month + 1}월',
                          header: true,
                          onTap: () => _select(_StatisticsSort.month, month),
                        ),
                      _StatCell(
                        text: '총점',
                        header: true,
                        onTap: () => _select(_StatisticsSort.total),
                      ),
                      _StatCell(
                        text: '평균',
                        header: true,
                        onTap: () => _select(_StatisticsSort.average),
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
                        for (int month = 0; month < 12; month++)
                          _StatCell(
                            text: '${rows[i].monthlyAverages[month] ?? '-'}',
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
                        _StatCell(
                          text: rows[i].average.toStringAsFixed(1),
                          width: 76,
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
    this.alignLeft = false,
  });
  final String text;
  final double width;
  final bool header;
  final VoidCallback? onTap;
  final Color? background;
  final bool alignLeft;
  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    child: Container(
      height: _MemberStatisticsTableState._rowHeight,
      width: width,
      color: background ?? (header ? AppColors.surfaceElevated : null),
      alignment: alignLeft ? Alignment.centerLeft : Alignment.center,
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

class _RecentRegularCard extends StatelessWidget {
  const _RecentRegularCard({required this.value});

  final AsyncValue<ClubActivityFeedState> value;

  @override
  Widget build(BuildContext context) {
    final items = value.value?.items ?? const <ClubActivityFeedItem>[];
    final recent = items.isEmpty ? null : items.first;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Text('최근 정기전', style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            if (value.isLoading && value.value == null)
              const Center(child: CircularProgressIndicator())
            else if (value.hasError)
              const Text(
                '최근 정기전 정보를 불러오지 못했습니다.',
                style: TextStyle(color: AppColors.textSecondary),
              )
            else if (recent == null)
              const Text(
                '정기전 기록이 없습니다.',
                style: TextStyle(color: AppColors.textSecondary),
              )
            else
              Wrap(
                spacing: 18,
                runSpacing: 8,
                children: <Widget>[
                  Text(_date(recent.date)),
                  Text('${recent.participantCount}명'),
                  Text('${recent.gameCount}게임'),
                  Text(
                    'AVG ${recent.dailyAverage.toStringAsFixed(1)}',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
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

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.summary});

  final ClubStatisticsSummary summary;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Wrap(
          spacing: 24,
          runSpacing: 14,
          children: <Widget>[
            _Metric(label: '활동', value: '${summary.activityCount}회'),
            _Metric(label: '참여 회원', value: '${summary.memberCount}명'),
            _Metric(
              label: '평균 참석률',
              value: '${summary.attendanceRate.toStringAsFixed(1)}%',
            ),
            _Metric(label: '게임', value: '${summary.gameCount}'),
            _Metric(label: '총점', value: _number(summary.total)),
            _Metric(label: 'AVG', value: summary.average.toStringAsFixed(1)),
          ],
        ),
      ),
    );
  }
}

class _ActivitiesBody extends ConsumerWidget {
  const _ActivitiesBody({required this.request});

  final ClubActivityFeedRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
      data: (ClubActivityFeedState data) => RefreshIndicator(
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
                _ActivityFeedCard(
                  request: request,
                  activity: activity,
                  currentMemberId: data.currentMemberId,
                ),
                const SizedBox(height: 16),
              ],
            if (data.isLoadingMore)
              const Padding(
                padding: EdgeInsets.all(18),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (data.paginationErrorMessage case final String message)
              ClubErrorCard(message: message, onRetry: controller.loadNextPage)
            else if (data.hasNextPage)
              OutlinedButton.icon(
                key: const Key('club-activities-load-more'),
                onPressed: controller.loadNextPage,
                icon: const Icon(Icons.expand_more_rounded),
                label: const Text('더 보기'),
              ),
          ],
        ),
      ),
    );
  }
}

enum _ActivityAction { edit, delete }

class _ActivityFeedCard extends ConsumerStatefulWidget {
  const _ActivityFeedCard({
    required this.request,
    required this.activity,
    required this.currentMemberId,
  });

  final ClubActivityFeedRequest request;
  final ClubActivityFeedItem activity;
  final String? currentMemberId;

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
  static const double _fixedWidth = 142;
  static const double _rankWidth = 48;
  static const double _scoreWidth = 52;
  static const double _totalWidth = 68;
  static const double _averageWidth = 64;

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
      child: ClipRRect(
        borderRadius: BorderRadius.circular(9),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            SizedBox(
              width: _fixedWidth,
              child: Column(
                children: <Widget>[
                  const _FixedTableRow(
                    height: _headerHeight,
                    rank: WidgetOrString.text('순위'),
                    name: WidgetOrString.text('이름'),
                    header: true,
                  ),
                  for (
                    int index = 0;
                    index < activity.participants.length;
                    index++
                  )
                    _FixedParticipantRow(
                      participant: activity.participants[index],
                      highlighted:
                          activity.participants[index].id == currentMemberId,
                      alternate: index.isOdd,
                    ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                key: Key('activity-score-scroll-${activity.id}'),
                scrollDirection: Axis.horizontal,
                child: Column(
                  children: <Widget>[
                    _ScoreHeader(maxGames: maxGames),
                    for (
                      int index = 0;
                      index < activity.participants.length;
                      index++
                    )
                      _ScoreParticipantRow(
                        participant: activity.participants[index],
                        maxGames: maxGames,
                        highlighted:
                            activity.participants[index].id == currentMemberId,
                        alternate: index.isOdd,
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FixedTableRow extends StatelessWidget {
  const _FixedTableRow({
    required this.height,
    required this.rank,
    required this.name,
    this.header = false,
    this.background,
  });

  final double height;
  final WidgetOrString rank;
  final WidgetOrString name;
  final bool header;
  final Color? background;

  @override
  Widget build(BuildContext context) => Container(
    height: height,
    color: background ?? (header ? AppColors.surfaceElevated : null),
    child: Row(
      children: <Widget>[
        SizedBox(
          width: _ActivityResultTable._rankWidth,
          child: Center(child: _cell(rank, header)),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(right: 8),
            child: _cell(name, header),
          ),
        ),
      ],
    ),
  );

  Widget _cell(WidgetOrString value, bool bold) =>
      value.widget ??
      Text(
        value.text!,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: bold ? AppColors.textSecondary : AppColors.textPrimary,
          fontSize: 12,
          fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
        ),
      );
}

class WidgetOrString {
  const WidgetOrString.text(this.text) : widget = null;
  const WidgetOrString.widget(this.widget) : text = null;
  final String? text;
  final Widget? widget;
}

class _FixedParticipantRow extends StatelessWidget {
  const _FixedParticipantRow({
    required this.participant,
    required this.highlighted,
    required this.alternate,
  });
  final ClubActivityParticipant participant;
  final bool highlighted;
  final bool alternate;

  @override
  Widget build(BuildContext context) => _FixedTableRow(
    height: _ActivityResultTable._rowHeight,
    background: _rowColor(highlighted, alternate),
    rank: WidgetOrString.widget(_RankCell(rank: participant.rank)),
    name: WidgetOrString.text(participant.name),
  );
}

class _RankCell extends StatelessWidget {
  const _RankCell({required this.rank});
  final int rank;

  @override
  Widget build(BuildContext context) => rank <= 3
      ? Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            BowlingMedalIcon(position: rank, size: 17),
            Text('$rank', style: const TextStyle(fontSize: 11)),
          ],
        )
      : Text('$rank', style: const TextStyle(fontWeight: FontWeight.w700));
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
        for (int index = 0; index < maxGames; index++)
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
        for (int index = 0; index < maxGames; index++)
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
  });
  final double width;
  final String text;
  final bool header;
  final bool emphasized;
  final bool average;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: width,
    child: Center(
      child: Text(
        text,
        maxLines: 1,
        style: TextStyle(
          color: average
              ? AppColors.primaryBright
              : header
              ? AppColors.textSecondary
              : AppColors.textPrimary,
          fontSize: 12,
          fontWeight: header || emphasized ? FontWeight.w800 : FontWeight.w500,
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

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: const TextStyle(color: AppColors.textSecondary)),
        Text(
          value,
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
        ),
      ],
    );
  }
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
