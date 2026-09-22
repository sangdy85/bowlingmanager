import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_providers.dart';
import 'package:bowlingmanager_mobile/features/club/application/club_records_state.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_records_models.dart';
import 'package:bowlingmanager_mobile/features/club/presentation/club_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClubRecordsScreen extends ConsumerStatefulWidget {
  const ClubRecordsScreen({required this.teamId, super.key});

  final String teamId;

  @override
  ConsumerState<ClubRecordsScreen> createState() => _ClubRecordsScreenState();
}

class _ClubRecordsScreenState extends ConsumerState<ClubRecordsScreen> {
  late int _year;
  ClubRecordFilter _filter = ClubRecordFilter.regular;
  int _section = 0;

  @override
  void initState() {
    super.initState();
    _year = DateTime.now().year;
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
        SizedBox(
          height: 48,
          child: ListView.separated(
            key: const Key('club-record-filters'),
            padding: const EdgeInsets.symmetric(horizontal: 20),
            scrollDirection: Axis.horizontal,
            itemCount: ClubRecordFilter.values.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (BuildContext context, int index) {
              final ClubRecordFilter filter = ClubRecordFilter.values[index];
              return ChoiceChip(
                label: Text(filter.label),
                selected: filter == _filter,
                onSelected: (_) => setState(() => _filter = filter),
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: SegmentedButton<int>(
            segments: const <ButtonSegment<int>>[
              ButtonSegment<int>(
                value: 0,
                icon: Icon(Icons.query_stats_rounded),
                label: Text('팀원 통계'),
              ),
              ButtonSegment<int>(
                value: 1,
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
        Expanded(
          child: _section == 0
              ? _StatisticsBody(request: request, value: statistics)
              : _ActivitiesBody(request: request),
        ),
      ],
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
              for (final ClubMemberStatistics member in data.members) ...[
                _MemberStatisticsCard(member: member),
                const SizedBox(height: 12),
              ],
          ],
        ),
      ),
    );
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
            _Metric(label: '게임', value: '${summary.gameCount}'),
            _Metric(label: '총점', value: _number(summary.total)),
            _Metric(label: 'AVG', value: summary.average.toStringAsFixed(1)),
          ],
        ),
      ),
    );
  }
}

class _MemberStatisticsCard extends StatelessWidget {
  const _MemberStatisticsCard({required this.member});

  final ClubMemberStatistics member;

  @override
  Widget build(BuildContext context) {
    return Card(
      key: Key('club-stat-member-${member.id}'),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              member.name,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            Text(
              '출석 ${member.attendanceRate.toStringAsFixed(1)}% · '
              '${member.attended}/${member.activityCount}',
              style: const TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 20,
              runSpacing: 8,
              children: <Widget>[
                Text('${member.gameCount}게임'),
                Text('총점 ${_number(member.total)}'),
                Text(
                  'AVG ${member.average.toStringAsFixed(1)}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text(
              '월별 AVG',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: List<Widget>.generate(12, (int index) {
                  final int? average = member.monthlyAverages[index];
                  return Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 11,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: Text('${index + 1}월 ${average ?? '-'}'),
                  );
                }),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActivitiesBody extends ConsumerWidget {
  const _ActivitiesBody({required this.request});

  final ClubStatisticsRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = clubActivitiesControllerProvider(request);
    final AsyncValue<ClubActivitiesState> value = ref.watch(provider);
    final ClubActivitiesController controller = ref.read(provider.notifier);
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
      data: (ClubActivitiesState data) => RefreshIndicator(
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
              const _EmptyCard(message: '선택한 조건의 활동 기록이 없습니다.')
            else
              for (final ClubActivity activity in data.items) ...[
                _ActivityCard(teamId: request.teamId, activity: activity),
                const SizedBox(height: 12),
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

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({required this.teamId, required this.activity});

  final String teamId;
  final ClubActivity activity;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        key: Key('club-activity-${activity.id}'),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 10,
        ),
        title: Text(
          activity.gameType?.trim().isNotEmpty == true
              ? activity.gameType!
              : '기록',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 7),
          child: Text(
            '${_date(activity.date)}\n'
            '${activity.participantCount}명 · ${activity.gameCount}게임 · '
            'Daily AVG ${activity.dailyAverage.toStringAsFixed(1)}',
          ),
        ),
        isThreeLine: true,
        trailing: const Icon(Icons.chevron_right_rounded),
        onTap: () => context.push(
          '/club/${Uri.encodeComponent(teamId)}/records/'
          '${Uri.encodeComponent(activity.id)}',
        ),
      ),
    );
  }
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
