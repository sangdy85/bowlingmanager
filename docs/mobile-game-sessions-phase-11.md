# Mobile Phase 11 경기 그룹 계약

## 범위

Records는 개인 `Score`만 표시한다. Home Dashboard는 기존 웹 통계와 동일하게
PERSONAL, LEAGUE, TOURNAMENT 기록을 통합한다. 전체 평균, 최고점수, 게임 수와
최근 10게임 평균의 모집단은 Phase 5.1 계약을 유지한다.

## 그룹 식별

개인 `Score`에는 session/event/match/round 식별자가 없다. 개인 기록은 API의
`gameDate` UTC calendar date, 공백을 제거한 `gameType`, `team.id`를 사용한다.
`gameType`과 `team`의 null은 각각 별도 값으로 취급하며 팀 이름은 식별자로 쓰지
않는다.

리그는 `matchupId`, 대회는 `registrationId + roundId`를 위 키에 추가한다. 모든
Dashboard 그룹은 `source`도 포함하므로 서로 다른 source를 합치지 않는다.

개인 기록은 같은 UTC 날짜에 같은 gameType과 team으로 두 경기를 진행해도 이를
구분할 저장 필드가 없다. 현재 계약에서는 한 그룹으로 표시된다. 이를 정확히
분리하려면 향후 `Score`에 session ID와 게임 순서를 additive migration으로
추가해야 한다.

## 순서와 날짜

그룹은 최신 `gameDate`부터 표시한다. 개인 그룹 내부는 `createdAt ASC`, 동률이면
`id ASC`로 정렬한다. bulk 저장은 순차 create이지만 SQLite timestamp 정밀도에서
동률일 수 있으므로 ID는 deterministic secondary key일 뿐 원래 입력 순서를 완전히
복원하지는 못한다. 리그는 score1~score3 순서, 대회는 `gameNumber`를 우선한다.

날짜는 backend가 사용하는 UTC calendar date를 그대로 표시하며 Flutter에서
임의 timezone 변환을 하지 않는다.

## API

기존 `GET /api/mobile/v1/scores` 행 단위 계약은 유지한다.

`GET /api/mobile/v1/scores/groups?page=1&limit=20`은 인증 사용자의 유효한 개인
점수 전체를 그룹화한 다음 그룹 단위로 pagination한다. 따라서 한 경기의 점수가
페이지 경계에서 분리되지 않는다.

```json
{
  "success": true,
  "data": {
    "items": [{
      "id": "opaque-group-id",
      "source": "PERSONAL",
      "gameDate": "2026-09-22T00:00:00.000Z",
      "gameType": "정기전",
      "team": { "id": "team-id", "name": "배볼러" },
      "scores": [
        { "id": "score-id", "score": 202, "memo": null }
      ],
      "total": 202,
      "average": 202.0,
      "gameCount": 1
    }],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
  }
}
```

현재 구현은 정확한 그룹 pagination을 위해 해당 사용자의 유효한 개인 점수를
읽은 후 서버에서 그룹화한다. 데이터 규모가 커지면 session ID 컬럼과 DB 수준
group pagination으로 최적화할 수 있다.

Dashboard는 기존 필드를 제거하지 않고 `recentSessions`를 최대 7개 추가한다.
각 session의 구조는 위 그룹 구조와 같다. `recentScores`와 `recentAverage`는 기존
최근 10게임 계약을 유지한다. Home 차트와 최근 경기 카드는 `recentSessions`의
경기 평균, 점수 목록, 총점과 AVG를 사용한다.

## Memo

Memo는 Score 행 단위 데이터다. 그룹 내 모든 non-empty memo가 같으면 카드에서
한 번 표시한다. 서로 다르면 `점수 · memo` 형태로 각각 표시하여 정보를 버리지
않는다.
