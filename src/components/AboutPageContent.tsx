import Link from 'next/link';
import PublicNav from './public/PublicNav';
import styles from './portal/Portal.module.css';

export default function AboutPageContent({isLoggedIn=false,embedded=false}:{isLoggedIn?:boolean;embedded?:boolean;isAdmin?:boolean}) {
    const memberLink=(path:string)=>isLoggedIn?path:'/login';
    return <div>
        {!embedded&&<PublicNav/>}
        <section className={styles.section}><div className={styles.sectionHead}><h2>처음이라면, 여기서 시작하세요.</h2></div><div className={styles.grid}>
            <article className={styles.card}><span className={styles.tag}>01 · 둘러보기</span><h3>가입 없이 볼 수 있는 정보</h3><p>대회 일정과 공개 결과, 용품 정보, 볼링 가이드와 커뮤니티 글은 로그인 없이 읽을 수 있습니다.</p><div className={styles.cardFoot}><Link href="/competitions">대회 찾기 →</Link> · <Link href="/community">게시판 읽기 →</Link></div></article>
            <article className={styles.card}><span className={styles.tag}>02 · 함께하기</span><h3>로그인하고 이야기 나누기</h3><p>계정을 만든 뒤 커뮤니티에 질문·사용기·대회 소식을 작성하고 댓글로 대화를 이어가세요.</p><div className={styles.cardFoot}><Link href={isLoggedIn?'/community/new':'/register'}>{isLoggedIn?'첫 글 작성하기':'회원가입하기'} →</Link></div></article>
            <article className={styles.card}><span className={styles.tag}>03 · 기록 이어가기</span><h3>내 기록과 동호회 관리</h3><p>개인 점수를 저장하거나 팀에 가입해 동호회 활동과 기록을 이어갈 수 있습니다.</p><div className={styles.cardFoot}><Link href={memberLink('/personal')}>나의 기록실 →</Link> · <Link href={memberLink('/team')}>팀 관리 →</Link></div></article>
        </div></section>
        <section className={styles.section}><div className={styles.sectionHead}><h2>기능별 이용방법</h2></div><div className={styles.grid}>
            <article className={styles.card}><h3>개인 점수 기록하기</h3><ol className={styles.checklist}><li>로그인 후 나의 기록실로 이동합니다.</li><li>점수 입력에서 경기 날짜와 게임별 점수를 확인합니다.</li><li>이미지 인식 결과를 사용했다면 원본 점수판과 대조해 수정합니다.</li><li>저장 후 기록 목록과 평균에 반영됐는지 확인합니다.</li></ol><Link href={memberLink('/personal')}>기록실 열기 →</Link></article>
            <article className={styles.card}><h3>동호회와 함께하기</h3><ol className={styles.checklist}><li>팀 관리에서 기존 팀에 가입하거나 팀을 만듭니다.</li><li>소속 팀의 일정과 참가 안내를 확인합니다.</li><li>팀 게시판에서 내부 이야기를 나눕니다.</li><li>전체 볼러와 공유할 내용은 공개 커뮤니티에 작성합니다.</li></ol><Link href={memberLink('/team')}>팀 관리 열기 →</Link></article>
            <article className={styles.card}><h3>대회 공지와 경기 기록 찾기</h3><ol className={styles.checklist}><li>제조사·주관사 대회 공지는 대회 정보에서 찾습니다.</li><li>참가 조건·접수 일정은 공지에 연결된 공식 원문을 확인합니다.</li><li>볼링매니저에서 운영하는 상주리그·챔프전은 볼링장 목록에서 해당 센터를 선택합니다.</li><li>센터의 진행 중·종료된 대회에서 주차별 결과와 순위표를 확인합니다.</li></ol><div className={styles.cardFoot}><Link href="/competitions">제조사 대회 공지 →</Link> · <Link href="/centers">볼링장 경기 기록 →</Link></div></article>
        </div></section>
        <section className={styles.section}><h2>자주 묻는 질문</h2>
            <details className={styles.notice}><summary>로그인하지 않아도 볼 수 있나요?</summary><p>공개 가이드·용품 정보·대회 정보와 커뮤니티 읽기는 가능합니다. 글·댓글 작성과 개인 기록 저장은 로그인이 필요합니다.</p></details>
            <details className={styles.notice}><summary>팀 게시판과 공개 커뮤니티는 어떻게 다른가요?</summary><p>팀 게시판은 팀 활동을 위한 기존 공간입니다. 새 커뮤니티에 작성한 글은 누구나 읽을 수 있습니다. 팀 내부 자료나 다른 사람의 개인정보를 공개 글에 올리지 마세요.</p></details>
            <details className={styles.notice}><summary>점수판 이미지 인식은 그대로 저장해도 되나요?</summary><p>이미지 인식은 입력 보조 기능입니다. 이름과 게임별 최종 점수가 원본과 일치하는지 확인하고, 잘못 읽은 항목을 수정한 뒤 저장하세요.</p></details>
            <details className={styles.notice}><summary>대회 참가와 기록 정정은 어디로 문의하나요?</summary><p>참가 조건과 점수 정정은 해당 대회 운영자에게 확인하세요. 사이트 이용 중 문제가 있으면 문의 게시판에 화면 주소와 증상을 알려주세요.</p><Link href="/inquiry">문의하기 →</Link></details>
        </section>
        <aside id="standards" className={styles.notice}><h2>공개 콘텐츠와 작성 기준</h2><p>가이드의 참고자료는 원문에서 확인할 수 있습니다. 가상 점수·일정은 가상 예시로 표시하며, 편집 날짜는 전문가 검수 완료를 뜻하지 않습니다. 용품 정보의 국내 출시·가격·재고와 공식 경기 규정은 제조사·판매처·대회 주관사의 최신 안내를 확인하세요.</p><p>커뮤니티 글은 작성자의 경험과 의견입니다. 오류나 정정이 필요한 내용은 페이지 주소와 근거를 함께 알려주세요.</p><Link href="/inquiry">정정·이용 문의 →</Link></aside>
    </div>;
}
