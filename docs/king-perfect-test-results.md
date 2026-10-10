# 킹퍼펙트 로컬 검증 결과

검증일: 2026-10-10~11 (Asia/Seoul). 이 문서는 운영 적용 승인이 아니다.

## 작업 이력과 보존
- 시작 브랜치: codex/production-source-reconciled-20261010.
- 시작/현재 HEAD: 5edc09444ee08448f97dae5ec87538688253c195.
- 현재 브랜치: codex/king-perfect-local.
- 시작 시 미커밋 변경 없음. 기존 다른 사본(growth-001 외 team-manual-hotfix, web-ads-001), 모바일 소스, 운영 데이터 변경 없음.
- Git reset/checkout main, commit, push, merge, 프로덕션 배포 미실행.
- migration SQL 생성 및 새 임시 SQLite에서만 적용. 기존 prisma/dev.db에는 migration 미적용.

## 검증 명령과 환경
- Node v20.20.2 / Prisma 5.22 / Next 15.5.12.
- node node_modules/prisma/build/index.js validate: 성공.
- node node_modules/prisma/build/index.js generate: 성공.
- migration diff: 기존 HEAD 스키마와 변경 스키마의 차이만 SQL로 생성.
- 새 SQLite에 기존 migration 전체와 신규 migration 적용 성공.
- node node_modules/typescript/bin/tsc --noEmit --incremental false: 성공.
- node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx: 오류 0 / 기존 경고 18.
- npm run typecheck는 Windows 경로의 &를 npm CMD shim이 해석하여 실행 단계에서 실패. 동일 TypeScript CLI를 node로 직접 호출하여 성공. 프로젝트 코드의 타입 오류가 아니며 package.json을 우회용으로 변경하지 않았다.
- production build는 새 임시 디렉터리의 소스 사본에서 실제 next build로 검사. .env는 복사하지 않고 DB/인증/센터 허용 목록은 fixture 전용 값 사용.
- 원시 검증 로그는 Git 제외 scratch/king-perfect-*.tap, *build*.log, *lint*.json에 보존한다.

## 자동화 검증 내용
- 모드 구분, 월별 셋째 일요일/한국시간 계산.
- 요청에 주어진 25명 fixture: 24위 김준형 179+3=182, 25위 조달호 180+1=181. fixture 외 운영 DB 기록 생성 없음.
- 환산 정렬, 최고/최근 반영, 동점 판정 없으면 차단, 승인/선수/취소 필터.
- 정확한 24개 시드/12개 매치/9~16레인 조합.
- 관리자/다른 센터/이름만 같은 센터/비회원 차단.
- 예선 시도와 1,000원 과금 원자성, 동일 요청 재시도 중복 방지.
- 0/null 및 범위/게임 번호/다른 경기 참가자 점수 검증.
- revision 충돌 및 동시 요청 중 하나만 반영.
- 예선 기록 수정 후 재정렬, 확정 후 조용한 시드 재계산 방지.
- 1R 12명→2R 4명→결승 1~4위, 결승 핸디 0.
- 합계/최고 게임 선택, 미확정 판정 방식 차단.
- 미납/납부·시상 기준 선택, 확정 원장 잠금, 정산 스냅샷.
- 사이드 참가 독립, 1게임 볼사이드 차단, 행운권 입상자 제외/중복 방지.
- 새 월 회차 보존, 중복 월 차단.
- 잠금 해제 시 후속 대진·시상·추첨·공개 초기화 및 감사 이력 보존.
- 예선 횟수 제한/기록 취소 및 복원 과금 일관성.
- 특별 승자 판정의 전체 명단/명시적 확인/이력.
- FK Restrict와 관리자 DTO의 내부 관계 제외.

## 수정한 검증 문제
1. 기존 BAND 테스트 2개의 간이 TypeScript 로더가 새 import를 못 읽음: 서비스 mock과 실제 규칙 모듈 매핑을 추가, 기존 검증 단언은 유지.
2. 검사 중 규칙 설정 확장과 테스트 구버전이 겹친 실패: 코드 변경이 끝난 뒤 다시 검사.
3. 기존 HTTP 테스트는 기능 시나리오 3개를 통과했으나 Windows taskkill 종료 경합으로 후처리 실패. 이미 종료된 PID(ESRCH)만 허용하도록 수정했고 같은 HTTP 테스트 4개 재검사 통과.
4. 실제 PC 화면에서 작업 사유 레이블 대비가 낮아 전용 패널 바탕을 밝게 조정.

## 변경 파일 전체
기준 디렉터리: growth-001.

### 수정 9개
- .env.example
- prisma/schema.prisma
- src/app/actions/tournament-center.ts
- src/app/centers/[id]/tournaments/[tournamentId]/page.tsx
- src/app/centers/[id]/tournaments/new/page.tsx
- src/components/tournaments/NewTournamentForm.tsx
- tests/band-integration.test.cjs
- tests/band-operational-qa.test.cjs
- tests/event-game-fees-http.test.cjs

### 신규 13개
- prisma/migrations/20261010100000_add_king_perfect/migration.sql
- scripts/king-perfect-local-qa.cjs
- src/app/actions/king-perfect.ts
- src/components/tournaments/KingPerfectManager.tsx
- src/components/tournaments/KingPerfectManager.module.css
- src/components/tournaments/KingPerfectPage.tsx
- src/lib/king-perfect/rules.ts
- src/lib/king-perfect/service.ts
- tests/king-perfect.test.cjs
- docs/king-perfect-requirements.md
- docs/king-perfect-rules.md
- docs/king-perfect-test-results.md
- docs/king-perfect-open-questions.md

## 기능 범위와 운영 전 남은 확인
10개 탭별 구현과 DB 설계는 king-perfect-requirements.md, 운영 절차는 king-perfect-rules.md, 미확정 원본 규칙과 추가 기능은 king-perfect-open-questions.md를 참고한다.
실제 센터 ID/원본 2R 연결/게임 수/동점 현장 방식/시상 기준액 확인 전에는 운영 준비 완료로 간주하지 않는다.


## 최종 검증 집계 (2026-10-11)
- 전체 자동화: 622개 중 통과 621, 실패 0, 취소 0, 건너뜀 0, 기존 TODO 1. 실행 시간 165.35초.
- TODO는 기존 auth-authorization-db-e2e.test.cjs의 migration history reconstructs current Prisma schema without drift이다. 신규 migration 자체는 임시 SQLite에 전체 이력 적용하여 검증했다.
- KING_PERFECT 전용 테스트 32개 통과. 예선→24명→12명→4명→순위/정산/행운권/사이드게임 전체 서비스 시나리오를 새 DB에서 검증했다.
- 전체 lint: 오류 0, 기존 경고 18. TypeScript 직접 CLI 검사 성공. 격리 사본 production build 성공.
- 기존 운영 DB 및 dev.db에는 migration/fixture를 적용하지 않았다.

## 실제 브라우저 및 파일 확인
- 테스트 전용 센터/계정으로 정상 로그인하여 10개 탭 표시와 본선 확정 후 설정 잠금 확인.
- 첫 경기 원점수를 0으로 저장하고 명시적 경기 확인 후 확정. 상대 210점 승자 표시와 저장된 0점 재조회 확인.
- PC 화면과 390×844 모바일 화면 캡처. 모바일 현황 카드 단일 열, 작업 버튼 줄바꿈, 탭 가로 스크롤 확인. 실제 휴대폰 장치 검증은 아님.
- 전체 엑셀 버튼으로 KING-PERFECT-2026-10.xlsx 다운로드 성공. xlsx로 다시 읽어 예선 순위 25행, 대진 및 전체 결과 24행, 참가비 49행, 행운권 0행 확인. 이 fixture는 1R 진행 중이므로 시상 시트는 정산 확정 전까지 없다.
- UI 확인 중 Node/Chromium 날짜 지역화 표기 차이로 발생한 React 초기 렌더링 오류를 수정: 한국시간 날짜 문자열을 동일한 YYYY-MM-DD HH:mm으로 생성한다.
- 인쇄 버튼 및 print CSS 구현. 실제 프린터 출력, PDF 저장 파일의 페이지 분할, 경기 엑셀 업로드 UI는 수동 종단 검증하지 못했다.
- 스크린샷은 Git 외부 시각화 폴더에 보존한다. 다운로드 파일도 테스트 선수만 포함하며 운영 데이터가 아니다.

## 최종 변경 요약
- 수정 9개, 신규 13개: 총 22개 파일. 전체 목록은 위에 기재했다.
- 기존 tracked 파일 diff: 216줄 추가 / 11줄 삭제. 신규 파일 내용은 이 숫자에 포함되지 않는다.
- git diff --check 통과. Windows LF→CRLF 변환 안내만 있으며 공백 오류 없음.
- HEAD 변경 없음, commit/push/merge/운영 배포 없음. 로컬 브랜치의 미커밋 변경으로 검토 가능.
- 마지막 날짜 표기 수정 후 TypeScript/lint 재검사와 production build 재검증 성공. 새로고침 후 진행요약/현황 탭을 조작했고 수정 이후 새 브라우저 오류 0건을 확인했다. 최종 PC/모바일 캡처도 갱신했다.

## 2026-10-11 적용 전 재검토
- 사용자가 운영 서버 배포까지 승인했다. 이전 절의 비배포 기록은 최초 구현 완료 시점의 기록이다.
- 발견/수정: 이전 단계로 재개하면 삭제된 후속 경기의 사이드 참가 명단이 남았다. clearStages에서 해당 회차·단계의 명단을 초기화하고 변경 전 감사 스냅샷에 보존하도록 수정했다.
- 회귀: 1R 재개 시 2R 명단만 초기화하고 1R 명단 유지, 예선 재개 시 전체 사이드 명단 초기화와 감사 이력 보존을 검증. 전용 테스트 33개 통과, 실패 0.
- 수정 후 typecheck 성공, 전체 lint 오류 0/기존 경고 18, diff 검사 통과.
- 서버 읽기 전용 확인: 기준 runtime 파일 431개 일치, 기존 API 84개, PM2 online 및 systemd active/enabled, DB quick_check 정상. 실제 장안퍼펙트볼링센터 ID를 확인했다.
- 신규 migration은 11개 전용 테이블 추가만 수행하며 기존 테이블 변경은 없다. 적용 전 운영 DB 복사본에서 먼저 검증한다.
