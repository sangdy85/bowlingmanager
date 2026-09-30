# WEB-ADS-001 로컬 구현 및 검증 보고

작성: 2026-09-30. 판정: **로컬 구현 완료 / 운영 검증 필요 / 콘텐츠 추가 검수 필요**. 전체 사이트 개선 완료 또는 AdSense 승인 가능 판정이 아니다.

## VERIFIED BASELINE — 저장소와 패치 기준

- 적용 저장소: C:/Users/user/Documents/Codex/2026-09-16/bowlingmanager-mobile-api-v1-server-action/work/bowlingmanager
- 실제 Git 루트도 동일. 최초 main, 미커밋 변경 없음. 작업 브랜치: codex/web-ads-001.
- 초안 작업 트리: C:/Users/user/Documents/ChatGPT/볼링 사이트 & 앱/web-ads-001
- 초안 기준 HEAD와 적용 전·후 HEAD 모두 3b1f41e99461e30e568b8d7e1d6769dd7b113d18.
- 원격: https://github.com/sangdy85/bowlingmanager.git. src/, mobile/, prisma/ 존재.
- 저장소/상위 경로의 AGENTS.md 없음. README 및 DB_MODIFICATION_GUIDE를 읽었으며 운영 DB 절차는 실행하지 않았다.
- 사용자가 정정한 이후 바탕화면 저장소에서 pull/reset/merge/파일 덮어쓰기를 수행하지 않았다. 초안은 해당 과거 저장소 파일 전체가 아니라 동일 3b1f41e에서 만든 공개 웹 diff만 검토·적용했다.
- package.json/lockfile은 초안에서 복사하지 않았다. 대상 저장소 npm으로 Markdown 의존성만 추가했다.
- 모든 변경은 미커밋 상태. commit/push/merge/reset/Production 접근·배포 없음.

## CONFIRMED ISSUES — 확인된 문제와 조치

| 확인된 문제 | 관련 파일 | 조치 |
|---|---|---|
| 미정의 Tailwind식 클래스 때문에 공개 문서 스타일 불충분 | 기존 home/guide/정책 페이지 | 공개 전용 CSS Module 적용, 전역 CSS 미수정 |
| 비회원 홈의 주요 행동이 로그인으로 연결 | src/app/page.tsx | 공개 가이드·계산기 우선 배치, 로그인 회원의 기존 개인/팀 진입 보존 |
| 직접 만든 Markdown 렌더러가 표·중첩 목록·링크와 수식을 처리하지 못함 | src/app/guide/[slug]/page.tsx, src/lib/guide-data.ts | react-markdown + GFM, raw HTML 비활성, 링크 프로토콜 검증, 깨진 LaTeX를 읽을 수 있는 식으로 교체 |
| 확인되지 않은 전문 조직 작성자·일괄 검증 배너 | guide-data 및 상세 | 제거. 편집일과 전문 검수일을 구분 |
| JSX 별표·다른 언어 오타·확인되지 않은 정책 약속 | privacy/terms/disclaimer/About | 표시 오류 수정, 즉시 파기·가짜 담당팀/이메일·90% 실적 문구 정리 |
| 전역 광고 실행 | src/app/layout.tsx | 로더 제거, 소유권 meta/기존 publisher ID 유지 |
| 중복 robots 경로 및 Google 그룹의 제한 우회 | public/robots.txt, src/app/robots.ts | 정적 파일 제거, 단일 그룹과 경계 규칙 |
| canonical 누락·요청 시점 lastModified | public metadata/sitemap | URL별 canonical, 안정적인 편집일, 공개 URL만 sitemap |

## PUBLIC HOME / CSS / GUIDE RENDERER

네이비·블루 외곽과 밝은 문서 영역을 사용한다. 공개 내비게이션, 무료 도구, 대표 가이드, 회원 기능 구분, 작성 기준·문의 링크를 배치했다. 기존 RootLayout의 force-dynamic/AuthContext/NavbarWrapper 계약과 회원 메뉴 분기를 보존했다.

실제 computed style: 상세 본문 17px, line-height 29.75px, PC 본문 폭 780px. 홈 360/412/768/1440px에서 문서 가로 넘침 없음. 모바일 계산기·상세·소개·로그인과 PC 회원 화면을 확인했다. 키보드 포커스 3px 표시 및 목차 앵커의 상단 여백을 확인했다. **200% 확대는 브라우저 단축키가 적용되지 않아 NOT VERIFIED**. 화면 폭 검사는 실제 확대 검사를 대신하지 않는다.

본문은 초기 HTML에 포함되며 표·순서 목록·일반 링크·단순 수식이 렌더링된다. 17개 글의 SSR 본문에 raw **, \text{}, $$가 남지 않는 것을 검사했다. 모든 기존 15개 slug를 유지하고 신규 2개만 추가했다.

## CONTENT AUDIT / THREE PRIORITY ARTICLES

기존 15개 글의 독자 가치·사실관계·근거·렌더링 문제·유지/보완/통합 제안은 content-audit.md에 기록했다. 이는 전체 주장의 외부 사실검증 완료가 아니다.

- 점수 계산: USBC 기본 규칙 대조, 가상 10프레임 총점 168 및 누계·10프레임 경계 표.
- 평균·분포: A 140/150/160과 B 100/150/200, 평균 150.0, 모집단 표준편차 약 8.2/40.8, 가중 평균 예시 160.0.
- 동호회 운영: 참석·진행·점수 대조·정정 공지 체크리스트. 가상 일정/인원과 운영 제안임을 명시.

**기존 나머지 14개 글은 내용별 근거 검수와 수정이 남는다.** 특히 규격 수치, 스페어 산술/보드 좌표, KPBA 2026 공식 표제, 장비 관리 온도, 칼로리·부상/치료 조언을 우선 검수해야 한다. 이들 오류를 모두 정정했다고 보고하지 않는다. /about의 기존 기능 설명 전체도 최신 구현과 문장별 대조가 남는다.

## AVERAGE TOOL

/tools/average는 비회원 사용 가능. 0~300 정수, 최대 1000게임. 쉼표·공백·줄바꿈 구분, 빈 구분자는 제외하고 실제 0점은 집계. 계산 중 반올림하지 않고 평균 표시만 소수 1자리. 입력 저장/전송 코드와 DB 접근 없음. SSR에 식·가상 예시·이용 한계를 제공한다.

브라우저 결과: 120/150/180 → 3게임/450/150.0/최고180/최저120. 0/200 → 평균100.0. 빈값 오류, 301·150.5 거부, ,0, → 1게임/0/0.0. 초기화·예시 버튼 및 aria-live 결과 영역 확인.

## ADS / SEO / CRAWLER POLICY

광고 실행은 현재 전체 OFF. 공개 콘텐츠 allowlist는 홈과 대표 글 3개만 정의했고, 계산기·로그인·개인/관리·오류 페이지는 대상이 아니다. 향후 활성화 시 실제 로더 연결과 Console 페이지 제외 설정을 별도로 검증해야 한다. ownership meta 유지가 크롤러 정상 접근의 증거는 아니다.

robots는 exact/slash/query 경계를 구분한다. auth/noindex/robots/광고 정책은 각각 독립이다. 회원 관련 추가 layout은 robots metadata만 제공하며 인증/업무 로직은 변경하지 않는다. sitemap 24 URL, 문의 폼 제외. 공개 페이지 title 중복 없음/self canonical 확인. 현재 기존 기준의 non-www를 사용했으나 운영 리다이렉트 일치는 미검증이다.

## PRIVACY / AUTHORSHIP

코드상 Gemini 이미지 인식 전송, FCM 기기 토큰, 계정 탈퇴의 팀 소유 조건을 확인해 문구를 보완했다. 실재 미확인 작성자·검수자·이용자 수·후기를 새로 작성하지 않았다.

보유기간/백업 파기/해외 이전/정확한 담당자·연락처 수신 가능 여부/운영자 법적 지위는 운영자 확인이 필요하다. 정책 문구를 법률 검수 완료로 판정하지 않는다. 별도 연락처를 만들어 넣지 않았다.

## TESTS / REGRESSION

| 검사 | 결과 | 범위/한계 |
|---|---|---|
| npm run build | PASS | 격리 fixture 환경, exit 0. 빌드 설정이 type/lint를 생략하므로 별도 실행 |
| 공개 웹 단위 테스트 | PASS 7/7 | 계산 경계, 안전 링크, robots 경계, 광고 정책, 가이드/점수 예시 |
| 기존 Backend 포함 회귀 | PASS 326/326 | 공개 웹 7개 포함. 업로드 삭제 테스트 1개는 public/uploads 보호 때문에 제외 |
| 추가 인증·권한 DB/HTTP E2E | PASS 15, TODO 1 | 임시 SQLite만 사용. 기존 migration 재구성 검증 TODO는 미완료 |
| 로컬 HTTP | PASS | 34 page responses, 공개 24 URL, 실제404 2개, 기타8개, robots/sitemap, 모바일 login200/anon401/me200/teams200 |
| TypeScript 별도 검사 | FAIL 22 errors | 변경하지 않은 Next 동적 params 경로 검사18, 기존 reset-test-lane 스크립트4. 변경 공개 소스 오류 없음 |
| lint 별도 검사 | FAIL 6 errors / 19 warnings | 오류는 미변경 DailyScoreTable:167, RoundDetailPageContent:225, TournamentManager:375 각2. 공개 변경 파일 오류0 |
| git diff --check | PASS | 후행 공백 정리 후 exit0 |
| 보호 파일/기존 의존성 보존 | PASS | 보호 경로 diff0, 기존 lock 패키지 버전 변경/삭제0 |

초기 TypeScript는 7개 오류였다. About의 잘못된 미사용 import 2개를 수정했다. 최종 빌드는 초기에는 없던 .next/types 검사를 생성하여 미변경 동적 경로의 잠재 오류를 추가로 드러냈다. 숫자 증가를 공개 웹 변경의 신규 오류로 단정하지 않는다. 초기 lint16 errors/19 warnings에서 최종6/19로 감소했다.

가상 fixture는 qa-artifacts/fixture.db 하나와 독립 임시 테스트 DB만 사용했다. .env* 읽기를 차단하는 preload와 최소 환경변수 runner를 사용했다. 실사용 DB/업로드/회원 이메일·토큰은 사용하지 않았다. Node24 환경에서 검사했고 package engines Node20과 차이가 있으므로 배포 런타임 검증은 별도이다.

실제 브라우저: 비로그인 PC 및360px 홈→가이드→상세→도구, PC 관련 글 이동, 계산기 검증. 가상 회원 로그인/로그아웃, 개인 기록실3게임/450/150.0, 팀 목록·상세, 계정 설정, 볼링장 목록·상세, 소개 탭 전환 확인. 회원 페이지 광고0/noindex 확인. 대회 생성은 fixture 회원이 기존 managers 조건을 만족하지 않아 볼링장으로 돌아갔다. 해당 생성 기능은 NOT VERIFIED. OCR/푸시/결제/실제 데이터 수정은 실행하지 않았다. 기준 화면과 픽셀 단위 비교 및 모든 역할·업무 변경 흐름은 미검증이다.

## DEPENDENCIES

직접 추가: react-markdown 10.1.0, remark-gfm 4.0.1 (정확 버전). npm lockfile 신규 전이 패키지 항목96개. 기존 dependency 버전/삭제0. 일부 lock 메타데이터는 npm이 정규화했다. package 전체 교체 및 무관한 업·다운그레이드 없음.

## CHANGED FILES

아래32개 코드/의존성/테스트 파일에 이 보고서와 content-audit.md를 추가했다.

- package-lock.json
- package.json
- public/robots.txt
- src/app/about/page.tsx
- src/app/disclaimer/page.tsx
- src/app/guide/[slug]/page.tsx
- src/app/guide/page.tsx
- src/app/layout.tsx
- src/app/page.tsx
- src/app/privacy/page.tsx
- src/app/robots.ts
- src/app/sitemap.ts
- src/app/terms/page.tsx
- src/components/AboutPageContent.tsx
- src/components/Footer.tsx
- src/components/Navbar.tsx
- src/lib/guide-data.ts
- src/app/login/layout.tsx
- src/app/personal/layout.tsx
- src/app/register/layout.tsx
- src/app/reset-password/layout.tsx
- src/app/settings/layout.tsx
- src/app/stats/layout.tsx
- src/app/team/layout.tsx
- src/app/tools/average/page.tsx
- src/components/public/AverageCalculator.tsx
- src/components/public/Public.module.css
- src/components/public/PublicNav.tsx
- src/lib/average-calculator.ts
- src/lib/priority-guides.ts
- src/lib/public-web.ts
- tests/public-web.test.cjs

- docs/web-ads-001/local-report.md
- docs/web-ads-001/content-audit.md

public/robots.txt는 중복 경로 해소를 위한 삭제이며 src/app/robots.ts가 응답한다. mobile/, API/서비스/auth/Server Action/Prisma/Firebase/.env/키/업로드 변경 없음. 회원용 신규 layout 7개는 metadata만 추가했다. 공유 Navbar는 접근성 속성, Footer는 공개 안내, RootLayout는 광고 로더 제거에 한정했다. 최신 3b1f41e의 업무 기능을 되돌리는 코드 변경 없음.

## TEST ARTIFACTS / SCREENSHOTS

자료 위치: C:/Users/user/Documents/ChatGPT/볼링 사이트 & 앱/qa-artifacts/

- build-final.txt, public-tests.txt, backend-tests.txt, backend-e2e.txt
- types.txt, lint.json, http-results.json, browser-results.json
- final-scope.json, reviewed-full-diff.txt
- home-360.png, home-412.png, home-768.png, home-1440.png
- guide-mobile-360.png, guide-pc-1440.png
- calculator-mobile-360.png, calculator-mobile-412.png, calculator-pc-1440.png
- login-mobile-360.png, member-personal-360.png, member-personal-1440.png, member-team-1440.png
- about-mobile-412.png, about-pc-1440.png

화면 서버는 검증 후 종료했다. E2E가 개발 빌드 캐시를 생성하므로 다시 production preview를 시작할 때는 격리 runner로 build 후 start해야 한다. 마지막 성공 production build 이후 소스 차이는 개인정보 페이지의 공백 정리뿐이다.

## NOT VERIFIED / SECOND PASS

1. Production HTTP, Google/AdSense 크롤러, Nginx/방화벽, Search Console, www 리다이렉트.
2. AdSense Console 자동광고·페이지 제외 설정 및 실제 재심사 결과. 소유권 확인과 콘텐츠 거절을 별개로 취급한다.
3. 기존14개 가이드의 주장별 출처/전문 검수 및 알려진 오류 정정. 건강·통증/치료, KPBA, 장비 수치를 우선한다.
4. /about 기존 기능 설명 전체, 실제 운영자 소개/문의처/정책 보유기간의 확인.
5. 200% 확대, 전체 역할·대회 생성·OCR/푸시·회원 업무의 실기기 회귀, Node20 환경, 기존 type/lint 및 migration TODO.

이 결과만으로 사이트 전체 개선 또는 AdSense 승인을 보장하지 않는다. 배포·재심사 전에 남은 검증과 콘텐츠 정정이 필요하다.
