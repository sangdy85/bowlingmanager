# Bowler Hidden MINI / PRACTICE Competition Mode

## 분류 계약

Bowler Hidden 일정은 다음 세 축을 독립적으로 저장한다.

- 활동 종류(`gameType`): 정기전, 벙개, 상주, 교류전, 기타
- 경기 방식(`competitionType`): `INDIVIDUAL`, `TEAM`, `EVENT`; 일반 일정은 `null`
- 적용 모드(`competitionMode`): `OFFICIAL`, `MINI`; 일반 일정은 `null`

활동 종류는 점수 기록과 일정 분류에 사용하고, 경기 방식은 진행 엔진을 선택한다. 적용 모드는 시즌 포인트 지급 여부만 결정한다. Flutter에서는 이를 각각 별도의 선택 항목과 badge로 표시한다.

## 생명주기

`OFFICIAL`과 `MINI`는 동일한 INDIVIDUAL, TEAM, EVENT 진행 엔진을 사용한다. 참석, 그룹 편성, 드래프트, 레인 배정, 비밀 투표, 점수 공유, 개표, 순위 계산, 결과 발표 및 이력 보존 과정은 같다.

차이는 서버의 시즌 포인트 publication 경계에만 있다.

- `OFFICIAL`: 결과 발표 시 적용 시즌과 경기 방식별 포인트 표를 확정하고 `SeasonPointPublication` 및 `SeasonPointEntry`를 생성한다.
- `MINI`: 결과는 발표하고 보존하지만 publication과 entry를 전혀 생성하지 않는다. 0점 entry도 생성하지 않는다.
- 모드가 없는 legacy Bowler Hidden 일정: 공식 경기로 추정하지 않으며 발표 시 `COMPETITION_MODE_REQUIRED`로 거부한다.

TEAM의 게임별 팀 포인트는 경기 최종 순위를 계산하기 위한 내부 점수이므로 MINI에서도 정상 계산한다. 이는 시즌 포인트와 다른 값이다. EVENT의 publish도 결과 공개를 의미하며, 시즌 포인트 생성은 OFFICIAL일 때만 추가로 수행한다.

## 모드 잠금

새 일정의 `ATTENDANCE_OPEN` 상태에서 참석 응답과 점수가 없을 때만 `OFFICIAL`과 `MINI` 사이를 변경할 수 있다. 참석 응답, 드래프트·투표 진행, 점수 기록 또는 이후 상태가 존재하면 서버가 `COMPETITION_MODE_LOCKED`로 거부한다. 발표된 결과의 모드도 변경할 수 없다.

클라이언트는 포인트 지급 여부를 보내지 않는다. `awardPoints`와 같은 입력은 없으며, `competitionMode == OFFICIAL` 검증은 시즌 포인트 service에서 수행한다.

## 시즌 최종전

동적 시즌 최종전은 `OFFICIAL`과 `MINI`를 생성할 수 있다. MINI 최종전은 동일한 DAG, seed, node, 점수 및 결과 이력을 보존한다. 현재 최종전 구현에는 별도의 공식 Champion 또는 placement achievement 쓰기 경로가 없으며, MINI 결과는 시즌 포인트 publication에도 연결되지 않는다. 향후 공식 업적 모델을 추가할 때에도 `OFFICIAL` 서버 gate를 적용해야 한다.

## Score provenance 및 일반 통계

`Score`에는 nullable `teamEventId`와 `competitionMode`를 보존한다. 일괄 점수 저장 시 팀, 경기일, 활동 종류가 일치하는 Bowler Hidden 일정이 정확히 하나일 때만 provenance를 연결한다. 같은 키의 일정이 여러 개라면 임의 연결하지 않고 두 필드를 `null`로 둔다.

이번 변경은 기존 평균, 최고점수, 기록 목록 등 일반 볼링 통계의 의미를 바꾸지 않는다. 따라서 MINI 점수도 기존 Score 통계 규칙에 따라 포함된다. nullable provenance는 향후 사용자가 MINI 포함 여부를 선택하는 통계 정책을 추가할 수 있도록 준비한 필드다. 시즌 랭킹과 월별 시즌 획득 내역은 `SeasonPointEntry`만 집계하므로 MINI는 항상 제외된다.

## UI

- 일정 작성/수정: Bowler Hidden 경기일 때 본경기 또는 MINI를 선택한다.
- 일정 목록/상세: 활동 종류, 경기 방식, 적용 모드를 각각 badge로 표시한다.
- 진행 화면: 개인전, 팀전, 이벤트전 카드에 적용 모드를 계속 표시한다.
- MINI 결과: 순위와 점수는 정상 표시하고 시즌 포인트 영역에는 `시즌 포인트 미지급`을 표시한다.
- 시즌 최종전 목록/상세: MINI임과 공식 시즌 순위 미반영을 표시한다.

## Migration 정책

`20260923130000_add_competition_mode` migration은 nullable `TeamEvent.competitionMode`, 기본값 `OFFICIAL`인 신규 `SeasonFinalTournament.competitionMode`, nullable Score provenance 필드와 인덱스를 추가한다.

기존 Bowler Hidden 일정을 일괄 OFFICIAL로 간주하지 않는다. 기존 `SeasonPointPublication`이 있어 공식 발표 사실을 증명할 수 있는 일정만 `OFFICIAL`로 backfill한다. 나머지 legacy 경기의 mode는 `null`로 남겨 운영자가 배포 전에 분류 정책을 결정하게 한다. 이 migration은 저장소에 생성만 했으며 운영 DB에는 적용하지 않는다.
