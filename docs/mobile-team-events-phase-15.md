# Mobile Phase 15: 동호회 일정, 참석 조사, 레인 추첨

## 범위

Phase 15는 기존 `Team`, `TeamMember`, `Score`의 의미를 바꾸지 않고 동호회 일정과 참석 조사, 게스트, 레인 좌석 추첨을 추가한다. 기존 대회의 레인 배정은 별도 도메인으로 유지한다. 앱 안의 일정 화면이 공지와 결과 공개 수단이며, FCM은 도입하지 않는다.

## 데이터와 권한

- `TeamEvent`: 제목, KST 달력 날짜, 시간, 장소, 선택형 경기 유형, 참석/추첨 설정과 상태를 저장한다.
- `TeamEventAttendance`: `TeamMember` 기준으로 한 회원의 응답을 한 건만 저장하며 표시 이름 snapshot을 보존한다.
- `TeamEventGuest`: 계정이나 회원을 만들지 않는 일정 전용 참가자다. 동명이인은 ID로 구분한다.
- `TeamEventLaneSlot`: 일정에서 선택한 `laneNumber-position`을 한 건씩 저장한다.
- `TeamEventLaneAssignment`: 참가자와 슬롯을 1:1로 연결한다. 참가자와 슬롯 고유 제약으로 중복 배정을 차단한다.

활성 팀의 현재 `TeamMember`만 조회하고 본인 참석 여부를 바꿀 수 있다. `OWNER`와 `MANAGER`만 일정, 게스트, 슬롯, 추첨을 관리할 수 있다. 관리자 참석 현황에는 이름과 상태만 포함하며 이메일, 사용자 ID, 인증 정보는 반환하지 않는다.

## 추첨 정책

- 참가자는 `ATTENDING` 회원과 게스트이며, 불참과 미응답은 제외한다.
- 시작 시 참가자 수와 선택한 미배정 슬롯 수가 정확히 같아야 한다.
- 시작은 서버가 계산한 `Asia/Seoul` 일정 당일에만 허용한다. 지난 일정의 결과 조회는 가능하지만 새 추첨 시작은 허용하지 않는다.
- `BULK`는 `crypto.randomInt` 기반 Fisher–Yates로 참가자와 슬롯을 섞고 하나의 transaction에서 전체 배정한다.
- `INDIVIDUAL`은 `OPEN` 이후 회원 본인과 관리자 대리 게스트 추첨을 허용한다. 이미 배정된 참가자는 기존 결과를 반환한다.
- 관리자는 남은 참가자와 슬롯을 하나의 transaction에서 일괄 배정할 수 있다.
- 추첨 시작 후 참석, 게스트, 슬롯, 날짜, 경기 유형, 추첨 설정과 일정 삭제를 잠근다. 제목, 시간, 장소는 수정할 수 있다.
- 일반 재추첨과 초기화 API는 제공하지 않는다. 공정성 감사가 필요한 초기화는 별도 Phase에서 이력 모델과 함께 설계한다.
- SQLite 동시 추첨 충돌은 transaction과 DB 고유 제약으로 막고, 충돌 요청에는 `409 DRAW_CONFLICT`를 반환한다.

## API

- `GET/POST /api/mobile/v1/teams/:teamId/events`
- `GET/PATCH/DELETE /api/mobile/v1/teams/:teamId/events/:eventId`
- `PUT /api/mobile/v1/teams/:teamId/events/:eventId/attendance`
- `POST /api/mobile/v1/teams/:teamId/events/:eventId/guests`
- `DELETE /api/mobile/v1/teams/:teamId/events/:eventId/guests/:guestId`
- `PUT /api/mobile/v1/teams/:teamId/events/:eventId/lane-config`
- `POST /api/mobile/v1/teams/:teamId/events/:eventId/draw/start`
- `POST /api/mobile/v1/teams/:teamId/events/:eventId/draw/mine`
- `POST /api/mobile/v1/teams/:teamId/events/:eventId/draw/guests/:guestId`
- `POST /api/mobile/v1/teams/:teamId/events/:eventId/draw/remaining`

모든 API는 기존 Mobile Bearer 인증과 refresh/retry 계층을 그대로 사용한다.

## Migration 검토와 운영 적용 절차

`20260922000000_add_team_events`는 새 테이블과 인덱스만 만드는 additive migration이다. 기존 테이블의 컬럼을 삭제하거나 변환하지 않는다. 개발 과정에서는 임시 SQLite DB에 전체 migration을 적용해 SQL을 검증하며 운영 DB에는 적용하지 않는다.

현재 저장소의 초기 migration만으로 만든 빈 DB는 현재 `schema.prisma`의 일부 기존 컬럼(`User.role`, `Team.isActive` 등)을 완전히 재현하지 못하는 기존 migration-history drift가 있다. Phase 15 SQL은 공통 식별자와 새 테이블만 사용해 정상 적용되지만, 이 drift는 Phase 15에서 기존 migration을 수정해 해결하지 않는다. 운영 반영 전에는 반드시 운영 DB 백업 복사본에 migration을 먼저 적용하고 현재 Prisma Client가 읽을 수 있는지 검증해야 한다.

운영 반영 시에는 다음 순서를 따른다.

1. 앱/서버 트래픽을 정리하고 PM2 프로세스를 확인한다.
2. 운영 SQLite 파일과 `-wal`, `-shm` 상태를 확인한 뒤 SQLite online backup 또는 서비스를 중지한 파일 복사로 timestamp 백업을 만든다.
3. 백업 파일에 `PRAGMA integrity_check;`를 실행해 `ok`를 확인한다.
4. 배포 코드와 환경의 `DATABASE_URL`이 운영 DB를 가리키는지 사람이 재확인한다.
5. `npx prisma migrate deploy`를 한 번 실행한다. `migrate reset`과 `db push --force-reset`은 사용하지 않는다.
6. 새 다섯 테이블과 `_prisma_migrations` 적용 내역을 읽기 전용으로 확인하고 health/login/기존 웹/일정 API smoke test를 수행한다.

적용 실패 시 서비스를 중지하고 실패 DB 파일을 보존한 뒤 검증된 백업으로 교체한다. SQLite DDL을 임의로 역실행하지 않는다. 실제 운영 backup, migration, rollback은 별도 배포 승인 후 수행한다.
