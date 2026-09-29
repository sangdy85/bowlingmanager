import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/core/domain/game_session.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/records/application/records_providers.dart';
import 'package:bowlingmanager_mobile/features/records/application/records_state.dart';
import 'package:bowlingmanager_mobile/features/records/domain/score_record.dart';
import 'package:bowlingmanager_mobile/features/home/domain/dashboard.dart';
import 'package:bowlingmanager_mobile/features/home/presentation/home_screen.dart';
import 'package:bowlingmanager_mobile/shared/widgets/bowling_medal.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class RecordsScreen extends ConsumerWidget {
  const RecordsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthUser? user = ref.watch(authControllerProvider).user;
    if (user == null) return const _RecordsLoading();

    final AsyncValue<RecordsState> records = ref.watch(
      recordsControllerProvider(user.id),
    );
    return records.when(
      data: (RecordsState data) => _RecordsContent(
        state: data,
        onRefresh: () => ref
            .read(recordsControllerProvider(user.id).notifier)
            .refreshRecords(),
        onLoadMore: () => ref
            .read(recordsControllerProvider(user.id).notifier)
            .loadNextPage(),
        onFilter: (RecordsFilter filter) => ref
            .read(recordsControllerProvider(user.id).notifier)
            .applyFilter(filter),
      ),
      error: (Object error, StackTrace stackTrace) => _RecordsError(
        message: recordsErrorMessage(error),
        onRetry: () => ref
            .read(recordsControllerProvider(user.id).notifier)
            .retryInitial(),
      ),
      loading: _RecordsLoading.new,
    );
  }
}

class _RecordsContent extends StatelessWidget {
  const _RecordsContent({
    required this.state,
    required this.onRefresh,
    required this.onLoadMore,
    required this.onFilter,
  });

  final RecordsState state;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onLoadMore;
  final Future<void> Function(RecordsFilter filter) onFilter;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        key: const Key('records-list'),
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
        children: <Widget>[
          const _RecordsHeader(),
          const SizedBox(height: 18),
          _RecordsYearSelector(state: state, onChanged: onFilter),
          const SizedBox(height: 18),
          if (state.dashboard case final Dashboard dashboard) ...<Widget>[
            _PersonalRecordsDashboard(dashboard: dashboard),
            const SizedBox(height: 24),
            const Text('경기 기록', style: AppTextStyles.title),
            const SizedBox(height: 12),
          ],
          _RecordsFilters(state: state, onChanged: onFilter),
          const SizedBox(height: 20),
          if (state.refreshErrorMessage case final String message) ...<Widget>[
            _InlineError(message: message, onRetry: onRefresh),
            const SizedBox(height: 12),
          ],
          if (state.items.isEmpty)
            const _EmptyRecords()
          else
            ..._recordSections(state.items),
          if (state.isLoadingMore)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 18),
              child: Center(
                child: CircularProgressIndicator(
                  key: Key('records-loading-more'),
                ),
              ),
            )
          else if (state.paginationErrorMessage
              case final String message) ...<Widget>[
            const SizedBox(height: 4),
            _InlineError(message: message, onRetry: onLoadMore),
          ] else if (state.hasNextPage) ...<Widget>[
            const SizedBox(height: 4),
            OutlinedButton.icon(
              key: const Key('records-load-more'),
              onPressed: onLoadMore,
              icon: const Icon(Icons.expand_more_rounded),
              label: const Text('더 보기'),
            ),
          ],
        ],
      ),
    );
  }
}

class _PersonalRecordsDashboard extends StatelessWidget {
  const _PersonalRecordsDashboard({required this.dashboard});
  final Dashboard dashboard;

  @override
  Widget build(BuildContext context) {
    final regular = dashboard.personalStats.regular;
    final official = dashboard.personalStats.official;
    final hasRecords = dashboard.gameCount > 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text('${dashboard.year} PLAYER PROFILE', style: AppTextStyles.title),
        const SizedBox(height: 10),
        Card(
          key: const Key('records-profile-summary'),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: <Widget>[
                Text(
                  hasRecords
                      ? '총평균 ${dashboard.average.toStringAsFixed(1)}'
                      : '총평균 -',
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 14),
                _ProfileStatLine(label: '정기전', stats: regular),
                const Divider(height: 22),
                _ProfileStatLine(label: '볼링장 공식', stats: official),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        DashboardRadarCard(radar: dashboard.profileRadar),
        const SizedBox(height: 16),
        const Text('입상 기록', style: AppTextStyles.title),
        const SizedBox(height: 8),
        DashboardMedalsCard(medals: dashboard.medals),
        if (dashboard.seasonSummaries.isNotEmpty) ...<Widget>[
          const SizedBox(height: 16),
          const Text('시즌 순위', style: AppTextStyles.title),
          const SizedBox(height: 8),
          for (final DashboardSeasonSummary season
              in dashboard.seasonSummaries) ...<Widget>[
            _SeasonSummaryCard(season: season),
            const SizedBox(height: 8),
          ],
        ],
        const SizedBox(height: 16),
        const Text('개인 통계', style: AppTextStyles.title),
        const SizedBox(height: 8),
        Card(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              columns: const <DataColumn>[
                DataColumn(label: Text('분류')),
                DataColumn(label: Text('게임')),
                DataColumn(label: Text('총점')),
                DataColumn(label: Text('하이')),
                DataColumn(label: Text('평균')),
              ],
              rows: dashboard.recordCategories
                  .map(
                    (item) => DataRow(
                      cells: <DataCell>[
                        DataCell(Text(item.label)),
                        DataCell(Text('${item.gameCount}')),
                        DataCell(
                          Text(item.gameCount == 0 ? '-' : '${item.total}'),
                        ),
                        DataCell(
                          Text(item.gameCount == 0 ? '-' : '${item.highScore}'),
                        ),
                        DataCell(
                          Text(
                            item.gameCount == 0
                                ? '-'
                                : item.average.toStringAsFixed(1),
                          ),
                        ),
                      ],
                    ),
                  )
                  .toList(growable: false),
            ),
          ),
        ),
      ],
    );
  }
}

class _ProfileStatLine extends StatelessWidget {
  const _ProfileStatLine({required this.label, required this.stats});
  final String label;
  final DashboardCategoryStats stats;

  @override
  Widget build(BuildContext context) {
    final empty = stats.gameCount == 0;
    String value(num number, {int decimals = 0}) => empty
        ? '-'
        : decimals == 0
        ? number.toInt().toString()
        : number.toStringAsFixed(decimals);
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: <Widget>[
          SizedBox(
            width: 92,
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
          SizedBox(
            width: 76,
            child: Text('AVG ${value(stats.average, decimals: 1)}'),
          ),
          SizedBox(width: 54, child: Text('H ${value(stats.highScore)}')),
          SizedBox(width: 54, child: Text('L ${value(stats.lowScore)}')),
          SizedBox(width: 52, child: Text('${stats.gameCount}G')),
          SizedBox(width: 70, child: Text('편차 ${value(stats.roundSpread)}')),
        ],
      ),
    );
  }
}

List<Widget> _recordSections(List<GameSession> sessions) {
  final widgets = <Widget>[];
  int? currentYear;
  for (final session in sessions) {
    if (currentYear != session.gameDate.year) {
      currentYear = session.gameDate.year;
      if (widgets.isNotEmpty) widgets.add(const SizedBox(height: 10));
      widgets.add(
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Text(
            '$currentYear년',
            key: Key('records-year-$currentYear'),
            style: AppTextStyles.title,
          ),
        ),
      );
    }
    widgets
      ..add(_RecordCard(session: session))
      ..add(const SizedBox(height: 12));
  }
  return widgets;
}

class _RecordsYearSelector extends StatelessWidget {
  const _RecordsYearSelector({required this.state, required this.onChanged});

  final RecordsState state;
  final Future<void> Function(RecordsFilter filter) onChanged;

  @override
  Widget build(BuildContext context) {
    final int selected = state.filter.year ?? DateTime.now().year;
    return DropdownButtonFormField<int>(
      key: const Key('records-year-filter'),
      initialValue: selected,
      isExpanded: true,
      decoration: const InputDecoration(
        labelText: '조회 연도',
        prefixIcon: Icon(Icons.calendar_month_outlined),
      ),
      items: state.availableYears
          .map(
            (year) => DropdownMenuItem<int>(value: year, child: Text('$year년')),
          )
          .toList(growable: false),
      onChanged: (year) {
        if (year != null && year != selected) {
          onChanged(state.filter.copyWith(year: year));
        }
      },
    );
  }
}

class _SeasonSummaryCard extends StatelessWidget {
  const _SeasonSummaryCard({required this.season});

  final DashboardSeasonSummary season;

  @override
  Widget build(BuildContext context) {
    final String seasonRank = season.rank != null
        ? season.points == null
              ? '${season.rank}위'
              : '${season.rank}위 · ${season.points}P'
        : season.rankingMode == 'IMAGE'
        ? '이미지 순위표'
        : '-';
    final String finalRank = season.lifecycleStatus == 'ACTIVE'
        ? '미확정'
        : season.finalRank == null
        ? '미확정'
        : '${season.finalRank}위';
    return Card(
      key: Key('records-season-${season.seasonId}'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              '${season.teamName} · ${season.seasonName}',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 5),
            Text(
              '${_formatSeasonDate(season.startDate)} ~ ${_formatSeasonDate(season.endDate)}',
              style: const TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            Row(
              children: <Widget>[
                Expanded(
                  child: _SeasonRankMetric(label: '시즌 순위', value: seasonRank),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _SeasonRankMetric(label: '최종 순위', value: finalRank),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

String _formatSeasonDate(DateTime date) =>
    '${date.year}.${date.month.toString().padLeft(2, '0')}.${date.day.toString().padLeft(2, '0')}';

class _RecordsFilters extends StatelessWidget {
  const _RecordsFilters({required this.state, required this.onChanged});

  final RecordsState state;
  final Future<void> Function(RecordsFilter filter) onChanged;

  @override
  Widget build(BuildContext context) {
    final filter = state.filter;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Align(
          alignment: Alignment.centerRight,
          child: OutlinedButton.icon(
            key: const Key('records-average-filter'),
            onPressed: () async {
              final RecordsFilter? next =
                  await showModalBottomSheet<RecordsFilter>(
                    context: context,
                    isScrollControlled: true,
                    builder: (BuildContext context) =>
                        _AverageFilterSheet(filter: filter),
                  );
              if (next != null) await onChanged(next);
            },
            icon: const Icon(Icons.tune_rounded),
            label: Text(_averageFilterLabel(filter)),
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: RecordCategory.values
              .map((RecordCategory category) {
                return ChoiceChip(
                  key: Key('records-category-${category.apiValue}'),
                  label: Text(category.label),
                  selected: filter.category == category,
                  onSelected: (_) =>
                      onChanged(filter.copyWith(category: category)),
                );
              })
              .toList(growable: false),
        ),
        if (filter.category == RecordCategory.official) ...<Widget>[
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: OfficialRecordCategory.values
                .map((category) {
                  return ChoiceChip(
                    key: Key('records-official-${category.apiValue}'),
                    label: Text(category.label),
                    selected: filter.officialCategory == category,
                    onSelected: (_) =>
                        onChanged(filter.copyWith(officialCategory: category)),
                  );
                })
                .toList(growable: false),
          ),
        ],
      ],
    );
  }
}

String _averageFilterLabel(RecordsFilter filter) {
  if (filter.minAverage == null && filter.maxAverage == null) return 'AVG 전체';
  return '${filter.minAverage?.toStringAsFixed(0) ?? '0'}–'
      '${filter.maxAverage?.toStringAsFixed(0) ?? '∞'}';
}

class _AverageFilterSheet extends StatefulWidget {
  const _AverageFilterSheet({required this.filter});
  final RecordsFilter filter;

  @override
  State<_AverageFilterSheet> createState() => _AverageFilterSheetState();
}

class _AverageFilterSheetState extends State<_AverageFilterSheet> {
  late final TextEditingController _min = TextEditingController(
    text: widget.filter.minAverage?.toString() ?? '',
  );
  late final TextEditingController _max = TextEditingController(
    text: widget.filter.maxAverage?.toString() ?? '',
  );
  String? _error;

  @override
  void dispose() {
    _min.dispose();
    _max.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          20,
          20,
          20 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            const Text('세션 AVG 범위', style: AppTextStyles.title),
            const SizedBox(height: 6),
            const Text(
              '카드에 표시되는 경기 세션 평균을 기준으로 필터링합니다.',
              style: TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            Row(
              children: <Widget>[
                Expanded(
                  child: TextField(
                    key: const Key('records-min-average'),
                    controller: _min,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: '최소 AVG'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    key: const Key('records-max-average'),
                    controller: _max,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: '최대 AVG'),
                  ),
                ),
              ],
            ),
            if (_error != null) ...<Widget>[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: Colors.redAccent)),
            ],
            const SizedBox(height: 18),
            Row(
              children: <Widget>[
                TextButton(
                  onPressed: () => Navigator.pop(
                    context,
                    widget.filter.copyWith(
                      clearMinAverage: true,
                      clearMaxAverage: true,
                    ),
                  ),
                  child: const Text('초기화'),
                ),
                const Spacer(),
                FilledButton(onPressed: _apply, child: const Text('적용')),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _apply() {
    final minText = _min.text.trim();
    final maxText = _max.text.trim();
    final double? min = minText.isEmpty ? null : double.tryParse(minText);
    final double? max = maxText.isEmpty ? null : double.tryParse(maxText);
    if ((minText.isNotEmpty && min == null) ||
        (maxText.isNotEmpty && max == null) ||
        (min != null && (min < 0 || min > 1000)) ||
        (max != null && (max < 0 || max > 1000)) ||
        (min != null && max != null && min > max)) {
      setState(() => _error = '0~1000 사이의 올바른 AVG 범위를 입력해주세요.');
      return;
    }
    Navigator.pop(
      context,
      widget.filter.copyWith(
        minAverage: min,
        clearMinAverage: min == null,
        maxAverage: max,
        clearMaxAverage: max == null,
      ),
    );
  }
}

class _RecordsHeader extends StatelessWidget {
  const _RecordsHeader();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text('나의 기록', style: AppTextStyles.headline),
        SizedBox(height: 6),
        Text(
          '최근 경기 점수를 한눈에 확인하세요.',
          style: TextStyle(color: AppColors.textSecondary),
        ),
      ],
    );
  }
}

class _RecordsLoading extends StatelessWidget {
  const _RecordsLoading();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
      children: const <Widget>[
        _RecordsHeader(),
        SizedBox(height: 96),
        Center(child: CircularProgressIndicator()),
      ],
    );
  }
}

class _RecordsError extends StatelessWidget {
  const _RecordsError({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
      children: <Widget>[
        const _RecordsHeader(),
        const SizedBox(height: 36),
        _InlineError(message: message, onRetry: onRetry),
      ],
    );
  }
}

class _EmptyRecords extends StatelessWidget {
  const _EmptyRecords();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 24, vertical: 44),
        child: Column(
          children: <Widget>[
            Icon(
              Icons.sports_score_rounded,
              color: AppColors.textSecondary,
              size: 40,
            ),
            SizedBox(height: 14),
            Text(
              '아직 기록이 없습니다.',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: <Widget>[
            const Icon(
              Icons.cloud_off_rounded,
              color: AppColors.textSecondary,
              size: 34,
            ),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('다시 시도'),
            ),
          ],
        ),
      ),
    );
  }
}

class _RecordCard extends StatelessWidget {
  const _RecordCard({required this.session});

  final GameSession session;

  @override
  Widget build(BuildContext context) {
    final String gameType = session.gameType?.trim().isNotEmpty == true
        ? session.gameType!.trim()
        : '개인';
    final String teamName = session.team?.name ?? '개인 기록';
    final List<String> memos = session.scores
        .map((GameSessionScore score) => score.memo?.trim() ?? '')
        .where((String memo) => memo.isNotEmpty)
        .toSet()
        .toList(growable: false);
    final String? activityRoute = clubActivityRouteForSession(session);

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: Key('record-session-${session.id}'),
        onTap: activityRoute == null ? null : () => context.push(activityRoute),
        child: Padding(
          padding: const EdgeInsets.all(20),
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
                        Text(
                          _formatGameDate(session.gameDate),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          '$teamName · $gameType',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (session.rank case final GameSessionRank rank) ...<Widget>[
                    const SizedBox(width: 12),
                    _RecordRankBadge(rank: rank),
                  ],
                ],
              ),
              const SizedBox(height: 14),
              SingleChildScrollView(
                key: Key('record-scores-${session.id}'),
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: session.scores
                      .map(
                        (GameSessionScore item) => Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: Container(
                            constraints: const BoxConstraints(minWidth: 48),
                            alignment: Alignment.center,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 9,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceElevated,
                              borderRadius: BorderRadius.circular(9),
                              border: Border.all(color: AppColors.divider),
                            ),
                            child: Text(
                              '${item.score}',
                              style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 17,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                      )
                      .toList(growable: false),
                ),
              ),
              const SizedBox(height: 14),
              const Divider(height: 1),
              const SizedBox(height: 16),
              Row(
                children: <Widget>[
                  Expanded(
                    child: _RecordMetric(
                      label: '게임수',
                      value: '${session.gameCount}',
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _RecordMetric(
                      label: '총점',
                      value: '${session.total}',
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _RecordMetric(
                      label: 'AVG',
                      value: session.average.toStringAsFixed(1),
                      emphasized: true,
                    ),
                  ),
                ],
              ),
              if (memos.isNotEmpty) ...<Widget>[
                const SizedBox(height: 14),
                const Divider(height: 1),
                const SizedBox(height: 12),
                if (memos.length == 1)
                  Text(
                    memos.single,
                    style: const TextStyle(color: AppColors.textSecondary),
                  )
                else
                  for (final GameSessionScore item in session.scores)
                    if (item.memo?.trim().isNotEmpty == true)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text(
                          '${item.score} · ${item.memo!.trim()}',
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _RecordRankBadge extends StatelessWidget {
  const _RecordRankBadge({required this.rank});

  final GameSessionRank rank;

  @override
  Widget build(BuildContext context) {
    final Color? medalColor = bowlingMedalColor(rank.position);
    return Semantics(
      label: '${rank.participantCount}명 중 ${rank.position}위',
      child: Container(
        key: Key('record-rank-${rank.position}'),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color:
              medalColor?.withValues(alpha: 0.12) ?? AppColors.surfaceElevated,
          borderRadius: BorderRadius.circular(13),
          border: Border.all(color: medalColor ?? AppColors.divider),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            if (medalColor != null)
              BowlingMedalIcon(
                key: Key('record-medal-${rank.position}'),
                position: rank.position,
                size: 25,
              ),
            Text(
              '${rank.position}위',
              style: TextStyle(
                color: medalColor ?? AppColors.primaryBright,
                fontSize: 17,
                fontWeight: FontWeight.w900,
              ),
            ),
            Text(
              '${rank.participantCount}명 중',
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RecordMetric extends StatelessWidget {
  const _RecordMetric({
    required this.label,
    required this.value,
    this.emphasized = false,
  });

  final String label;
  final String value;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: <Widget>[
          Text(
            label,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            maxLines: 1,
            style: TextStyle(
              color: emphasized
                  ? AppColors.primaryBright
                  : AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _SeasonRankMetric extends StatelessWidget {
  const _SeasonRankMetric({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
    decoration: BoxDecoration(
      color: AppColors.surfaceElevated,
      borderRadius: BorderRadius.circular(13),
      border: Border.all(color: AppColors.divider),
    ),
    child: Column(
      children: <Widget>[
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 14,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 7),
        Text(
          value,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: AppColors.primaryBright,
            fontSize: 20,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    ),
  );
}

String _formatGameDate(DateTime date) {
  String twoDigits(int value) => value.toString().padLeft(2, '0');
  return '${date.year}.${twoDigits(date.month)}.${twoDigits(date.day)}';
}
