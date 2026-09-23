# Bowler Hidden TEAM Competition V1

## 기능 게이트와 권한

`Team.bowlerHiddenEnabled=true`인 팀만 TEAM 대회를 만들고 조회하거나 변경할 수 있다. 플래그는 기존과 같이 현재 DB 역할이 `SUPER_ADMIN`인 계정만 변경한다. 모바일의 OWNER/MANAGER/Captain은 플래그를 바꿀 수 없다.

- OWNER/MANAGER: 참석 마감, 팀장·순서 지정, 드래프트 시작·초기화, 레인 배정
- Captain: 해당 대회의 현재 draft turn에서만 선수 선택
- MEMBER: 참석 응답, 드래프트 관전, 팀·레인·결과 조회

Captain 권한은 이 대회의 draft pick에만 적용되며 팀 관리나 점수 관리 권한을 부여하지 않는다. API 응답에는 팀 내부 표시 이름과 `TeamMember.id`만 포함하고 이메일, 사용자 ID, OAuth 정보와 토큰은 포함하지 않는다.

## 서버 상태 전이

서버가 다음 상태 전이를 관리한다.

1. `ATTENDANCE_OPEN`
2. `ATTENDANCE_LOCKED`
3. `DRAFT_READY`
4. `DRAFT_IN_PROGRESS`
5. `TEAMS_FINALIZED`
6. `LANES_ASSIGNED`

참석 마감 이후에는 참석자와 일정 설정을 변경할 수 없다. 클라이언트가 다음 turn이나 상태를 결정하지 않는다. Flutter는 `DRAFT_IN_PROGRESS`인 동안에만 3초 polling을 하고 화면 이탈, 앱 background, draft 완료 시 중단한다. WebSocket/SSE 인프라는 추가하지 않았다.

## 참가자와 게스트

참가자는 일정에서 `ATTENDING`인 현재 `TeamMember`다. 게스트는 현재 모델상 점수의 안정적인 회원 identity가 없어 V1 TEAM 대회에서 제외한다. 이름 문자열을 identity로 사용하거나 유사 이름으로 점수를 연결하지 않는다. 게스트 지원은 별도의 영속 participant identity와 Score 연결 규칙이 생긴 뒤 확장한다.

## 팀장과 Snake Draft

OWNER/MANAGER가 참석 회원 중 두 명 이상의 Captain과 중복 없는 `1..N` draft order를 지정한다. 일반 참가자 수를 `R`, 팀 수를 `N`이라 할 때 각 팀의 직접 선택 수는 `floor(R/N)`, 나머지는 서버의 암호학적 난수로 균형 배정한다. 19명/4팀이면 각 Captain이 3명씩 12명을 선택하고 남은 3명은 자동 배정되어 팀 크기는 5/5/5/4가 된다.

선택은 transaction 안에서 현재 turn, Captain, participant 미배정 상태를 다시 검사한다. participant와 pick number의 generation 단위 unique constraint 및 조건부 `updateMany`로 동시 선택을 막는다. 각 Captain pick과 random remainder를 `TeamCompetitionDraftPick`에 보존한다.

초기화는 `draftGeneration`을 증가시키고 현재 팀·레인 상태를 새 세대로 전환한다. 이전 세대 팀과 pick history는 운영 추적을 위해 삭제하지 않는다.

## 레인 배정

팀 확정 뒤 관리자가 다음 두 순서를 명시한다.

1. 팀별 `lanePriority`
2. 각 팀 내부 member order

숨은 기본 순서를 사용하지 않는다. 선택한 slot은 클릭 순서와 무관하게 `laneNumber ASC, position ASC`로 정렬한다. 참가자 수와 slot 수가 같아야 하며, `lanePriority` 순으로 팀 전체에 연속 block을 할당한다. 팀끼리 interleave하지 않는다. 물리적 lane 경계를 넘는 연속 sequence는 허용한다.

## 점수와 팀 결과

조회 시 일정의 KST 날짜, 팀, `gameType`, 유효 점수 0~300인 원본 `Score`에서 매번 계산한다. 저장된 결과 snapshot을 사용하지 않으므로 점수 수정·삭제가 즉시 반영된다.

- 게임 수는 가변이다.
- 특정 참가자의 게임 점수가 없으면 0점으로 간주하지 않고 그 게임의 팀 순위와 포인트를 확정하지 않는다.
- 팀 크기가 다르면 최소 팀 인원을 `effectivePlayerCount`로 사용한다.
- 큰 팀은 매 게임별로 독립적으로 최하점을 제외한다.
- `rawTeamTotal`, `excludedScores`, `normalizedTeamTotal`을 분리한다.
- 게임별 순위 포인트는 일정의 `rankPoints`를 사용하고 미정의 순위는 0점이다.
- 개인 총핀 순위는 표시·통계용이며 별도 시즌 포인트에는 반영하지 않는다.

## 정책 확정 대기

다음 정책은 결과에 영향을 주므로 V1에서 임의 적용하지 않는다.

- `teamHandicap`: 저장 구조는 준비했지만 팀 합산/선수별 적용 방식이 정해질 때까지 계산하지 않는다.
- 최종 포인트 동점: 타이브레이크 핀을 raw로 쓸지 effective로 쓸지 정해지지 않았다. 동점 팀은 `finalRank=null`, `requiresPinTieBreakPolicy=true`로 반환한다.

동점 정책이 확정되면 total points, 선택된 pin 기준, member count, handicap, 안정적인 deterministic fallback 순으로 최종 순위를 계산하도록 버전이 있는 규칙으로 추가한다.
