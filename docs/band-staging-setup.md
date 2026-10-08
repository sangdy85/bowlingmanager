# BAND 스테이징 구성 및 브라우저 QA (Windows)

네이버 BAND 승인 전에 실제 전송 없이 동작을 확인한다. 기존 운영 DB, PM2, main 브랜치는 절대 변경하지 않는다.

## 격리 원칙

- 별도 Git worktree: C:\bm-staging (운영 및 기존 작업 폴더와 분리)
- 별도 SQLite: C:\bm-staging\prisma\band-staging.db (운영 dev.db를 복사하지 않음)
- 별도 URL 및 포트: http://127.0.0.1:3101 (루프백 접속 전용)
- 가상 사용자, 대회, 점수만 생성하며 실제 사용자 데이터를 복제하지 않음
- APP_ENV=band-staging일 때 DB 파일 이름을 강제 검증
- BAND_EXTERNAL_POSTING_ENABLED=false, 실제 BAND OAuth/목록/쓰기 API 차단
- 승인 후 별도 릴리스까지 GitHub Draft PR #8 미병합

## 1. PowerShell에서 스테이징만 준비

기존 C:\bmrc에서 다음을 실행한다. 같은 이름의 worktree/로컬 브랜치가 이미 있으면 중복 생성하지 않는다.

~~~powershell
cd C:\bmrc
git fetch origin
git worktree add -b local/band-staging C:\bm-staging origin/codex/develop-band-next
cd C:\bm-staging
npm.cmd ci
node scripts/band-staging.cjs init --confirm-band-staging
node scripts/band-staging.cjs migrate
node scripts/band-staging.cjs seed
node scripts/band-staging.cjs check
~~~

Init 명령은 폴더 이름에 staging이 포함됐는지, .git이 연결 파일인지 확인한다. 기존 스테이징 DB 또는 설정을 덮어쓰지 않는다. Migrate는 고정된 staging 전용 파일에만 Prisma migration을 적용하고 Prisma Client를 새로 생성한다.

## 2. 로컬 앱 실행

~~~powershell
cd C:\bm-staging
node scripts/band-staging.cjs start
~~~

브라우저: http://127.0.0.1:3101/login

- 센터 관리자 이메일: staging-admin@local.test
- 일반 사용자 이메일: staging-viewer@local.test
- 두 계정의 비밀번호: C:\bm-staging\.env.band-staging.local 안의 BAND_STAGING_QA_PASSWORD 값
- 이 파일에는 인증용 비밀값이 들어 있으므로 GitHub, 채팅, 로그에 공유하지 않는다.

## 3. 수동 검증 페이지

- 볼링장 설정: http://127.0.0.1:3101/centers/band-staging-center/edit
- 상주리그: http://127.0.0.1:3101/centers/band-staging-center/tournaments/band-staging-league
- 챔프전: http://127.0.0.1:3101/centers/band-staging-center/tournaments/band-staging-champ/rounds/band-staging-champ-round
- 이벤트전: http://127.0.0.1:3101/centers/band-staging-center/tournaments/band-staging-event/rounds/band-staging-event-round

관리자로 로그인해서 가상 BAND 이름, 게시 전 미리보기, 자동 게시 기본 OFF, 완료된 리그 1주차만 게시 버튼 활성화, 미완료 2주차 제외, 챔프전 및 이벤트전 참가자/레인/결과 미리보기를 검증한다. 미리보기만 실행해도 BandPost DB 기록은 증가하면 안 된다. 확인 후 발행 버튼을 눌러도 스테이징의 외부 전송 금지 메시지를 보여야 하며 실제 BAND 전송은 일어나면 안 된다.

일반 사용자로 재로그인해서 관리자 전용 BAND 발행/설정 버튼이 없는지 확인한다. 가짜 BAND 연결은 실제 OAuth 연결이 아니며 테스트 데이터만 사용한다.

## 4. 테스트, 정적 분석, 빌드

~~~powershell
cd C:\bm-staging
node --test tests/band-integration.test.cjs tests/band-post-preview.test.cjs tests/band-operational-qa.test.cjs tests/band-staging-safety.test.cjs
node scripts/band-staging.cjs validate
node scripts/band-staging.cjs build
git diff --check origin/main...HEAD
git status --short
~~~

## 5. 종료 및 정리

스테이징 실행 창에서 Ctrl+C로 중단한다. C:\bmrc에서 git worktree list로 경로를 확인한다. 로컬 스테이징 데이터와 .env 파일은 ignored 상태이므로 제거 전에 보관 여부를 결정한다. 운영 경로에서 git clean, sqlite 삭제, migrate deploy를 실행하지 않는다. worktree 제거 시 강제 삭제를 사용하지 않는다.

## 6. 실제 BAND 승인 이후

이 QA는 공식 BAND API 실제 게시 검증을 대신하지 않는다. NAVER BAND 승인 이후 별도의 테스트 밴드에서 실제 인증/게시 시나리오를 검증하고, 그 다음에만 릴리스와 프로덕션 DB migration 여부를 검토한다.
