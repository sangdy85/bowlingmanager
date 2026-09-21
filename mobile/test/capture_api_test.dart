import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/capture/data/capture_api.dart';
import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/capture_fakes.dart';

void main() {
  test('fetches score entry options', () async {
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter((RequestOptions options) {
        expect(options.path, '/scores/bulk/options');
        return _json(200, <String, Object>{
          'success': true,
          'data': <String, Object>{
            'gameTypes': <String>['정기전'],
            'teams': <Object>[
              <String, Object>{
                'id': 'team-1',
                'name': '테스트 팀',
                'members': <Object>[],
              },
            ],
          },
        });
      });

    final CaptureOptions result = await MobileCaptureApi(dio).fetchOptions();
    expect(result.teams.single.id, 'team-1');
  });

  test(
    'uploads image as multipart and parses normalized OCR response',
    () async {
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
        ..httpClientAdapter = _Adapter((RequestOptions options) {
          expect(options.path, '/ocr/scoreboard');
          expect(options.data, isA<FormData>());
          final FormData data = options.data as FormData;
          expect(
            Map<String, String>.fromEntries(data.fields)['teamId'],
            'team-1',
          );
          expect(data.files.single.key, 'image');
          expect(data.files.single.value.filename, 'synthetic.jpg');
          return _json(200, <String, Object>{
            'success': true,
            'data': <String, Object>{
              'players': <Object>[
                <String, Object?>{
                  'name': '회원',
                  'scores': <int>[201, 210],
                  'matchedMemberId': 'member-1',
                },
              ],
            },
          });
        });

      final List<OcrPlayer> result = await MobileCaptureApi(dio)
          .analyze(teamId: 'team-1', image: testCaptureImage);
      expect(result.single.scores, <int>[201, 210]);
      expect(result.single.matchedMemberId, 'member-1');
    },
  );

  test('sends reviewed score payload and parses save counts', () async {
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter((RequestOptions options) {
        expect(options.path, '/scores/bulk');
        final Map<String, dynamic> data = Map<String, dynamic>.from(
          options.data as Map,
        );
        expect(data['teamId'], 'team-1');
        final List<dynamic> players = data['players'] as List<dynamic>;
        expect((players.single as Map<String, dynamic>)['scores'], <int>[200]);
        return _json(201, <String, Object>{
          'success': true,
          'data': <String, Object>{'createdCount': 1, 'playerCount': 1},
        });
      });

    final BulkSaveResult result = await MobileCaptureApi(dio).save(
      teamId: 'team-1',
      gameDate: '2026-09-21',
      gameType: '정기전',
      memo: null,
      players: const <CapturePlayerDraft>[
        CapturePlayerDraft(
          name: '회원',
          scoreTexts: <String>['200'],
          memberId: 'member-1',
        ),
      ],
    );
    expect(result.createdCount, 1);
  });

  test('maps API errors and malformed OCR responses', () async {
    Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter(
        (_) => _json(422, <String, Object>{
          'success': false,
          'error': <String, Object>{
            'code': 'OCR_NO_RESULTS',
            'message': '점수를 찾지 못했습니다.',
          },
        }),
      );
    await expectLater(
      MobileCaptureApi(dio).analyze(teamId: 'team-1', image: testCaptureImage),
      throwsA(
        isA<ApiException>().having(
          (ApiException error) => error.code,
          'code',
          'OCR_NO_RESULTS',
        ),
      ),
    );

    dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _Adapter(
        (_) => _json(200, <String, Object>{
          'success': true,
          'data': <String, Object>{'players': <Object>[]},
        }),
      );
    await expectLater(
      MobileCaptureApi(dio).analyze(teamId: 'team-1', image: testCaptureImage),
      throwsA(
        isA<ApiException>().having(
          (ApiException error) => error.kind,
          'kind',
          ApiErrorKind.malformedResponse,
        ),
      ),
    );
  });
}

ResponseBody _json(int statusCode, Object body) => ResponseBody.fromString(
  jsonEncode(body),
  statusCode,
  headers: <String, List<String>>{
    Headers.contentTypeHeader: <String>[Headers.jsonContentType],
  },
);

class _Adapter implements HttpClientAdapter {
  _Adapter(this.handler);

  final FutureOr<ResponseBody> Function(RequestOptions) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => handler(options);

  @override
  void close({bool force = false}) {}
}
