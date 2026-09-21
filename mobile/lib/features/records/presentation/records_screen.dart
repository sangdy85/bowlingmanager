import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/auth/domain/auth_user.dart';
import 'package:bowlingmanager_mobile/features/records/application/records_providers.dart';
import 'package:bowlingmanager_mobile/features/records/application/records_state.dart';
import 'package:bowlingmanager_mobile/features/records/domain/score_record.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
  });

  final RecordsState state;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onLoadMore;

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
          const SizedBox(height: 24),
          if (state.refreshErrorMessage case final String message) ...<Widget>[
            _InlineError(message: message, onRetry: onRefresh),
            const SizedBox(height: 12),
          ],
          if (state.items.isEmpty)
            const _EmptyRecords()
          else
            for (final ScoreRecord record in state.items) ...<Widget>[
              _RecordCard(record: record),
              const SizedBox(height: 12),
            ],
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
        padding: const EdgeInsets.all(20),
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
  const _RecordCard({required this.record});

  final ScoreRecord record;

  @override
  Widget build(BuildContext context) {
    final List<String> details = <String>[
      if (record.gameType?.trim().isNotEmpty == true) record.gameType!.trim(),
      if (record.team case final ScoreTeam team) team.name,
    ];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: <Widget>[
                Text(
                  _formatGameDate(record.gameDate),
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (details.isNotEmpty)
                  Flexible(
                    child: Text(
                      details.join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 18),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: <Widget>[
                Text(
                  '${record.score}',
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 36,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(width: 7),
                const Padding(
                  padding: EdgeInsets.only(bottom: 5),
                  child: Text(
                    '점',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                ),
              ],
            ),
            if (record.memo?.trim().isNotEmpty == true) ...<Widget>[
              const SizedBox(height: 14),
              const Divider(height: 1),
              const SizedBox(height: 12),
              Text(
                record.memo!.trim(),
                style: const TextStyle(color: AppColors.textSecondary),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

String _formatGameDate(DateTime date) {
  String twoDigits(int value) => value.toString().padLeft(2, '0');
  return '${date.year}.${twoDigits(date.month)}.${twoDigits(date.day)}';
}
