import 'package:bowlingmanager_mobile/features/club/data/club_finance_api.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_finance_models.dart';

class ClubFinanceRepository {
  ClubFinanceRepository(this._api);
  final ClubFinanceApi _api;
  Future<ClubChargesEnvelope> fetchCharges(String teamId) =>
      _api.fetchCharges(teamId);
  Future<ClubFinanceSummary> fetchSummary(String teamId) =>
      _api.fetchSummary(teamId);
  Future<ClubChargeDetail> fetchCharge(String teamId, String chargeId) =>
      _api.fetchCharge(teamId, chargeId);
  Future<ClubChargeDetail> createCharge(String teamId, ClubChargeDraft draft) =>
      _api.createCharge(teamId, draft);
  Future<ClubChargeDetail> updateCharge(
    String teamId,
    String chargeId,
    Map<String, dynamic> changes,
  ) => _api.updateCharge(teamId, chargeId, changes);
  Future<ClubChargeDetail> updatePayment(
    String teamId,
    String chargeId,
    String targetId,
    ClubPaymentAction action,
  ) => _api.updatePayment(teamId, chargeId, targetId, action);
}
