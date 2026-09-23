# Mobile Club Expansion (Phases 14–17)

## 범위

동호회 상세에 종합, 기록, 활동일지, 회원, 게시판 영역을 제공한다. OWNER와 MANAGER에게만 별도의 관리 진입점을 제공하며, 일반 회원 목록은 조회 전용이다.

## 통계와 회원 상세

- 팀원 통계는 Phase 12의 정기전 통계 계약을 그대로 사용한다.
- 이름 열은 고정하고 출석률, 게임 수, 1~12월 AVG, 총점, 평균 열은 가로 스크롤한다.
- 각 열은 헤더를 누를 때 오름차순과 내림차순을 전환한다.
- 회원 상세 통계는 팀과 연도의 정기전 Score를 한 번에 조회한 뒤 메모리에서 계산한다. 회원별 쿼리를 실행하지 않는다.
- `활동 시작일`은 해당 회원이 처음 정기전 Score를 기록한 KST 날짜다. `TeamMember.joinedAt`은 `실제 가입일`로 별도 표시한다.
- 현재 TeamMember가 아닌 과거 회원과 게스트는 회원 상세 및 시즌 순위 행에 포함하지 않는다. 다만 기존 Phase 12 경기 순위의 참가자로서 해당 경기의 순위 산정에는 반영된다.
- 모바일 회원 응답에는 이메일, 사용자 ID, OAuth provider와 그 밖의 계정 정보를 포함하지 않는다.

## 게시판


기존 `Post`와 `PostImage` 데이터를 재사용한다.

- 조회와 작성: 현재 활성 Team의 회원
- 수정과 삭제: 작성자 본인
- 목록: 제목, 작성자 표시명, 작성일, 이미지 수
- 상세: 제목, 본문, 작성자 표시명, 작성일, 기존 이미지 메타데이터

이 권한은 기존 Web Server Action의 작성 및 작성자 삭제 정책에 맞췄다. Web에는 수정 Action이 없으므로 모바일 수정은 삭제보다 넓은 권한을 주지 않고 작성자에게만 허용한다.

## 팀 소개와 공지

`Team.description`과 `Team.notice`는 각각 최대 2,000자의 단일 현재 값을 보관한다. 공지 이력은 게시판과 중복되므로 이번 범위에 포함하지 않는다.

- OWNER/MANAGER: 소개와 공지 수정
- OWNER: 시즌 활성화와 시즌 규칙 수정
- MEMBER: 조회만 가능

## 시즌 순위

시즌 기능은 팀별 opt-in이며 기본값은 비활성화다. 시즌은 연도에 고정하지 않고 이름, KST 시작일, KST 종료일을 가진다. 서비스 트랜잭션은 새 시즌을 활성화하기 전에 기존 활성 시즌을 모두 비활성화하여 팀별 활성 시즌을 하나로 유지한다.

순위는 별도 ledger나 cache에 저장하지 않는다. 시즌 날짜 범위의 정기전 Score에서 Phase 12 activity 순위를 다시 계산하므로 과거 기록 추가, 점수 수정과 삭제가 즉시 반영된다.

지원 방식:

- `PODIUM`: 1~3위에 설정된 포인트를 부여하며 4위 이하는 0점이다.
- `FULL_RANK`: 설정된 순위별 포인트를 부여하며 point table에 없는 순위는 0점이다.

기본 동점 정렬은 다음과 같다.

1. 포인트 내림차순
2. 금메달 수 내림차순
3. 은메달 수 내림차순
4. 동메달 수 내림차순
5. 정기전 평균 내림차순
6. 표시 이름 한국어 정렬
7. 안정적인 TeamMember ID 정렬

이 정책은 별도 설정 UI 없이도 설명 가능하고 모든 응답 순서를 결정적으로 유지한다. 향후 제품 요구가 생기면 tie-break 정책을 시즌 설정으로 확장할 수 있다.

## Additive Mobile API

- `GET /api/mobile/v1/teams/:teamId/members/:memberId?year=YYYY`
- `GET /api/mobile/v1/teams/:teamId/posts?page=1&limit=20`
- `POST /api/mobile/v1/teams/:teamId/posts`
- `GET /api/mobile/v1/teams/:teamId/posts/:postId`
- `PATCH /api/mobile/v1/teams/:teamId/posts/:postId`
- `DELETE /api/mobile/v1/teams/:teamId/posts/:postId`
- `GET /api/mobile/v1/teams/:teamId/profile`
- `PATCH /api/mobile/v1/teams/:teamId/profile`
- `GET /api/mobile/v1/teams/:teamId/season-ranking`

모든 endpoint는 기존 protected Dio/Bearer/refresh 흐름을 사용하며 Backend에서 현재 Team membership과 쓰기 권한을 다시 검사한다.

## Migration

`20260922170000_add_team_profile_and_seasons`는 기존 테이블이나 데이터를 삭제하지 않는다. Team에 nullable 소개/공지와 기본 false인 시즌 활성화 필드를 추가하고, 독립적인 `TeamSeason` 테이블 및 조회 인덱스를 추가한다. Production migration과 배포는 이 개발 작업에 포함하지 않는다.
