# Mobile Phase 12: 동호회 기록 및 활동 일지

## 웹 기준 계산 규칙

Phase 12는 `src/app/team/[teamId]/page.tsx`, `TeamStatsContainer`,
`TeamYearlyStats`, `DailyScoreTable`의 기존 계산을 기준으로 한다.

- 기본 연도는 현재 연도이며, 선택 목록은 실제 `Score.gameDate` 연도 내림차순이다.
  선택 연도에 기록이 없어도 해당 연도는 목록 맨 앞에 둔다.
- 기본 게임 분류는 `정기전`이다. 분류는 `정기전`, `벙개`, `상주`,
  `교류전`, `기타`이며 `gameType == null`은 `기타`로 분류한다.
  위 다섯 값에 속하지 않는 기존 데이터는 웹 체크박스와 같이 제외한다.
- 팀원 통계에는 `userId`가 있는 점수만 포함한다. 이름은 현재 팀 membership의
  `alias || user.name`이고, 탈퇴 회원은 점수에 연결된 사용자 이름을 사용한다.
- 출석률 분모는 필터를 통과한 점수가 있는 날짜 수다. guest-only 날짜도 분모에
  포함한다. 분자는 해당 회원의 서로 다른 참가 날짜 수다.
- 월별 평균은 해당 월 점수의 산술 평균을 정수로 반올림한다. 전체 평균과 출석률은
  소수 첫째 자리로 반올림한다. 활동 상세의 참가자 평균은 웹과 같이 정수 또는 최대
  소수 둘째 자리까지 유지한다.
- 활동 일지는 필터를 통과한 점수를 KST 달력 날짜별로 묶는다. 웹과 동일하게
  날짜가 grouping key이며, 한 날짜에 여러 분류가 선택된 경우 분리하지 않는다.
  이때 활동 제목의 gameType은 웹처럼 조회 순서에서 처음 발견되는 비어 있지 않은
  gameType이다. 따라서 `ALL`의 혼합 활동은 제목 하나가 전체 구성 분류를 뜻하지 않는다.
- 참가자는 회원 `userId` 또는 guest 이름으로 묶는다. guest는 회원과 자동 연결하지
  않고 `(비)` 표시를 유지한다.
- 상세 순위는 참가자 총점 내림차순이다. 웹은 동점 공동 순위를 계산하지 않고 정렬된
  화면 순서대로 1위, 2위처럼 연속 순위를 부여한다.

## API

- `GET /api/mobile/v1/teams/:teamId/statistics?year=2026&type=REGULAR`
- `GET /api/mobile/v1/teams/:teamId/activities?year=2026&type=REGULAR&page=1&limit=20`
- `GET /api/mobile/v1/teams/:teamId/activities/:activityId`

필터 코드는 `ALL`, `REGULAR`, `CASUAL`, `HOUSE`, `INTERCLUB`, `OTHER`다.
활동 ID는 KST 날짜와 필터 코드를 포함하며 상세 조회에서 다시 검증한다.
따라서 `REGULAR` 목록에서 연 상세에는 같은 날짜의 `벙개`가 섞이지 않는다.

Phase 11 개인 경기 grouping은 기존 계약대로 UTC 날짜를 사용하지만, Phase 12 팀 활동은
웹 `TeamStatsContainer`가 UTC 시각에 9시간을 더하는 방식을 그대로 따라 KST 날짜를
사용한다. 이 차이는 각 화면의 기존 데이터 계약을 보존하기 위한 의도된 차이다.

모든 endpoint는 인증된 사용자가 활성 팀의 `TeamMember`인지 서버에서 확인한다.
팀 URL만으로 접근할 수 없으며 SUPER_ADMIN도 membership이 없으면 모바일 내 동호회
기록에 접근할 수 없다. 응답에는 이메일, 사용자 DB ID, 초대 코드, 인증 정보를
포함하지 않는다. 참가자 ID는 현재 membership ID 또는 원본 식별자를 노출하지 않는
불투명 ID다.

활동 목록은 Score row가 아니라 날짜별 활동을 모두 구성한 뒤 페이지를 나눈다.
따라서 하나의 활동이 페이지 경계에서 분리되지 않는다. 연도 범위 점수와 회원은 각각
한 번 조회하고 메모리에서 집계하여 회원별 N+1 조회를 만들지 않는다.

## Flutter

동호회 상세에서 `기록 및 활동 일지`로 이동한다. 기록 화면은 연도 선택, 게임 분류
필터, `팀원 통계`와 `활동 일지` segment를 제공한다. 팀원 통계는 회원 카드와 가로
스크롤 월별 평균으로 표시한다. 활동 일지는 최신순 카드, pull-to-refresh, 경기 단위
pagination과 재시도를 제공한다. 상세 화면은 참가자의 가변 게임 점수, 총점, 평균,
순위를 표시한다.

Provider key에는 사용자 ID, 팀 ID, 연도, 필터를 포함한다. 상세 key에는 사용자 ID,
팀 ID, 활동 ID를 포함해 로그아웃이나 계정 전환 뒤 다른 사용자의 cache가 노출되지
않게 한다. 회원 개별 상세 연결은 이번 핵심 범위를 늘리므로 Phase 12.1 후보로 남긴다.
