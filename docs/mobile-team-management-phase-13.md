# Mobile Phase 13 — 동호회 관리

## 웹 정책 재사용

- 점수 입력·수정·삭제: 현재 동호회의 `OWNER` 또는 `MANAGER`만 가능하다.
- 팀원 제거: `OWNER`는 자신과 팀장을 제외한 팀원을 제거할 수 있다. `MANAGER`는 자신·팀장·다른 매니저를 제거할 수 없고 일반 `MEMBER`만 제거할 수 있다.
- 매니저 지정·해제: `OWNER`만 가능하다. 팀장 역할은 변경하지 않는다.
- 팀장 위임은 웹에는 존재하지만 Phase 13 모바일 범위에서 제외한다.
- 제거된 팀원의 기존 점수는 웹과 동일하게 표시 이름을 가진 비회원 기록으로 보존한다.

모든 쓰기 작업은 활성 동호회와 현재 `TeamMember` 가입 상태를 먼저 확인한다. 전역 `SUPER_ADMIN` 역할도 동호회 가입이 없으면 우회할 수 없다. Authorization 헤더가 잘못된 요청은 웹 세션으로 fallback하지 않는다.

## API 계약

직접 입력은 Phase 7의 `POST /api/mobile/v1/scores/bulk`를 재사용한다. 참가자별 1~12게임, 0~300 정수, 최대 50명, 동호회 소속 `memberId`를 서버에서 검증하며 같은 회원이나 같은 비회원 이름의 중복 행을 거부한다. 비회원은 `memberId: null`과 이름으로 저장한다.

관리자 편집 조회:

`GET /api/mobile/v1/teams/:teamId/activities/:activityId/edit`

일반 활동 조회에는 없는 Score 식별자와 revision을 관리자에게만 반환한다. 이메일, userId, 초대 코드, 인증 provider와 token은 반환하지 않는다.

활동 수정:

`PUT /api/mobile/v1/teams/:teamId/activities/:activityId/edit`

날짜, 게임방식, 메모, 참가자, 각 게임 점수를 한 transaction에서 전체 교체한다. 요청의 `memberId`는 `TeamMember.id`이며 transaction 안에서도 다시 확인한다.

활동 삭제:

`DELETE /api/mobile/v1/teams/:teamId/activities/:activityId`

확인 화면에서 편집 조회의 `scoreCount`를 표시하고 revision을 함께 전송한다. activityId의 날짜와 필터에 해당하는 Score만 한 transaction에서 삭제한다.

팀원 제거 및 역할 변경:

- `DELETE /api/mobile/v1/teams/:teamId/members/:memberId`
- `PATCH /api/mobile/v1/teams/:teamId/members/:memberId` with `{ "role": "MANAGER" | "MEMBER" }`

응답은 변경 결과만 포함하며 raw Prisma 객체를 반환하지 않는다.

## 동시 수정

schema에 version 필드를 추가하지 않았다. 대신 관리자 편집 조회가 Score ID·값·날짜·분류·메모·생성 시각으로 만든 SHA-256 revision을 반환한다. 수정과 삭제 transaction은 원래 KST 날짜·필터의 전체 Score 집합을 다시 읽어 revision을 비교한다. 기존 Score의 수정·삭제뿐 아니라 같은 활동에 새 Score가 추가된 경우도 `409 ACTIVITY_CONFLICT`로 거부한다.

## Flutter

동호회 상세의 관리 메뉴는 OWNER/MANAGER에게만 표시한다. 관리 화면에서 직접 입력, 기존 Capture OCR, 기록 관리, 팀원 관리로 이동한다. 직접 입력과 편집은 같은 가변 게임 폼을 사용하며 중복 참가자와 잘못된 점수를 클라이언트에서도 검사한다. 서버 검증이 최종 권한·데이터 검증이다.

생성·수정·삭제 후 팀 통계, 활동 목록/상세, Home dashboard와 개인 Records provider를 무효화한다. 팀원 제거·역할 변경 후 동호회 목록·상세·회원·통계 provider를 무효화한다. 앱 재시작은 필요하지 않다.

## 이후 단계

Phase 14에서 동호회 게시판 목록·상세·작성·수정·삭제와 이미지 첨부를 별도 권한 및 API 계약으로 구현한다. 팀 생성·삭제, 팀장 위임, 회비, 채팅, OAuth 계정 관리는 이 문서 범위가 아니다.
