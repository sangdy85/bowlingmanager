# Executive Summary

감사 기준은 `codex/web-ads-001` 브랜치의 HEAD `3b1f41e99461e30e568b8d7e1d6769dd7b113d18`과 그 위에 누적된 미커밋 WEB-ADS 변경이다. 실제 저장소는 수정하지 않은 채 별도 임시 복사본과 가상 SQLite 데이터로 빌드·테스트·브라우저 검증을 수행했다.

런타임 기준 콘텐츠 상태는 **published 13개, merged 2개, unpublished 3개**로 요구사항과 일치한다. 비공개 글은 목록·홈·사이트맵·내부 링크에서 노출되지 않고 직접 요청 시 404이며, 병합 글은 새 canonical 글로 한 번의 308 응답 후 200으로 도착한다. 공개 13개, 평균 계산기, canonical, robots, sitemap, AdSense 코드 경계도 대체로 의도대로 동작했다. 공개 웹 테스트 15개, 기존 백엔드 테스트 319개, 인증·권한 SQLite/HTTP 테스트 15개가 통과했고 프로덕션 빌드도 성공했다.

확인된 Release Blocker는 없다. 다만 배포 전 수정이 강하게 권장되는 High Priority 문제는 3개다. 공개 스페어 글의 왼손잡이 방향 설명이 인용 자료로 뒷받침되지 않고, `/about`의 개인 프로필 계산 설명이 실제 계산식과 다르며, 현재 build/lint 설정이 22개의 TypeScript 오류와 6개의 ESLint 오류를 통과시킨다. 이 중 TypeScript·ESLint 오류 자체는 WEB-ADS 변경 밖의 기존 파일에서 확인됐지만, 성공한 build만으로 릴리스 건전성을 판단할 수 없는 상태다.

이 감사는 AdSense 승인 가능성을 점수화하거나 보장하지 않는다. 소유권 메타 태그의 존재, 로컬 코드에 광고 실행 로더가 없는 점, 공개 콘텐츠 품질을 각각 독립적으로 확인했다.

# Release Blockers

**확인된 blocker 없음.** 요청된 허위 신뢰 문구(전문가 검수 완료, 공식 인증, 가공 조직명 등)는 공개 렌더링에서 확인되지 않았다. 아래 High Priority 3건을 수정하고 다시 검증한 뒤 배포하는 것을 권장한다.

# High Priority

## H-1. 개인 프로필 지표 설명과 실제 계산식이 다름

- **심각도:** High
- **파일/위치:** `src/components/AboutPageContent.tsx:335`, `:343`, `:350`, `:357`; 실제 계산은 `src/lib/personal-profile.ts:89-107`
- **재현 방법:** `/about`에서 “오각형 스파이더 그래프 5대 지표 산출 방식”을 읽고, `calculatePersonalProfile()`에 정기전 세션 평균 230점을 3회 입력한다.
- **실제 문제:** 안내문은 평균 230점이 100%라고 설명하지만 실제 식 `boundedPoint(average, 234, 0.1)`의 결과는 9.6/10이다. 포텐셜·안정감도 “상위 하이 스코어 평균”, “수비력 진단”으로 표현되지만 코드는 각각 **최고 세션 평균**과 **최저 세션 평균**을 사용한다. 레인 오일이나 투구 실수를 진단하지 않는다. “100% 참사”라는 오타도 있다.
- **권장 수정 방향:** 코드의 234점 기준, 최고/최저 세션 평균, 출석률 산식을 그대로 설명하고 “순간 폭발력 진단”, “수비력 측정” 같은 원인·능력 진단 표현을 제거한다. `참사`를 `참가`로 수정한다. 계산식을 바꾸려면 회원 화면 결과와 기존 기록 영향까지 별도 검증한다.

## H-2. 왼손잡이 스페어 이동 방향이 출처보다 넓게 단정됨

- **심각도:** High
- **파일/위치:** `src/lib/guide-data.ts:756`, 공개 URL `/guide/spare-pickup-theory-and-3-6-9-system-guide`
- **재현 방법:** “키 핀과 개인 기준점” 문단의 “왼손잡이는 방향을 반대로 시험할 수 있습니다”를 연결된 USBC `Picking Up the Spare` 자료와 대조한다.
- **실제 문제:** 출처는 키 핀 위치에 따라 발을 반대 방향으로 옮기는 원칙을 설명한다. 같은 키 핀을 처리할 때 손잡이만을 이유로 좌우 이동 방향을 통째로 뒤집는다는 근거는 해당 자료에서 확인되지 않았다. 다음 문단은 손잡이 구분 없이 “키 핀 방향에 따라 발을 반대쪽”이라고 써서 글 내부에서도 기준이 충돌한다.
- **권장 수정 방향:** 왼손잡이 전체에 대한 반전 문장을 제거한다. 키 핀의 실제 좌우 위치, 투구 손, 개인 드리프트와 공 경로를 구분해 조건부 예시로 다시 쓰고, 필요하면 왼손 투구를 직접 다루는 권위 있는 출처로 보강한다.

## H-3. build와 기본 lint가 실제 정적 오류를 차단하지 않음

- **심각도:** High
- **파일/위치:** `next.config.mjs:17-20`, `package.json:12`; 오류 파일은 주로 `.next/types/**`, `scripts/reset-test-lane.ts`, `src/components/DailyScoreTable.tsx`, `src/components/tournaments/RoundDetailPageContent.tsx`, `src/components/tournaments/TournamentManager.tsx`
- **재현 방법:** `npm run build`, `npm run lint`, `npx tsc --noEmit --incremental false`, 그리고 `eslint src --ext .ts,.tsx`를 각각 실행한다.
- **실제 문제:** build는 `eslint.ignoreDuringBuilds: true`와 `typescript.ignoreBuildErrors: true` 때문에 성공한다. `npm run lint`의 bare `eslint`는 검사 대상 없이 종료 코드 0을 반환했다. 명시적 TypeScript 검사에서는 22개 오류, 명시적 ESLint 검사에서는 6개 오류와 19개 경고가 나왔다. 확인된 6개 lint 오류와 22개 type 오류는 WEB-ADS 변경 파일에서 새로 생긴 것으로 보이지 않지만, 현재 릴리스 게이트가 이 오류들을 가린다.
- **권장 수정 방향:** lint 스크립트에 `src`와 확장자를 명시하고 CI에서 `tsc --noEmit`을 별도 필수 단계로 둔다. 기존 오류를 정리한 후 ignore 설정을 제거하거나, 최소한 별도 실패 게이트가 작동하는지 확인한다. WEB-ADS 변경과 기존 오류 수정은 커밋 범위를 분리해 검토한다.

# Medium Priority

## M-1. 병합 slug 조회가 Object 프로토타입 키를 legacy redirect로 오인함

- **심각도:** Medium
- **파일/위치:** `src/lib/guide-data.ts:1355-1367`, `findMergedGuideDestination()`
- **재현 방법:** 로컬 서버에서 `/guide/toString`을 요청한다.
- **실제 문제:** 응답이 308이고 Location은 `/guide/function%20toString()%20%7B%20%5Bnative%20code%5D%20%7D`가 된다. `MERGED_GUIDE_REDIRECTS[slug]`가 `Object.prototype.toString` 같은 상속 속성을 값으로 받아들이기 때문이다. 목적지는 404가 되며 canonical 생성도 같은 비정상 값을 사용할 수 있다.
- **권장 수정 방향:** `Map`을 사용하거나 `Object.hasOwn(MERGED_GUIDE_REDIRECTS, slug)`로 own property만 허용한다. 목적지가 published slug인지 검증하고 `toString`, `constructor`, `__proto__` 회귀 테스트를 추가한다.

## M-2. 공개 글의 정정 경로가 비회원에게 실질적으로 열려 있지 않음

- **심각도:** Medium
- **파일/위치:** `src/app/guide/[slug]/page.tsx:52`, `src/components/InquiryPageContent.tsx:131`, `/inquiry`
- **재현 방법:** 로그아웃 상태에서 공개 가이드 하단 “문의 페이지”를 열고 정정 내용을 제출하려 한다.
- **실제 문제:** `/inquiry`는 200으로 열리지만 문의 작성은 로그인해야 한다. 가이드와 `/about`은 공개 정정 창구처럼 안내하므로 비회원 독자는 계정 생성 없이 오류를 알릴 수 없다. 책임 고지에 이메일이 표시되지만 공개 글의 정정 안내에는 그 대안이 없다.
- **권장 수정 방향:** 검증된 공개 이메일 또는 제한된 비회원 정정 폼을 명시하거나, 링크 문구에 로그인이 필요함을 분명히 표시한다. 스팸·개인정보 처리 방식과 실제 운영 가능한 수신 경로도 함께 확정한다.

## M-3. 책임 고지에 비공개 처리된 KPBA 규정 요약이 여전히 제공 콘텐츠로 기재됨

- **심각도:** Medium
- **파일/위치:** `src/app/disclaimer/page.tsx:29`
- **재현 방법:** `/disclaimer`의 1항을 읽은 뒤 `/guide/kpba-official-bowling-tournament-rules-2026`을 요청한다.
- **실제 문제:** 고지는 “KPBA 경기 규정 요약”을 제공 콘텐츠로 열거하지만 해당 가이드는 unpublished이며 직접 URL도 404다. 현재 공개 범위와 신뢰 문서가 맞지 않는다.
- **권장 수정 방향:** 공개하지 않는 동안 해당 문구를 제거하거나 일반적인 “경기 규칙 안내”로 범위를 좁힌다. 다시 공개할 때는 원문과 최신성 검증을 별도 수행한다.

## M-4. 기존 팀 상세 화면에서 모바일 가로 넘침이 발생함

- **심각도:** Medium
- **파일/위치:** `src/app/team/[teamId]/page.tsx:131-155`의 헤더와 고정 최소 너비 버튼. 이 파일은 WEB-ADS diff에 포함되지 않음.
- **재현 방법:** 가상 팀이 있는 계정으로 로그인해 390×844에서 팀 상세 화면을 연다.
- **실제 문제:** 문서 `clientWidth` 375px에 `scrollWidth` 400px가 측정됐다. 팀명과 최소 100px 버튼들이 한 행에서 압축되며 버튼 글자가 한 글자씩 줄바꿈되고 우측이 잘린다. 공개 CSS에서 새로 생긴 회귀라는 증거는 없고, 변경되지 않은 기존 팀 상세 레이아웃의 문제로 판단된다.
- **권장 수정 방향:** 작은 화면에서 헤더를 세로 배치하고 버튼 래핑 또는 100% 너비를 적용한다. 수정 후 390px 및 더 좁은 화면에서 팀명·버튼·탭의 가로 넘침을 재검증한다.

# Low Priority

## L-1. 확인 가능한 참고자료 발행일 메타데이터가 일부 비어 있음

- **심각도:** Low
- **파일/위치:** `src/lib/guide-data.ts:1110-1120` 부근의 USBC Ball Selection 및 Storm Questions Before Buying 참고자료
- **재현 방법:** 두 원문 페이지의 표시 발행일과 `GuideReference.publishedAt`을 비교한다.
- **실제 문제:** 원문에서 확인 가능한 발행일이 있지만 구조화된 참고자료에는 `publishedAt`이 없다. 제목·publisher·URL·scope는 존재하므로 출처 식별이나 안전성 문제는 아니다.
- **권장 수정 방향:** 원문에서 확인되는 날짜만 `publishedAt`으로 보강한다. 날짜가 표시되지 않는 자료에는 추정값을 넣지 않는다.

## L-2. 신뢰/약관 문서의 heading 단계가 H1 다음 H3로 건너뜀

- **심각도:** Low
- **파일/위치:** `src/app/privacy/page.tsx:25` 이후, `src/app/terms/page.tsx:25` 이후, `src/app/disclaimer/page.tsx:25` 이후
- **재현 방법:** 브라우저 접근성 트리에서 각 페이지의 heading 순서를 확인한다.
- **실제 문제:** 페이지 제목 H1 다음 주요 절들이 H3로 렌더링된다. 시각적 이해에는 큰 문제가 없지만 보조기술 사용자가 문서 구조를 탐색하기 어렵다.
- **권장 수정 방향:** 최상위 절 제목을 H2로 바꾸고 실제 하위 절에만 H3를 사용한다. CSS는 요소명과 분리해 현재 시각 스타일을 유지한다.

## L-3. `/inquiry`의 검색 메타 정책이 다른 회원 작업 화면과 일관되지 않음

- **심각도:** Low
- **파일/위치:** `src/app/inquiry/page.tsx:5-8`
- **재현 방법:** 로그아웃 상태 `/inquiry`의 `<head>`를 login/register/personal 등의 metadata와 비교한다.
- **실제 문제:** 문의 페이지는 고유 canonical이 없고 기본 index 가능 상태다. 실제 핵심 기능은 로그인 후의 문의 작성·내역이라, 검색 결과에 노출할 공개 콘텐츠 가치가 제한적이다.
- **권장 수정 방향:** 공개 문의 안내 페이지로 확장하고 canonical을 지정하거나, 회원 작업 화면으로 볼 경우 `noindex, nofollow`를 명시한다.

# Confirmed Good

- 홈페이지는 비회원이 가이드, 평균 계산기, 서비스 설명으로 바로 이동할 수 있고 로그인 CTA만으로 구성되지 않았다. 허위 사용량, 후기, 평점, 전문가 배지는 확인되지 않았다.
- 공개 가이드는 13개이며 모두 고유 title, description, `https://bowlingmanager.co.kr` 기준 self-canonical을 가진다. `lastReviewed`는 모두 존재하고 2026-09-30을 넘지 않으며 작성일보다 빠르지 않다.
- 외부 출처가 없는 글은 가짜 참고문헌 대신 `reviewNote`를 쓴다. 출처가 있는 글은 title, publisher, HTTPS URL, scope를 가진다.
- Markdown 렌더러는 `skipHtml`을 사용하고 `rehype-raw`를 사용하지 않는다. `safeContentUrl`은 `javascript:`, `data:`, `vbscript:`, `http:`, 프로토콜 상대 URL과 제어문자·공백·역슬래시를 거부한다. 외부 링크에는 `noopener noreferrer`가 적용된다.
- relatedArticles는 총 38개로 모두 현재 published slug를 가리키며 자기 자신, merged, unpublished, 존재하지 않는 slug가 없다. 관련 도구 링크 3개는 모두 `/tools/average`이고 실제로 200을 반환한다.
- 1440×900과 390×844에서 홈, 가이드 목록, 평균 계산기, about, privacy, terms, disclaimer, inquiry와 공개 가이드 13개를 확인했다. 공개 페이지에는 전역 가로 넘침이 없었고 긴 제목·출처명·표는 컨테이너 안에서 처리됐다.
- `react-markdown` 10.1.0과 `remark-gfm` 4.0.1은 직접 의존성과 lockfile이 일치했다. 기존 lockfile package의 버전 변경·삭제는 없고 새 의존성 트리만 추가됐다.

# Content Accuracy

| 공개 가이드 | 검증 결과 |
|---|---|
| `bowling-scoring-system` | X 뒤 7/ = 20, 전 프레임 5/와 보너스 5 = 150, 168점 누계, 10프레임 open/spare/strike 예제, 12연속 스트라이크 300을 독립 계산해 일치 확인. |
| `beginner-bowling-etiquette` | 먼저 어프로치에 오른 사람 우선, 동시 접근이 애매할 때 오른쪽 양보, 시설별 규칙 우선을 구분해 절대 규칙으로 쓰지 않음. |
| `bowling-ball-selection-guide` | 편안함·제어·피팅 중심이며 성별 고정 무게, 전원 14~15lb 처방을 하지 않음. |
| `bowling-specifications-and-dimensions` | USBC 03/26 장비 규격과 대조: 레인 60ft ± 0.5in, 폭 41.5in ± 0.5in, 어프로치 최소 15ft, 공 최대 16lb, 지름 8.500~8.595in, 13lb 이상 RG와 differential 범위를 일치 확인. |
| `advanced-bowling-techniques-and-theory` | Rule of 31을 시작 가설로 제한하고, 한 변수씩 실제 반응을 관찰하도록 설명. 자동 레인 분석 기능을 주장하지 않음. |
| `bowling-ball-specifications-coverstock-core-rg-diff-guide` | coverstock/core/RG/differential 정의와 USBC 비대칭 기준 범위를 확인. Hybrid 50/50, cover 70% 같은 고정 비율 없음. |
| `spare-pickup-theory-and-3-6-9-system-guide` | 5/ 반복 150점과 키 핀 기본 원칙은 맞음. 왼손잡이 방향 반전 문장은 H-2로 보고. |
| `bowling-lane-oiling-patterns-and-strategy` | mL, units, 보드별 양을 구분하고 총량만으로 난도를 단정하지 않음. Dead Man's Curve 예시와 Rule of 31의 제한적 사용을 원문과 대조. |
| `bowling-shoes-wrist-support-and-care-guide` | Dexter S2~S12 상대적 슬라이드 단계와 Storm의 일반 관리 범위를 확인. 45℃ DIY 디오일링, 아대 효과 보장 없음. |
| `bowling-mental-game-and-pre-shot-routine-guide` | 개인 루틴·관찰 중심. 80%, 100% 재현, 3초, 10초 완전 리셋 같은 근거 없는 수치 없음. |
| `average-and-score-distribution` | 120/150/180의 합계 450·평균 150, 120/180의 평균 150과 모집단 분산 900·표준편차 약 30, 가중 평균 예제를 확인. 서비스가 표준편차를 자동 제공한다고 주장하지 않음. |
| `club-event-checklist` | 12명×3게임=36게임, 결석 1명으로 35게임 예제를 확인. OCR은 이름·게임별 최종점수 입력 보조이며 사람의 검수를 명시. |
| `bowling-practice-checklist` | 한 변수씩 관찰, 오른손 4스텝, 5~10회가 예시임을 분명히 함. 자세·보드·RPM·심리 자동 분석 기능을 제공하지 않는다고 명시. |

참고 원문은 USBC Keeping Score, World Bowling Universal Playing Rules, USBC Equipment Specifications 03/26, USBC Bowling Etiquette/Ball Selection/Picking Up the Spare, Kegel 오일 패턴 자료, Dexter sole guide, Storm 볼 선택·관리 자료 등 13개 고유 HTTPS URL을 수집해 현재 열리는 문서와 범위를 대조했다. 외부 서버의 일시 응답은 제품 코드 오류와 분리했다.

# Routing / Canonical / Sitemap / Robots

- 상태 집계는 `published: 13`, `merged: 2`, `unpublished: 3`이다. `generateStaticParams()`도 published만 반환한다.
- unpublished 3개(`kpba-official-bowling-tournament-rules-2026`, `health-benefits-and-effects-of-bowling`, `bowling-injury-prevention-and-stretching-guide`)는 목록·홈·sitemap·relatedArticles·공개 내부 링크에서 발견되지 않았다. 직접 URL은 404, `noindex`, canonical 없음이다.
- merged 2개(`average-improvement-tips`, `bowling-basic-posture-guide`)는 각각 한 번의 308로 `/guide/bowling-practice-checklist`에 도착하고 이어서 200이다. loop·추가 chain은 없고 legacy URL은 목록·sitemap·내부 링크에 없다. redirect metadata는 `noindex, follow`와 대상 canonical로 일치한다.
- 존재하지 않는 일반 route와 guide slug는 404, `noindex`, canonical 없음이다.
- sitemap은 정적 공개 URL 7개와 가이드 13개, 총 20개다. 가이드의 실제 수정일을 사용하고 요청 시각으로 `lastModified`를 매번 바꾸지 않는다.
- canonical origin은 코드에서 `https://bowlingmanager.co.kr`로 고정되어 있다. 환경변수 fallback으로 다른 origin이 섞이는 구조는 없다. 실제 운영의 HTTP→HTTPS 및 www→non-www redirect는 Production-Only Checks에 남겼다.
- `robots.ts`는 하나의 `User-agent: *` 그룹을 생성하고 private 경로를 disallow한다. Googlebot 또는 Mediapartners-Google 전용 allow 그룹이 일반 disallow를 덮는 구조는 없다. robots는 보안 장치로 간주하지 않았고, 인증·권한 테스트를 별도로 수행했다.
- M-1의 프로토타입 키 edge case는 수정 필요하다.

# AdSense Integration

- root metadata의 `google-adsense-account` 값 `ca-pub-6753153221253393`은 유지된다. 이는 사이트 소유권 확인 신호다.
- 소스와 실제 렌더링을 확인한 범위에서 AdSense JS loader, `adsbygoogle` push, 수동 광고 슬롯/컴포넌트는 없다. 홈, guide/list/detail, tools, login, register, reset-password, personal, team, admin redirect, settings, 404에서 광고 script가 로드되지 않았다.
- 따라서 현재 로컬 코드에서는 회원 업무 화면이나 얇은 오류 화면에서 광고를 실행하는 경계 문제를 확인하지 못했다.
- Google 측 자동광고 설정, ads.txt 운영 응답, 실제 광고 게재 여부와 계정 상태는 로컬 코드만으로 확인할 수 없다. 소유권 메타가 있다는 이유로 광고 실행 또는 정책 준수·승인을 단정하지 않는다.

# Privacy / Trust Pages

- `/privacy`, `/terms`, `/disclaimer`, `/inquiry`, `/about`은 모두 200으로 렌더링되며 깨진 Markdown은 확인되지 않았다.
- 개인정보처리방침은 Gemini로 이미지와 인식 필요 정보를 전송하는 점, FCM 기기 토큰, 평균 계산기의 브라우저 내 계산, AdSense 쿠키 가능성을 구분해 고지한다. 설정 화면의 실제 회원 탈퇴 action도 확인했다.
- 보유·파기 절은 탈퇴 절차를 설명하지만 구체 보유기간, 백업·수탁자 삭제 시점 등 실제 운영 정책은 코드만으로 확정할 수 없다. 법적 적정성을 판단하지 않았으며 운영 사실과 문구를 배포 전에 대조해야 한다.
- “전문가 검수 완료”, “공식 인증”, “BowlingManager 연구소”, “에티켓 위원회”, “코칭스태프”, “건강 & 코칭팀”, “규정위원회”, “기술 규격팀”은 공개 페이지에서 확인되지 않았다. `/about`은 편집일이 전문가 검수일이 아니라고 명시한다.
- H-1, M-2, M-3과 L-2를 수정 또는 운영 확인해야 한다. `info@bowlingmanager.co.kr`의 실제 수신 가능 여부와 개인정보처리 책임 주체는 로컬에서 확인할 수 없다.

# Accessibility

- 키보드로 모바일 navbar 메뉴를 열고 링크로 이동했다. guide 관련 글, 참고자료, 문의 링크는 Tab 포커스와 Enter 활성화가 동작했다.
- 포커스 시 3px 실선 outline이 확인됐다. 평균 계산기 textarea와 버튼도 키보드로 조작 가능했다.
- 계산기는 label, 도움말 연결, 오류 시 `aria-invalid`, `aria-live="polite"`, `aria-atomic`을 제공한다.
- 공개 가이드는 H1 뒤 H2/H3 구조와 목차 anchor가 일치했다. 표 영역에는 “좌우로 스크롤 가능” 접근 가능한 이름이 있다.
- guide 카드의 제목 링크는 의미 있는 이름을 사용하고, 외부 참고자료도 원문 제목을 링크명으로 사용한다.
- privacy/terms/disclaimer의 heading 단계는 L-2로 보고했다. `/about`의 탭 버튼은 동작하지만 tablist/tab/aria-selected 의미 구조는 없어 후속 개선 대상으로 볼 수 있다.
- 실제 screen reader와 200% 브라우저 확대 검사는 완료하지 못했다. PC와 모바일 viewport 검사 결과로 이를 대체하지 않는다.

# Member-Side Regression

- 실제 운영 데이터나 계정을 사용하지 않았다. 별도 SQLite DB에 가상 사용자, 가상 팀, 120/150/180 점수만 생성했다.
- 로그인, 개인 기록, 팀 목록·상세 진입이 동작했다. 개인 기록은 3게임, 총점 450, 평균 150.0으로 표시됐고 팀 기록 집계도 일치했다.
- personal/team/stats/login/register/reset-password는 의도한 noindex metadata를 갖는다. 비인증 personal/team/stats는 login으로 307 redirect된다. admin 비권한 경로는 `/`로 307 redirect된다.
- 공개 페이지 전용 CSS는 `.bm-public-about` 등으로 범위가 제한되고 `globals.css`는 변경되지 않았다. 회원 화면에 AdSense loader도 없다.
- 390px 팀 상세의 기존 가로 넘침은 M-4로 분리했다. 해당 파일이 WEB-ADS 변경 밖이므로 이번 변경으로 생긴 회귀로 판정하지 않았다.

# Test Results

| 검사 | 결과 | 비고 |
|---|---:|---|
| 공개 웹 테스트 | 15/15 통과 | 상태, canonical, sitemap, 계산기, 안전 URL 포함 |
| 기존 백엔드 테스트 | 319/319 통과 | 임시 복사본과 격리 환경 사용 |
| 인증·권한 SQLite/HTTP | 15 통과, 1 TODO, 0 실패 | 실제 임시 SQLite/HTTP 경계; TODO는 기존 migration schema 재구성 항목 |
| `npm run build` | 통과 | H-3의 ignore 설정 때문에 type/lint 건전성을 증명하지 않음 |
| `npm run lint` | 종료 코드 0 | 대상 없는 bare `eslint`; 실질 검증 아님 |
| 명시적 ESLint `src` | 6 errors, 19 warnings | 6 errors는 WEB-ADS 변경 밖의 기존 파일 |
| `tsc --noEmit --incremental false` | 22 errors | 18개 Next route/page params 타입 + `scripts/reset-test-lane.ts` 4개; WEB-ADS 신규 오류는 확인되지 않음 |
| `git diff --check` | 통과 | whitespace error 없음; LF→CRLF 경고는 있음 |
| 평균 계산기 브라우저 경계값 | 통과 | 120/150/180, 빈값, 1게임, 0, 300, 301, 음수, 소수, 문자열, 공백, 줄바꿈/탭/쉼표 검사 |
| HTTP/metadata route 검사 | 통과(보고 이슈 제외) | 39개 route + 모든 published/merged/unpublished 상태 확인 |
| 반응형 브라우저 검사 | 공개 화면 통과 | 1440×900, 390×844; member team 상세는 M-4 |

초기 임시 복사본에서 누락된 route와 동시 Prisma 실행 때문에 발생한 harness 오류는 전체 `src`/의존성 복사와 순차 실행으로 해소한 뒤 결과에서 제외했다. 테스트 중 패키지는 설치하지 않았고 실제 `.env`, 업로드, DB, 백업, 운영 데이터는 복사하거나 사용하지 않았다. 실행 환경은 Node 24.13.0/npm 11.6.2였으며 `package.json`의 Node 20.x 환경 자체는 별도로 실행 확인하지 못했다.

# Git Scope Audit

- 브랜치와 HEAD는 각각 `codex/web-ads-001`, `3b1f41e99461e30e568b8d7e1d6769dd7b113d18`로 일치했다.
- 감사 시작 시 tracked 변경은 17개(수정 16, 삭제 1)였다. untracked에는 이전 WEB-ADS 보고서 3개, 회원 route metadata layout 7개, 공개 평균 도구·컴포넌트·lib·테스트가 있었다.
- 보호 영역 `mobile/`, `prisma/`, `src/app/api/mobile/`, 인증 업무 로직, 서비스 핵심 로직, Firebase/FCM, 환경변수, 운영 데이터 처리 파일에는 HEAD 대비 변경이 없었다.
- 공유 파일 중 root layout, Navbar, Footer, package files는 변경됐고 globals.css, Next config는 WEB-ADS diff에서 변경되지 않았다. root layout은 ads loader 제거/metadata 유지, Navbar는 모바일 접근성 속성, Footer는 공개 링크 구성을 확인했다.
- `react-markdown`과 `remark-gfm` 추가 외에 기존 lockfile package 버전 변경·삭제는 없었다. 새 transitive package는 96개다.
- 저장소 내부에 이번 감사가 만든 audit/rewrite/stage 임시 스크립트는 남기지 않았다. 기존 `tmp/find_ids.*`, `swap_teams.js`, `tmp_apply_schedule.js`는 감사 전부터 추적 중인 파일이어서 변경·삭제하지 않았다.
- 감사 중 실제 소스 파일 hash는 시작 snapshot과 동일했다. 금지된 reset/restore/clean/stash/pull/merge/rebase를 실행하지 않았고 commit, push, 배포도 하지 않았다. 이 `docs/web-ads-qa-001/final-audit.md`만 종료 산출물로 추가한다.

# Production-Only Checks

다음 항목은 프로덕션 접근 금지 조건 때문에 미검증이다.

- `http://`, `https://`, `www`, non-www 각 host의 실제 301/308 정규화와 CDN/프록시 캐시 동작
- 배포된 `/robots.txt`, `/sitemap.xml`, `/ads.txt`의 실제 응답·Content-Type·캐시 및 Search Console 인식
- Google AdSense 계정의 사이트 소유권 상태, 자동광고 설정, 광고 실제 게재 위치, 정책 알림·승인 여부
- `info@bowlingmanager.co.kr`의 실제 수신과 문의 운영 SLA, 개인정보처리 책임자·회사 표기의 실재 및 최신성
- 운영 DB migration 적용, 운영 환경변수, 실제 회원 데이터에 대한 회귀
- 외부 reference URL의 장기 가용성·지역별 차단·향후 내용 변경
- 실제 screen reader, 200% 확대, Node 20.x 배포 런타임

# Final Pre-Deploy Checklist

- [ ] H-1의 `/about` 개인 프로필 설명을 실제 계산식과 일치시키고 230/234/250/200 경계값을 재검증한다.
- [ ] H-2의 왼손잡이 스페어 방향 문장을 제거·교정하고 출처 scope를 다시 확인한다.
- [ ] H-3의 lint/type 게이트를 실질적으로 작동시키고 22 type errors, 6 lint errors를 처리 또는 명시적으로 격리한다.
- [ ] M-1의 inherited-key redirect를 막고 `toString`, `constructor`, `__proto__` 회귀 테스트를 추가한다.
- [ ] 공개 정정 문의 경로와 KPBA 고지 문구를 현재 운영 상태에 맞춘다.
- [ ] 390px 팀 상세 가로 넘침을 수정하거나 이번 릴리스의 알려진 기존 문제로 명시한다.
- [ ] 공개 15개 테스트, 백엔드 319개 테스트, 인증·권한 경계 테스트, 명시적 lint/typecheck, build, `git diff --check`를 동일 Node 20.x 배포 환경에서 다시 실행한다.
- [ ] 배포 직전 git diff에서 보호 영역과 의도하지 않은 임시 파일이 없는지 다시 확인한다.
- [ ] 배포 후 프로덕션 host 정규화, robots/sitemap/ads.txt, canonical, 404/redirect를 확인한다.
- [ ] AdSense 자동광고 설정이 있다면 회원 업무·login·오류 페이지 제외를 실제 광고 요청 기준으로 확인한다.
- [ ] Search Console과 AdSense 결과는 별도 운영 관찰로 다루며 승인 가능성을 사전 보장하지 않는다.
