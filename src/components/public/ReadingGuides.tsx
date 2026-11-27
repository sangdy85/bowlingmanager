import Link from 'next/link';
import styles from './ReadingGuides.module.css';

export function EquipmentReadingGuide() {
    return <section className={styles.guide} id="equipment-checklist" aria-labelledby="equipment-checklist-heading">
        <p className={styles.label}>BUYING NOTES · 구매 전 비교 메모</p>
        <h2 id="equipment-checklist-heading">첫 장비, 무엇을 비교해야 할까요?</h2>
        <p>제품 이름을 고르기 전에 지금 해결하려는 불편을 한 문장으로 적어보세요. “대여화의 착용감이 불편하다”, “기존 공과 다른 역할의 공이 필요하다”처럼 목적을 정하면 사양표와 매장 설명을 비교하기 쉬워집니다. 아래는 특정 제품을 추천하거나 성능을 보장하는 기준이 아닌 구매 준비용 체크리스트입니다.</p>
        <div className={styles.scroll} tabIndex={0} role="region" aria-label="용품 종류별 구매 비교표, 좌우 스크롤 가능">
            <table><caption>제품 가격과 함께 확인할 항목</caption><thead><tr><th scope="col">용품</th><th scope="col">비교할 내용</th><th scope="col">매장에 물어볼 질문</th></tr></thead><tbody>
                <tr><th scope="row">볼링공</th><td>사용 목적, 실제 구매 무게의 사양, 기존 공과의 역할 차이, 피팅 계획</td><td>이 무게의 코어·RG·Diff는 어디에서 확인하나요? 지공·그립 비용과 재조정 조건은 무엇인가요?</td></tr>
                <tr><th scope="row">볼링화</th><td>착용감, 투구 방향, 슬라이드·힐 구성과 교체 부품</td><td>이 모델은 내 투구 방향에 맞나요? 교체 부품 구입과 사이즈 교환이 가능한가요?</td></tr>
                <tr><th scope="row">볼링 가방</th><td>넣을 공 수, 수납 크기, 이동 동선과 보관 공간</td><td>내 신발·용품까지 실제로 들어가나요? 계단이나 차량에 싣는 상황에서 다룰 수 있나요?</td></tr>
                <tr><th scope="row">관리용품</th><td>사용 대상, 제조사 사용법, 보관 조건</td><td>내 볼·신발에 사용 가능한 제품인가요? 참가 대회에서 사용 시점에 제한이 있나요?</td></tr>
            </tbody></table>
        </div>
        <div className={styles.grid}>
            <article className={styles.item}><h3>공 두 개를 비교할 때</h3><ol><li>같은 구매 무게의 제조사 제품표를 나란히 봅니다.</li><li>커버·표면·코어·RG·Diff를 각각 기록합니다.</li><li>평소 치는 레인과 기존 장비를 설명한 뒤 차이를 물어봅니다.</li><li>제품값뿐 아니라 피팅과 소모품을 포함한 견적을 받습니다.</li></ol><p>사양 한 개가 더 크거나 작다는 이유만으로 “더 좋은 공”이라고 판단하지 마세요. 숫자의 의미와 적용 범위는 <Link href="/guide/bowling-ball-specifications-coverstock-core-rg-diff-guide">볼링공 제품표 읽는 법</Link>에서 확인할 수 있습니다.</p></article>
            <article className={styles.item}><h3>구매 전 남겨둘 메모</h3><ul><li>구매 목적과 현재 사용하는 장비</li><li>제조사 원문 URL, 확인 날짜, 비교한 무게</li><li>제품·지공·그립·추가 부품별 견적</li><li>교환·재조정 조건과 확인한 판매처</li></ul><p>국내 출시·재고·가격은 판매처의 현재 안내를 확인하세요. 이 페이지는 회원 후기와 편집 안내를 구분하며, 확인되지 않은 사용 경험이나 판매 실적을 제품 평가에 넣지 않습니다.</p></article>
        </div>
        <nav className={styles.links} aria-label="장비 선택 관련 가이드"><Link href="/guide/bowling-ball-selection-guide">첫 마이볼 구매 체크리스트 →</Link><Link href="/guide/bowling-shoes-and-accessory-maintenance-guide">구매 후 볼링화·볼 관리 →</Link></nav>
        <p>구매 목적·피팅 상담 항목의 참고자료: <a href="https://bowl.com/news/ball-selection-for-entry-level-bowlers" rel="noopener noreferrer">USBC · Ball Selection</a>, <a href="https://www.stormbowling.com/read/questions-before-buying-new-bowling-ball" rel="noopener noreferrer">Storm · 구매 전 질문</a>. 원문 확인: 2026-10-19. 비교표와 메모 양식은 BowlingManager의 편집 제안입니다.</p>
    </section>;
}

export function CommunityPostingGuide() {
    return <section className={styles.guide} id="posting-guide" aria-labelledby="posting-guide-heading">
        <p className={styles.label}>BETTER QUESTIONS · 경험을 나누는 방법</p>
        <h2 id="posting-guide-heading">질문에 맥락을 더하면 답변도 구체적이 됩니다.</h2>
        <p>“점수가 안 나와요” 대신 어떤 조건에서 무엇을 해봤는지 적어주세요. 경험을 나누는 글에서는 직접 확인한 사실과 개인적인 추측을 구분하면 다른 볼러가 자신의 상황과 비교하기 쉽습니다. 공개 글과 댓글은 누구나 읽을 수 있고, 작성은 로그인 후 가능합니다.</p>
        <div className={styles.grid}>
            <article className={styles.item}><h3>질문·연습 기록에 넣을 내용</h3><ul><li>어떤 상황인지: 경기·연습 구분과 해결하고 싶은 문제</li><li>어떤 조건인지: 사용 장비와 본인이 관찰한 변화</li><li>무엇을 해봤는지: 바꾼 항목과 바꾸기 전후 결과</li><li>무엇이 궁금한지: 답변받고 싶은 한두 가지 질문</li></ul><Link href="/guide/advanced-bowling-techniques-and-theory">한 번에 한 변수씩 관찰하는 기록법 →</Link></article>
            <article className={styles.item}><h3>후기·대회 소식에 넣을 내용</h3><ul><li>제품은 모델·무게·사용 조건과 직접 경험한 범위</li><li>협찬·제공·판매 관계가 있다면 해당 사실</li><li>대회 소식은 주관사 원문 링크와 확인 날짜</li><li>다른 사람의 이름·연락처·점수판 사진 공개 전 개인정보 확인</li></ul><p>제조사 설명을 본인 사용 후기처럼 쓰거나, 한 번의 경험을 누구에게나 같은 결과로 보장하지 마세요. 문제가 있는 글·댓글은 상세 화면의 신고 기능을 이용할 수 있습니다.</p></article>
        </div>
        <details><summary>복사해서 활용할 질문 메모 양식</summary><pre className={styles.template}>{'상황과 목표:\n사용 장비·관찰한 조건:\n바꾸기 전 기록:\n바꾼 항목:\n바꾼 뒤 기록:\n아직 궁금한 점:'}</pre><p>작성용 빈 양식입니다. 실제 회원의 게시글이나 후기가 아닙니다.</p></details>
        <nav className={styles.links} aria-label="커뮤니티 작성 참고자료"><Link href="/community/new?category=QUESTION">질문 작성하기 · 로그인 필요 →</Link><Link href="/guide/average-and-score-distribution">평균과 점수 분포 함께 읽기 →</Link><Link href="/equipment">용품 소개·후기 살펴보기 →</Link></nav>
    </section>;
}
