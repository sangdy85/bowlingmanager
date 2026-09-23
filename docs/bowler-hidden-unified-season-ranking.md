# Bowler Hidden 통합 시즌 종합순위

## 범위

Bowler Hidden이 활성화된 동호회의 `INDIVIDUAL`, `TEAM`, `EVENT` 대회 결과를 개인별 시즌 포인트로 환산한다. 공식 순위에는 `PUBLISHED` 결과로 생성된 활성 ledger만 포함한다. 기존 정기전 통계와 TEAM 경기별 내부 포인트 계산은 유지한다.

## 시즌과 포인트표

`TeamSeason`은 `DRAFT`, `ACTIVE`, `COMPLETED` 상태와 시작일·종료일을 가진다. 한 팀의 과거 시즌은 삭제하지 않고 조회할 수 있다. 시즌마다 아래 세 포인트표를 독립적으로 저장한다.

- `individualPointsConfig`: 개인전 최종 개인 순위
- `teamPointsConfig`: TEAM 대회 최종 팀 순위
- `eventPointsConfig`: 실제 핀과 비밀 투표 보너스를 합산한 EVENT 최종 개인 순위

포인트표는 `{ rank, points }` 목록으로 API에 노출하며 DB에는 JSON snapshot으로 저장한다. 기존 `pointsConfig`는 호환성을 위해 유지하며 migration 시 세 유형의 초기 설정으로 복사한다. 이후 한 시즌의 설정을 변경해도 이미 발표된 결과는 publication snapshot과 ledger가 보존하므로 조용히 바뀌지 않는다.

TEAM의 `rankPoints`와 게임 결과의 `totalPoints`는 게임별 팀 순위를 만드는 내부 포인트다. `SeasonPointEntry.points`는 최종 팀 순위를 시즌 포인트표에 대입한 개인별 시즌 포인트다. 두 값을 같은 필드나 계산에 사용하지 않는다.

## 대회 연결과 발표 lifecycle

`TeamEvent.seasonId`가 대회와 시즌을 연결한다. 연결되지 않은 대회를 발표할 때는 대회 날짜를 포함하는 `ACTIVE` 시즌을 서버가 선택하고 같은 transaction 안에서 연결한다. 기간 밖이거나 활성 시즌이 없으면 발표를 거부한다.

1. 발표 전 결과는 현재 점수와 해당 시즌의 유형별 포인트표로 preview한다.
2. `PUBLISH`가 성공하면 결과와 포인트표를 `SeasonPointPublication`에 snapshot으로 저장한다.
3. 참가자별 지급 내역을 `SeasonPointEntry`에 저장한다.
4. 이미 발표된 대회의 `PUBLISH`는 성공 상태를 그대로 반환하며 추가 지급하지 않는다.
5. `REOPEN`은 기존 publication의 `revokedAt`을 기록하고 대회의 publication revision을 증가시킨다.
6. 점수를 수정한 뒤 다시 `PUBLISH`하면 새 revision과 새 ledger를 생성한다. 이전 snapshot과 ledger는 감사 기록으로 남지만 공식 합계에서 제외된다.

발표와 ledger 저장, 대회 상태 변경은 같은 Prisma transaction에서 처리한다. `(seasonId, sourceKey, revision)`, 활성 `(seasonId, sourceKey)`, `(publicationId, memberId)` unique 제약으로 동시 요청과 중복 지급을 방어한다.

## 유형별 지급

- 개인전: 참석 회원별 총점 최종 순위에 따라 각 회원에게 지급한다.
- TEAM: 최종 팀 순위를 확정한 뒤 captain 여부와 무관하게 해당 팀의 모든 회원에게 같은 시즌 포인트를 지급한다. 게임 내부 동점과 최종 팀 동점 정책은 별도다. 최종 팀 포인트가 같을 때 관리자가 유효 핀, 원점수 핀, 고정 팀 ID 중 정책을 선택한다.
- EVENT: 실제 핀과 3인 비밀 투표 share bonus로 만든 `finalScore` 최종 순위에 따라 지급한다.

## 순위와 월별 이력

시즌 합계는 활성 publication의 `SeasonPointEntry.points` 합이다. 합계 내림차순이며 동점은 competition ranking 방식의 공동 순위다. 예를 들어 동일한 105점 두 명 다음은 3위다.

랭킹 응답은 전체·개인전·팀전·이벤트전 필터를 지원하며 다음을 포함한다.

- 유형별 포인트와 참가 대회 수
- 유형별 우승 수
- 1월부터 12월까지 월별 ledger 목록
- 같은 달의 복수 대회 기록
- 대회 ID, 제목, 날짜, 최종 순위, 획득 포인트

월은 경기 시각을 KST로 변환해 계산한다. Flutter는 왼쪽에 순위·이름·합계를 고정하고 월별 열만 가로 스크롤한다. 회원을 선택하면 획득 내역을 보고 연결된 대회 상세로 이동할 수 있다.

## 권한과 개인정보

랭킹과 회원 시즌 상세는 현재 팀 회원만 조회할 수 있다. Bowler Hidden 기능이 꺼진 팀에는 시즌 UI를 노출하지 않는다. 일반 시즌 설정과 포인트표는 OWNER와 MANAGER가 관리하며 기능 활성화 권한은 기존 SUPER_ADMIN 정책을 유지한다.

응답에는 TeamMember의 안정된 ID와 기존 alias 우선 표시 이름만 포함한다. 이메일, 사용자 ID, OAuth 정보, 토큰은 포함하지 않는다. 시즌 랭킹은 팀·시즌 범위의 ledger를 한 번에 조회하고 메모리에서 aggregate하므로 회원별 대회 조회 N+1이 없다.

## 과거 자료 import 준비

`SeasonPointPublication.eventId`는 nullable이고 `sourceKey`는 대회 외의 안정된 원본 키를 담을 수 있다. 따라서 향후 2022~2026 운영표를 별도 import 작업에서 publication과 ledger로 적재할 수 있다. 이번 변경은 이미지나 Excel을 읽어 운영 DB에 자동 반영하지 않는다.

## API

- `GET /api/mobile/v1/teams/{teamId}/seasons`
- `GET /api/mobile/v1/teams/{teamId}/season-ranking?seasonId=...&type=ALL|INDIVIDUAL|TEAM|EVENT`
- `GET /api/mobile/v1/teams/{teamId}/season-ranking/members/{memberId}?seasonId=...&type=...`
- `POST /api/mobile/v1/teams/{teamId}/events/{eventId}/competition` (`PUBLISH`, `REOPEN`)
- `POST /api/mobile/v1/teams/{teamId}/events/{eventId}/competition/team` (`PUBLISH`, `REOPEN`)
- `POST /api/mobile/v1/teams/{teamId}/events/{eventId}/competition/event` (`PUBLISH`, `REOPEN`)

Migration은 새 column, table, index만 추가한다. 기존 migration을 수정하지 않으며 운영 DB 적용과 과거 자료 import는 별도 배포 단계에서 수행한다.
