import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/club/data/club_finance_api.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_finance_models.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('uses finance paths and exact mutation payloads', () async {
    final List<RequestOptions> requests = <RequestOptions>[];
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter((RequestOptions options) {
        requests.add(options);
        if (options.path.endsWith('/summary')) {
          return _json(200, _envelope(_summaryData()));
        }
        if (options.path.endsWith('/charges') && options.method == 'GET') {
          return _json(
            200,
            _envelope(<String, dynamic>{
              'role': 'MEMBER',
              'charges': <Object>[
                <String, dynamic>{'charge': _charge(), 'myPayment': null},
              ],
            }),
          );
        }
        return _json(200, _envelope(_detail()));
      });
    final ClubFinanceApi api = ClubFinanceApi(dio);
    await api.fetchSummary('team 1');
    await api.fetchCharges('team 1');
    await api.fetchCharge('team 1', 'charge/1');
    await api.createCharge(
      'team 1',
      const ClubChargeDraft(
        type: ClubChargeType.monthlyDues,
        title: '회비',
        amount: 30000,
        dueDate: '2026-10-10',
        targetMemberIds: <String>['m1'],
      ),
    );
    await api.updateCharge('team 1', 'charge/1', <String, dynamic>{
      'status': 'OPEN',
    });
    await api.updatePayment(
      'team 1',
      'charge/1',
      'target/1',
      ClubPaymentAction.markPaid,
    );
    expect(
      requests.map((RequestOptions r) => '${r.method} ${r.path}'),
      containsAll(<String>[
        'GET /teams/team%201/finance/summary',
        'GET /teams/team%201/finance/charges',
        'GET /teams/team%201/finance/charges/charge%2F1',
        'POST /teams/team%201/finance/charges',
        'PATCH /teams/team%201/finance/charges/charge%2F1',
        'PATCH /teams/team%201/finance/charges/charge%2F1/targets/target%2F1',
      ]),
    );
    expect((requests[3].data as Map)['targetMemberIds'], <String>['m1']);
    expect((requests.last.data as Map)['action'], 'MARK_PAID');
  });

  test('maps server and malformed privacy errors', () async {
    Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter(
        (_) => _json(403, <String, dynamic>{
          'success': false,
          'error': <String, dynamic>{
            'code': 'FINANCE_FORBIDDEN',
            'message': 'forbidden',
          },
        }),
      );
    await expectLater(
      ClubFinanceApi(dio).fetchSummary('team'),
      throwsA(
        isA<ApiException>().having(
          (ApiException e) => e.code,
          'code',
          'FINANCE_FORBIDDEN',
        ),
      ),
    );
    dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter(
        (_) => _json(
          200,
          _envelope(<String, dynamic>{
            'role': 'MEMBER',
            'charges': <Object>[
              <String, dynamic>{
                'charge': _charge(),
                'myPayment': null,
                'targets': <Object>[],
              },
            ],
          }),
        ),
      );
    await expectLater(
      ClubFinanceApi(dio).fetchCharges('team'),
      throwsA(
        isA<ApiException>().having(
          (ApiException e) => e.kind,
          'kind',
          ApiErrorKind.malformedResponse,
        ),
      ),
    );
  });
}

Map<String, dynamic> _envelope(Map<String, dynamic> data) => <String, dynamic>{
  'success': true,
  'data': data,
};
Map<String, dynamic> _summaryData() => <String, dynamic>{
  'role': 'OWNER',
  'charges': <String, int>{
    'total': 1,
    'draft': 1,
    'open': 0,
    'closed': 0,
    'cancelled': 0,
  },
  'totals': _summary(),
};
Map<String, dynamic> _detail() => <String, dynamic>{
  'role': 'OWNER',
  'charge': _charge()..['status'] = 'DRAFT',
  'summary': _summary(),
  'targets': <Object>[_target()],
};
Map<String, dynamic> _charge() => <String, dynamic>{
  'id': 'charge-1',
  'eventId': null,
  'type': 'MONTHLY_DUES',
  'title': '회비',
  'amount': 30000,
  'dueDate': '2026-10-10',
  'status': 'OPEN',
  'memo': null,
  'createdAt': '2026-10-01T00:00:00Z',
  'updatedAt': '2026-10-01T00:00:00Z',
};
Map<String, dynamic> _summary() => <String, dynamic>{
  'targetCount': 1,
  'paidCount': 0,
  'unpaidCount': 1,
  'waivedCount': 0,
  'expectedAmount': 30000,
  'paidAmount': 0,
  'unpaidAmount': 30000,
  'waivedAmount': 0,
};
Map<String, dynamic> _target() => <String, dynamic>{
  'id': 'target-1',
  'targetType': 'MEMBER',
  'memberId': 'member-1',
  'displayName': '회원',
  'amount': 30000,
  'status': 'UNPAID',
  'paidAt': null,
  'createdAt': '2026-10-01T00:00:00Z',
  'updatedAt': '2026-10-01T00:00:00Z',
  'audits': <Object>[],
};

class _Adapter implements HttpClientAdapter {
  _Adapter(this.handler);
  final ResponseBody Function(RequestOptions options) handler;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => handler(options);
  @override
  void close({bool force = false}) {}
}

ResponseBody _json(int status, Object body) => ResponseBody.fromString(
  jsonEncode(body),
  status,
  headers: <String, List<String>>{
    Headers.contentTypeHeader: <String>[Headers.jsonContentType],
  },
);
