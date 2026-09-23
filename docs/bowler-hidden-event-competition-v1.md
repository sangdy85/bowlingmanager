# Bowler Hidden EVENT Competition V1

EVENT는 Bowler Hidden 플래그가 켜진 동호회에서만 사용하는 개인 이벤트전이다. 참가자의 실제 총핀에 비밀 투표로 받은 점수 배분을 합산해 최종 순위를 계산한다. 기존 개인전과 팀전은 같은 기능 플래그 아래에서 독립된 데이터와 상태를 유지한다.

## 참가자와 시간

- 일정에서 `ATTENDING`으로 확정된 `TeamMember`만 참가자 snapshot에 포함한다.
- 계정이 없는 게스트는 직접 인증해 투표하거나 안정적인 Score identity로 연결할 수 없으므로 V1에서 경기·투표·순위에서 제외한다. 관리자의 대리 투표도 허용하지 않는다.
- 관리자가 `참석 마감 및 참가자 확정`을 실행하면 참가자와 암호학적 난수 기반 개표 순서를 저장한다.
- 투표는 `competitionStartAt`부터 `votingDurationMinutes` 30분 동안 열린다. 서버 시간이 시작 전이거나 마감 시각 이상이면 제출과 수정 모두 거부한다.
- 서버에는 정확히 3명을 고른 완성 ballot만 저장한다. 본인, 중복, 불참 회원은 거부한다. 마감 전 재제출은 기존 선택을 원자적으로 교체하며 마지막 완성 ballot이 유효하다. V1은 별도 변경 이력을 보존하지 않고 ballot의 `submittedAt`/`updatedAt`만 유지한다.

## 점수 계산

일정의 KST 날짜, 팀, 선택한 경기 유형이 일치하고 0~300 범위인 `Score`만 사용한다. 참가자마다 설정된 `competitionGameCount`와 정확히 같은 게임 수가 있어야 개표를 시작할 수 있다.

각 참가자 P에 대해 다음을 계산한다.

1. `actualScore(P)` = P의 모든 경기 점수 합
2. `voteCount(P)` = P를 선택한 ballot 수
3. `shareScore(P)` = `voteCount > 0`일 때 `actualScore / voteCount`, 0표이면 `null`
4. `voteBonus(A)` = A가 선택한 세 참가자의 `shareScore` 합
5. `finalScore(A)` = `actualScore(A) + voteBonus(A)`

계산과 정렬에는 반올림하지 않은 값을 사용하고 Flutter 표시에서만 최대 소수 둘째 자리로 표현한다. 순위 포인트는 기존 `rankPoints` 설정을 재사용한다.

발표된 EVENT의 `seasonPoint`는 immutable publication snapshot을 기준으로 시즌 순위에 반영한다. 정기전 유형 EVENT는 같은 날짜의 원본 `Score`를 게임 수·총핀·평균에 한 번만 포함하고 기존 정기전 순위 포인트 대신 EVENT 최종 포인트와 메달을 사용한다. 비정기 유형 EVENT는 참가 횟수와 EVENT 포인트·메달만 더하며 정기전 평균에는 섞지 않는다. snapshot 형식이 유효하지 않으면 일부 행만 적용하지 않고 해당 EVENT 포인트 전체를 제외한다.

## 명시적 정책

사용자 요구에서 미투표자와 동점 정책이 확정되지 않았으므로 관리자가 개표 시작 때 각각 선택한다.

- 미투표자: `INCLUDE_ACTUAL_ONLY` 또는 `EXCLUDE_FROM_RANKING`
- 동점: `ACTUAL_SCORE_THEN_ID` 또는 `STABLE_ID_ONLY`

두 동점 정책 모두 최종 점수를 먼저 비교하며, 마지막에는 안정적인 participant ID로 결정해 결과가 비결정적이지 않게 한다.

## 공개 단계와 개인정보

상태는 참석 조사, 시작 대기, 투표 진행/마감, 순차 개표, 최종 확인, 발표 순서로 진행된다. 투표 진행 중에는 일반 회원과 관리자 모두 다른 사람의 선택, 득표 수, 예상 배분 점수를 볼 수 없다. 관리자는 제출/미제출 인원만 확인한다.

마감 후 점수가 완성되면 관리자가 미투표자·동점 정책을 확정하고 순차 개표를 시작한다. 관리자는 개표된 참가자의 실제 점수, 득표 수, 배분 점수와 감사용 선택자 이름을 볼 수 있다. 모든 참가자를 개표한 뒤에만 관리자 최종 미리보기와 발표가 가능하다.

개표가 시작된 뒤에는 공용 bulk 저장, 웹 점수 편집, 모바일 활동 편집 경로에서 해당 참가자의 EVENT 원본 Score 변경을 거부한다. 발표할 때 계산 결과를 `eventPublishedSnapshot`에 저장하고 상태를 `PUBLISHED`로 원자적으로 바꾼다. 이후 참가자는 자신의 선택 세 명과 받은 배분 점수, 자신의 결과, 전체 순위를 본다. 다른 참가자의 ballot 전체는 공개하지 않는다. 발표 API는 저장된 snapshot을 반환하므로 이후 다른 경로의 원본 기록 조회 결과가 달라져도 이미 발표된 결과는 조용히 변하지 않는다.

## API와 갱신

- `GET /api/mobile/v1/teams/{teamId}/events/{eventId}/competition/event`
- `POST` 같은 경로의 `PREPARE`, `VOTE`, `START_REVEAL`, `REVEAL_NEXT`, `PUBLISH`

모든 요청은 기존 Mobile Bearer 인증과 refresh single-flight를 사용한다. 앱은 투표/개표 상태에서 3초 polling을 사용하고 백그라운드, dispose, 발표 완료 시 중지한다.

첨부 요청의 과거 데이터 fixture 본문은 제공된 파일의 44번 제목 뒤에 포함되어 있지 않아, 현재 자동 테스트에는 명시된 `1000 / 4 = 250`과 `917 / 6 = 152.833333…` 정밀도 fixture를 사용한다.
