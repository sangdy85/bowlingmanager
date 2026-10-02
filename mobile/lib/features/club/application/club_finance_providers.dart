import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/auth/application/auth_providers.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_finance_api.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_finance_repository.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_finance_models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

typedef ClubFinanceRequest = ({String userId, String teamId});
typedef ClubChargeRequest = ({String userId, String teamId, String chargeId});

final clubFinanceApiProvider = Provider<ClubFinanceApi>(
  (Ref ref) => ClubFinanceApi(ref.watch(apiClientProvider).dio),
);
final clubFinanceRepositoryProvider = Provider<ClubFinanceRepository>(
  (Ref ref) => ClubFinanceRepository(ref.watch(clubFinanceApiProvider)),
);
final clubChargesProvider = FutureProvider.autoDispose
    .family<ClubChargesEnvelope, ClubFinanceRequest>(
      (Ref ref, request) =>
          ref.watch(clubFinanceRepositoryProvider).fetchCharges(request.teamId),
      retry: (int _, Object _) => null,
    );
final clubFinanceSummaryProvider = FutureProvider.autoDispose
    .family<ClubFinanceSummary, ClubFinanceRequest>(
      (Ref ref, request) =>
          ref.watch(clubFinanceRepositoryProvider).fetchSummary(request.teamId),
      retry: (int _, Object _) => null,
    );
final clubChargeProvider = FutureProvider.autoDispose
    .family<ClubChargeDetail, ClubChargeRequest>(
      (Ref ref, request) => ref
          .watch(clubFinanceRepositoryProvider)
          .fetchCharge(request.teamId, request.chargeId),
      retry: (int _, Object _) => null,
    );

void invalidateClubFinance(
  WidgetRef ref,
  ClubFinanceRequest request, {
  String? chargeId,
}) {
  ref.invalidate(clubChargesProvider(request));
  ref.invalidate(clubFinanceSummaryProvider(request));
  if (chargeId != null) {
    ref.invalidate(
      clubChargeProvider((
        userId: request.userId,
        teamId: request.teamId,
        chargeId: chargeId,
      )),
    );
  }
}

String clubFinanceErrorMessage(Object error) {
  if (error is! ApiException) return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.';
  return switch (error.code) {
    'FINANCE_FORBIDDEN' => '회비 관리 권한이 없습니다.',
    'TEAM_NOT_FOUND' => '동호회를 찾을 수 없습니다.',
    'CHARGE_NOT_FOUND' => '회비 항목을 찾을 수 없습니다.',
    'TARGET_NOT_FOUND' => '납부 대상을 찾을 수 없습니다.',
    'CHARGE_LOCKED' => '이미 납부 처리가 있어 이 항목은 수정할 수 없습니다.',
    'CHARGE_NOT_OPEN' => '공개 중인 항목만 납부 상태를 변경할 수 있습니다.',
    'CHARGE_CLOSED' => '마감되거나 취소된 항목은 수정할 수 없습니다.',
    'INVALID_AMOUNT' => '금액을 다시 확인해주세요.',
    'INVALID_TITLE' => '제목을 다시 확인해주세요.',
    'INVALID_DUE_DATE' => '납부기한을 다시 확인해주세요.',
    'INVALID_TARGET' || 'DUPLICATE_TARGET' => '납부 대상을 다시 확인해주세요.',
    'EVENT_NOT_FOUND' => '선택한 일정을 찾을 수 없습니다.',
    'INVALID_CHARGE_TRANSITION' ||
    'INVALID_PAYMENT_TRANSITION' => '현재 상태에서는 요청한 변경을 할 수 없습니다.',
    _ when error.code != null => '요청한 내용을 확인해주세요.',
    _ => error.userMessage,
  };
}
