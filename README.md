# BowlingManager

볼링 대회·클럽 운영 서비스입니다. 웹사이트(https://www.bowlingmanager.co.kr)와 Android 앱이 같은 서버를 씁니다.

| 영역 | 위치 | 기술 |
| --- | --- | --- |
| 웹사이트 + 서버 | 저장소 루트 (`src/`) | Next.js 15 (App Router, Server Actions), React 19, TypeScript |
| 모바일 앱 API | `src/app/api/mobile/v1/` | Next.js Route Handlers, JWT + 리프레시 토큰 |
| 모바일 앱 | `mobile/` | Flutter (Riverpod, go_router, dio, Firebase Messaging). 자세한 내용은 [mobile/README.md](mobile/README.md) |
| DB | `prisma/` | Prisma 5 + SQLite (WAL 모드) |

## 주요 폴더

- `src/app/` — 페이지와 API 라우트
- `src/app/actions/` — Server Actions. 화면 없이도 누구나 POST로 호출할 수 있으므로 **모든 변경 액션은 첫 줄에서 로그인·권한을 확인해야 합니다** (`src/lib/auth-utils.ts`의 `verify*Admin`).
- `src/lib/` — 공통 로직 (`mobile-api/`는 앱 API 서비스 계층)
- `src/components/` — UI 컴포넌트
- `prisma/schema.prisma`, `prisma/migrations/` — DB 스키마와 마이그레이션
- `tests/` — Node 내장 테스트 러너용 테스트 (`*.test.cjs`)
- `scripts/` — 시드·QA 픽스처·조회용 스크립트, 릴리스 스크립트
- `docs/` — 기능 설계 문서와 QA 보고서

## 로컬 실행

Node 20이 필요합니다.

```bash
npm ci
cp .env.example .env   # 값은 아래 환경변수 표 참고
npx prisma migrate deploy
npm run dev            # http://localhost:3000
```

테스트용 계정이 필요하면 로컬 DB에서만 실행합니다.

```bash
npm run seed:test
TEST_USER_EMAIL=me@example.com TEST_USER_PASSWORD=... node scripts/create-test-user.js
```

## 환경변수

`.env*` 파일은 커밋하지 않습니다. 비밀값은 서버의 `.env`에만 둡니다.

| 변수 | 필수 | 용도 |
| --- | --- | --- |
| `DATABASE_URL` | ✓ | SQLite 경로. 예: `file:./prod.db?socket_timeout=10` (`socket_timeout`은 잠금 대기 초) |
| `AUTH_SECRET` | ✓ | NextAuth 세션 서명 키 |
| `MOBILE_API_JWT_SECRET` | ✓ (앱) | 앱 액세스 토큰 서명 키. 32바이트 이상, `AUTH_SECRET`과 달라야 함 |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | ✓ | 인증·비밀번호 재설정 메일 발송 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | 선택 | Google 로그인 |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 선택 | Naver 로그인 |
| `GOOGLE_API_KEY` | 선택 | Gemini 점수표 인식 |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | 선택 | 앱 푸시 알림 발송 |
| `MOBILE_PUSH_WORKER_SECRET` | 선택 | `/api/internal/mobile-notifications/*` 호출용 Bearer 키 |
| `NEXT_PUBLIC_ANDROID_APP_URL` | 선택 | 웹에서 안내하는 Android 앱 링크 |
| `PRISMA_SQLITE_WAL` | 선택 | `off`면 시작 시 WAL 모드 설정을 건너뜀 |

## 검사

```bash
npm run lint
npm run typecheck
node --test tests/*.test.cjs
npm run build          # lint + typecheck + prisma generate + next build
```

GitHub Actions(`.github/workflows/ci.yml`)가 PR과 `main` 푸시마다 위 검사와 `flutter analyze`, `flutter test`를 실행합니다.

## 배포

운영 서버는 PM2(`ecosystem.config.js`)로 `next start`를 실행합니다. 릴리스는 Windows에서 `scripts/release-bowling.ps1 -Version x.y.z [-Deploy]`로 하며, 버전 올리기 → 테스트·빌드 → `main` fast-forward → SSH로 `~/deploy-bowling.sh` 실행 → 태그 순서로 진행합니다.

배포 전 확인할 것:

1. **DB 백업.** WAL 모드에서는 최근 변경이 `<db>-wal` 파일에 있으므로 `.db` 파일만 복사하면 안 됩니다. `sqlite3 prod.db ".backup backup-$(date +%F).db"`처럼 백업하거나 `-wal`, `-shm` 파일까지 함께 복사합니다.
2. 의존성이 바뀌었으면 `npm ci`
3. `npx prisma migrate deploy` (마이그레이션이 있을 때)
4. 빌드 후 PM2 재시작

운영 DB를 직접 고쳐야 할 때는 [DB_MODIFICATION_GUIDE.md](DB_MODIFICATION_GUIDE.md)를 보고, 반드시 백업부터 합니다.

## 보안 원칙

- 비밀번호, API 키, 실제 회원 데이터, DB 파일은 커밋하지 않습니다. 이 저장소는 공개 상태입니다.
- 스크립트의 계정 정보는 환경변수로 받습니다 (`scripts/create-test-user.js`, `scripts/seed-super-admin.js`).
- 로그인·인증코드·인증메일에는 시도 횟수 제한이 있습니다 (`src/lib/attempt-limiter.ts`, 단일 프로세스 메모리 기준).
