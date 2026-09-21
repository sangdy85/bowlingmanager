# Mobile Capture Phase 7

## 범위

Flutter 앱의 촬영 탭에서 점수판 이미지를 카메라로 촬영하거나 갤러리에서 선택하고, 모바일 OCR API로 분석한 뒤 사용자가 결과를 검토·수정하여 여러 점수를 한 번에 저장한다. OCR 결과는 자동 저장하지 않는다.

## 기존 웹 로직 재사용

- `analyzeScoreboardWithGemini()`의 Gemini 호출, 프롬프트, 사용자별 일일 사용량 확인 및 기록을 `src/lib/scoreboard-ocr.ts`로 추출했다. 웹 Server Action과 모바일 REST API가 같은 서비스를 호출한다.
- 웹의 두 일괄 점수 저장 경로가 사용하던 팀 권한 확인, 팀원 연결, Score 생성 transaction을 `src/lib/score-bulk-service.ts`로 추출했다.
- 기존 웹 Server Action의 입력과 반환 형식은 유지한다. 웹의 팀원 이름 매칭 모드도 각각 기존 규칙을 유지한다.

## Mobile API

모든 endpoint는 기존 Mobile API 인증 helper를 사용한다. `Authorization: Bearer`가 있으면 모바일 access token을 검증하고, 없으면 기존 웹 세션을 확인한다.

### `GET /api/mobile/v1/scores/bulk/options`

현재 사용자가 팀장 또는 매니저이며 팀원으로 가입된 팀만 반환한다.

```json
{
  "success": true,
  "data": {
    "gameTypes": ["정기전", "벙개", "상주", "교류전", "기타"],
    "teams": [
      {
        "id": "team-id",
        "name": "팀 이름",
        "members": [{ "id": "user-id", "name": "표시 이름" }]
      }
    ]
  }
}
```

### `POST /api/mobile/v1/ocr/scoreboard`

`multipart/form-data`의 `image`와 `teamId`를 받는다.

- 허용 형식: JPEG, PNG, WebP
- 최대 크기: 10MB
- 선택한 팀의 등록 권한을 서버에서 다시 확인한다.
- OCR 이름이 팀 표시 이름과 정확히 한 명만 일치할 때만 `matchedMemberId`를 반환한다.
- Gemini 원문과 내부 오류는 반환하지 않는다.

```json
{
  "success": true,
  "data": {
    "players": [
      {
        "name": "회원",
        "scores": [202, 213, 208],
        "matchedMemberId": "user-id"
      }
    ]
  }
}
```

### `POST /api/mobile/v1/scores/bulk`

```json
{
  "teamId": "team-id",
  "gameDate": "2026-09-21",
  "gameType": "정기전",
  "memo": "선택 메모",
  "players": [
    {
      "name": "회원",
      "memberId": "user-id",
      "scores": [202, 213, 208]
    }
  ]
}
```

점수는 0~300 정수, 선수는 요청당 최대 50명, 선수별 게임은 최대 12개다. 전달된 `memberId`가 선택한 팀 소속인지 검증한다. `memberId`가 없으면 이름만으로 사용자를 추측하여 연결하지 않고 게스트 이름으로 저장한다. 모든 Score는 하나의 Prisma transaction에서 생성된다.

성공 시 HTTP 201을 반환한다.

```json
{
  "success": true,
  "data": {
    "createdCount": 3,
    "playerCount": 1
  }
}
```

## Flutter 흐름

1. 촬영 화면이 등록 가능한 팀과 경기 분류를 조회한다.
2. `image_picker`로 카메라 또는 갤러리 이미지를 bytes로 읽는다.
3. protected Dio가 이미지를 multipart로 업로드한다.
4. 검수 화면에서 날짜, 경기 분류, 메모, 선수 이름과 점수를 수정할 수 있다. 선수 행과 개별 게임도 삭제할 수 있고 게임을 추가할 수 있다.
5. 저장 전 이름, 메모 길이, 선수별 게임 수와 0~300 정수 점수를 다시 검증한다.
6. 저장 중 버튼을 비활성화하여 중복 요청을 막는다.
7. 성공하면 현재 사용자 키의 Dashboard와 Records provider를 invalidate하고 기록 화면으로 이동한다.

multipart 요청이 401을 받고 access token을 갱신한 경우 Dio의 `FormData.clone()`으로 새 stream을 만들어 한 번 재시도한다. 기존 single-flight refresh 및 재시도 횟수 제한은 유지한다.

## 플랫폼 설정

- Android의 `image_picker`는 별도 저장소 권한이나 카메라 권한 선언을 요구하지 않아 기존 Manifest를 유지한다.
- iOS에는 카메라와 사진 보관함 사용 목적 문구를 추가했다.
- Android 프로세스가 이미지 선택 중 종료된 경우 `retrieveLostData()`의 첫 이미지를 복구한다.

## Production E2E 전 확인

- 운영 배포 환경의 request body 제한이 10MB 이상인지 확인한다.
- 실제 점수판 사진에서 한글 이름 및 다중 게임 인식 품질을 확인한다.
- Gemini 사용량 제한 초과 시 사용자 메시지와 재시도 동작을 확인한다.
- 같은 표시 이름을 쓰는 팀원이 여러 명이면 자동 연결하지 않는지 확인한다.
- access token 만료 상태에서 multipart 업로드가 refresh 후 한 번만 재전송되는지 확인한다.
- 저장 직후 Home 통계와 Records 목록이 갱신되는지 확인한다.
