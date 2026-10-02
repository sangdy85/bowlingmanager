import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_finance_models.dart';
import 'package:dio/dio.dart';

class ClubFinanceApi {
  ClubFinanceApi(this._dio);
  final Dio _dio;

  Future<ClubChargesEnvelope> fetchCharges(String teamId) => _request(
    () async => ClubChargesEnvelope.fromJson(
      _data((await _dio.get<dynamic>('${_base(teamId)}/charges')).data),
    ),
  );
  Future<ClubFinanceSummary> fetchSummary(String teamId) => _request(
    () async => ClubFinanceSummary.fromJson(
      _data((await _dio.get<dynamic>('${_base(teamId)}/summary')).data),
    ),
  );
  Future<ClubChargeDetail> fetchCharge(String teamId, String chargeId) =>
      _request(
        () async => ClubChargeDetail.fromJson(
          _data(
            (await _dio.get<dynamic>(
              '${_base(teamId)}/charges/${Uri.encodeComponent(chargeId)}',
            )).data,
          ),
        ),
      );
  Future<ClubChargeDetail> createCharge(String teamId, ClubChargeDraft draft) =>
      _request(
        () async => ClubChargeDetail.fromJson(
          _data(
            (await _dio.post<dynamic>(
              '${_base(teamId)}/charges',
              data: draft.toJson(),
            )).data,
          ),
        ),
      );
  Future<ClubChargeDetail> updateCharge(
    String teamId,
    String chargeId,
    Map<String, dynamic> changes,
  ) => _request(
    () async => ClubChargeDetail.fromJson(
      _data(
        (await _dio.patch<dynamic>(
          '${_base(teamId)}/charges/${Uri.encodeComponent(chargeId)}',
          data: changes,
        )).data,
      ),
    ),
  );
  Future<ClubChargeDetail> updatePayment(
    String teamId,
    String chargeId,
    String targetId,
    ClubPaymentAction action,
  ) => _request(
    () async => ClubChargeDetail.fromJson(
      _data(
        (await _dio.patch<dynamic>(
          '${_base(teamId)}/charges/${Uri.encodeComponent(chargeId)}/targets/${Uri.encodeComponent(targetId)}',
          data: <String, dynamic>{'action': action.apiValue},
        )).data,
      ),
    ),
  );
  Future<ClubFinanceReminderResult> remindUnpaidMembers(
    String teamId,
    String chargeId,
  ) => _request(
    () async => ClubFinanceReminderResult.fromJson(
      _data(
        (await _dio.post<dynamic>(
          '${_base(teamId)}/charges/${Uri.encodeComponent(chargeId)}/reminders/unpaid',
        )).data,
      ),
    ),
  );
}

String _base(String teamId) => '/teams/${Uri.encodeComponent(teamId)}/finance';
Map<String, dynamic> _data(Object? body) {
  if (body is! Map || body['success'] != true || body['data'] is! Map) {
    throw const FormatException('Invalid API response.');
  }
  return Map<String, dynamic>.from(body['data'] as Map);
}

Future<T> _request<T>(Future<T> Function() call) async {
  try {
    return await call();
  } on DioException catch (error) {
    throw ApiException.fromDio(error);
  } on FormatException {
    throw ApiException.malformedResponse();
  } on TypeError {
    throw ApiException.malformedResponse();
  }
}
