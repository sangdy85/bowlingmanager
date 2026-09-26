import 'dart:convert';
import 'dart:typed_data';

import 'package:bowlingmanager_mobile/features/club/data/club_expansion_api.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_legacy_csv.dart';
import 'package:bowlingmanager_mobile/features/club/domain/club_legacy_import_models.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses detailed CSV while retaining names for explicit mapping', () {
    final document = parseClubLegacyCsv(
      'member,month,competitionType,placement,points,note\n'
      '홍길동,2026-01,TEAM,3,10,1월 팀전\n'
      '김수원,2026-02,INDIVIDUAL,3,30,\n',
    );
    expect(document.mode, 'DETAILED');
    expect(document.rows, hasLength(2));
    expect(document.rows.first.memberLabel, '홍길동');
    expect(document.rows.first.points, 10);
    expect(document.rows.first.competitionType, 'TEAM');
  });

  test('parses opening balance CSV without inventing competition rows', () {
    final document = parseClubLegacyCsv('member,points\n홍길동,218\n김수원,215\n');
    expect(document.mode, 'OPENING_BALANCE');
    expect(document.rows.first.eventDate, isNull);
    expect(document.rows.first.competitionType, isNull);
    expect(document.rows.first.placement, isNull);
  });

  test('rejects malformed detailed CSV', () {
    expect(
      () => parseClubLegacyCsv('member,month,points\n홍길동,2026-01,10\n'),
      throwsFormatException,
    );
  });

  test(
    'preview, commit, list and reversal use season-scoped protected paths',
    () async {
      final hash = List<String>.filled(64, 'a').join();
      final requests = <RequestOptions>[];
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
        ..httpClientAdapter = _Adapter((options) {
          requests.add(options);
          final data = switch ((options.method, options.path)) {
            ('POST', '/teams/team-1/seasons/season-1/legacy-imports/preview') =>
              <String, Object?>{
                'mode': 'DETAILED',
                'importHash': hash,
                'summary': <String, int>{
                  'totalRows': 1,
                  'matchedRows': 1,
                  'needsConfirmation': 0,
                  'errors': 0,
                  'totalPoints': 10,
                },
                'memberChanges': <Object>[
                  <String, Object>{
                    'memberId': 'member-1',
                    'memberName': '홍길동',
                    'previousPoints': 0,
                    'importedPoints': 10,
                    'totalPoints': 10,
                  },
                ],
              },
            ('GET', '/teams/team-1/seasons/season-1/legacy-imports') =>
              <String, Object?>{'batches': <Object>[]},
            _ => <String, Object?>{'batchId': 'batch-1', 'reversed': true},
          };
          return _json(<String, Object?>{'success': true, 'data': data});
        });
      final api = ClubExpansionApi(dio);
      final rows = <ClubLegacyImportRow>[
        const ClubLegacyImportRow(
          memberId: 'member-1',
          eventDate: '2026-01',
          competitionType: 'TEAM',
          placement: 3,
          points: 10,
        ),
      ];
      final preview = await api.previewSeasonLegacyImport(
        'team-1',
        'season-1',
        mode: 'DETAILED',
        rows: rows,
      );
      await api.createSeasonLegacyImport(
        'team-1',
        'season-1',
        mode: 'DETAILED',
        rows: rows,
        importHash: preview.importHash,
      );
      await api.fetchSeasonLegacyImports('team-1', 'season-1');
      await api.reverseSeasonLegacyImport(
        'team-1',
        'season-1',
        'batch-1',
        '잘못된 파일',
      );
      expect(
        requests.map((request) => '${request.method} ${request.path}'),
        <String>[
          'POST /teams/team-1/seasons/season-1/legacy-imports/preview',
          'POST /teams/team-1/seasons/season-1/legacy-imports',
          'GET /teams/team-1/seasons/season-1/legacy-imports',
          'POST /teams/team-1/seasons/season-1/legacy-imports/batch-1/reverse',
        ],
      );
      expect((requests[1].data as Map)['importHash'], hash);
    },
  );
}

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

ResponseBody _json(Map<String, Object?> value) => ResponseBody.fromString(
  jsonEncode(value),
  200,
  headers: <String, List<String>>{
    Headers.contentTypeHeader: <String>['application/json'],
  },
);
