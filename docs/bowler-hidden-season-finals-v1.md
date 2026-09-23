# Bowler Hidden 시즌 최종전 V1

시즌 최종전은 고정 토너먼트가 아니라 시즌마다 다른 대진을 표현하는 DAG(Directed Acyclic Graph)다. A/B조, 와일드카드, A조 탈락자의 B조 이동, 패자부활전, 순위결정전과 결승을 같은 Node/Transition 구조로 표현한다. 특정 연도의 대진은 코드나 운영 DB에 자동 입력하지 않는다.

## 접근 정책

- Bowler Hidden이 활성화된 동호회 회원만 조회할 수 있다.
- OWNER와 MANAGER가 생성, 구조 저장, 점수 입력, Node 결과 확정을 수행한다.
- 대진 구조 잠금은 OWNER만 수행한다. 잠금 시 통합 시즌 순위의 참가자, 표시 이름, 포인트와 seed를 snapshot한다.
- API 응답은 이메일, userId, 토큰 또는 인증 정보를 포함하지 않는다.

## 데이터 모델

- `SeasonFinalTournament`: 시즌과 1:1로 연결되는 최종전 및 수명주기
- `SeasonFinalDivision`: A/B 및 향후 추가 Division
- `SeasonFinalParticipant`: 잠금 시점의 member, seed, 이름, 시즌 포인트, 선정 출처
- `SeasonFinalNode`: WILDCARD, ROUND, FINAL, LOSER_REVIVAL, PLACEMENT, SPECIAL
- `SeasonFinalTransition`: 순위 조건과 다음 Node
- `SeasonFinalNodeEntry`: 참가자의 Node 진입 출처와 원본 Node
- `SeasonFinalScore`: 참가자/게임별 0~300 점수
- `SeasonFinalNodeResult`: 확정된 합계, 평균, 순위
- `SeasonFinalTemplate`: 향후 구조 저장/복제를 위한 팀별 JSON snapshot 저장소

새 migration은 새 테이블과 인덱스만 생성한다. 기존 테이블이나 데이터를 수정하지 않는다.

## API

모든 경로는 기존 Mobile Bearer/session 인증 helper를 사용한다.

- `GET /api/mobile/v1/teams/{teamId}/season-finals`: 목록과 관리 권한
- `POST /api/mobile/v1/teams/{teamId}/season-finals`: DRAFT 생성
- `GET /api/mobile/v1/teams/{teamId}/season-finals/{finalId}`: seed, Node, Entry, Result를 포함한 현재 진행 상태
- `PUT /api/mobile/v1/teams/{teamId}/season-finals/{finalId}`: DRAFT 구조 전체 저장
- `POST /api/mobile/v1/teams/{teamId}/season-finals/{finalId}/actions`
  - `LOCK`: validator 통과 후 OWNER가 seed snapshot 및 구조 잠금
  - `START`: LOCKED 최종전 시작
  - `SAVE_SCORES`: READY/IN_PROGRESS Node의 게임 점수 upsert
  - `CONFIRM_NODE`: 순위 계산, 결과 확정, transition 멱등 실행

성공/실패 envelope는 기존 Mobile API 규격을 그대로 사용한다.

## 구조 계약

`PUT` body는 `divisions`, `nodes`, `transitions`, `seedEntries` 네 배열로 구성된다. Node는 사람이 읽는 고유 `key`로 연결하며 저장 과정에서 DB id로 변환한다. Seed entry를 later-round Node에 배정하면 bye를 표현한다. 해당 Node에 들어오는 선행 transition이 있으면 모든 선행 Node가 완료된 뒤 READY가 된다.

Transition 조건은 다음과 같다.

- `WINNER`: 1위
- `TOP_N`: `rankEnd`위까지
- `RANK_RANGE`: `rankStart`~`rankEnd`
- `ELIMINATED`: 관리자가 정한 순위 범위
- `ADMIN_DEFINED`: 관리자가 정한 순위 범위

참가 출처는 `DIRECT_SEED`, `PREVIOUS_NODE_ADVANCER`, `PREVIOUS_NODE_ELIMINATED`, `WILDCARD_WINNER`, `ADMIN_ENTRY`로 보존한다.

## Validator와 경기 실행

잠금 전 다음을 검증한다.

- Node/Division 참조 무결성, FINAL 정확히 하나
- DAG cycle 없음
- seed에서 모든 활성 Node에 도달 가능
- 같은 source Node의 transition 순위 범위 중복 없음
- placement 범위 중복 없음
- seed 중복/누락/참가자 수 초과 없음
- gameCount 1~20

점수는 서버에서 Node entry와 gameCount를 다시 검사한다. Node 결과는 total pins 내림차순, 동점이면 snapshot seed 오름차순으로 유일한 순위를 만든다. 확정과 transition entry 생성은 Serializable Prisma transaction 안에서 처리하며 `(nodeId, participantId)` unique key와 upsert로 재실행 시 중복 진입을 차단한다.

## V1 경계

현재 구현은 backend DAG 기반과 live 조회 계약을 제공한다. `SeasonFinalTemplate`의 저장/복제 API, 관리자 초대 기반 참가자 추가, 별도 reset/reopen, OCR 입력 화면, 완전 자유형 모바일 graph editor는 후속 UI/API 작업으로 남긴다. 첨부 요구 문서는 38번 Live Tournament View 예시가 `A`에서 잘렸으므로 그 이후 화면 상세 요구는 확정되지 않은 상태다.
