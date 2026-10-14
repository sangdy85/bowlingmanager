import Link from 'next/link';
import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { PUBLIC_ORIGIN } from '@/lib/public-web';
import { searchText, searchPage } from '@/lib/portal-params';
import { calendarMonth, monthBounds, monthOffset } from '@/lib/competition-notices';
import { competitionEditor, publicNoticeWhere } from '@/lib/competition-notices-server';
import CompetitionRows from '@/components/competitions/CompetitionRows';
import CompetitionCalendar from '@/components/competitions/CompetitionCalendar';
import portal from '@/components/portal/Portal.module.css';
import styles from '@/components/competitions/Competitions.module.css';

export const metadata: Metadata = {title:'볼링 대회 정보 | 볼링매니저',description:'주관사, 접수 기간, 대회 일정과 요강을 목록·달력에서 확인하고 접수 페이지로 이동하세요.',alternates:{canonical:PUBLIC_ORIGIN+'/competitions'}};
type Params = {q?:string | string[]; status?:string | string[]; page?:string | string[]; view?:string | string[]; month?:string | string[]};
export default async function CompetitionsPage({searchParams}: {searchParams:Promise<Params>}) {
    const params = await searchParams;
    const q = searchText(params.q), status = ['upcoming','registering','finished'].includes(searchText(params.status)) ? searchText(params.status) : 'all';
    const view = params.view === 'calendar' ? 'calendar' : 'list', month = calendarMonth(params.month), page = searchPage(params.page);
    const bounds = monthBounds(month);
    const query = view === 'calendar' ? {AND:[publicNoticeWhere(q,status), {startDate:{lte:bounds.end}, endDate:{gte:bounds.start}}]} : publicNoticeWhere(q,status);
    const [rows, count, editor] = await Promise.all([
        prisma.competitionNotice.findMany({where:query, orderBy:[{startDate:'desc'},{id:'desc'}], ...(view === 'list' ? {take:15, skip:(page-1)*15} : {})}),
        prisma.competitionNotice.count({where:query}), competitionEditor(),
    ]);
    const href = (next:Partial<{view:string; month:string; page:string; status:string}>) => '/competitions?'+new URLSearchParams({q,status,view,month,page:'1',...next});
    return <div className={portal.page}><div className={portal.inner}>
        <header className={`${portal.headline} ${styles.compactHeader}`}><p className={portal.eyebrow}>FIND YOUR NEXT GAME</p><h1>볼링 대회 정보</h1><p>접수부터 경기일까지, 다음 대회를 준비하세요. 주관사·장소·참가비와 상세 요강을 한눈에 확인할 수 있습니다.</p></header>
        <div className={styles.toolbar}><nav className={styles.switch} aria-label="대회 보기 방식"><Link href={href({view:'list'})} aria-current={view === 'list' ? 'page' : undefined}>☰ 목록 보기</Link><Link href={href({view:'calendar'})} aria-current={view === 'calendar' ? 'page' : undefined}>▦ 달력 보기</Link></nav><div className={portal.actions}>{editor && <><Link className={portal.button} href="/competitions/new">+ 대회정보 등록</Link><Link className={portal.secondary} href="/competitions/manage">등록 관리</Link></>}<Link className={portal.secondary} href="/centers">볼링장 운영 대회 →</Link></div></div>
        <nav className={portal.tabs} aria-label="대회 상태">{[['all','전체'],['upcoming','예정·진행 중'],['registering','접수 기간'],['finished','종료']].map(([id,label]) => <Link key={id} href={href({status:id})} aria-current={status === id ? 'page' : undefined}>{label}</Link>)}</nav>
        <form className={portal.search} action="/competitions"><input type="hidden" name="status" value={status}/><input type="hidden" name="view" value={view}/><input type="hidden" name="month" value={month}/><input type="search" name="q" defaultValue={q} aria-label="대회·주관사·장소 검색" placeholder="대회명, 주관사 또는 장소를 검색하세요" maxLength={100}/><button className={portal.button}>검색</button></form>
        {view === 'calendar' && <><div className={styles.calendarHeader}><h2>{month.replace('-', '년 ')}월</h2><div className={styles.calendarControls}><Link className={portal.secondary} href={href({month:monthOffset(month,-1)})} aria-label="이전 달">←</Link><Link className={portal.secondary} href={href({month:calendarMonth(null)})}>이번 달</Link><Link className={portal.secondary} href={href({month:monthOffset(month,1)})} aria-label="다음 달">→</Link><form action="/competitions"><input type="hidden" name="view" value="calendar"/><input type="hidden" name="status" value={status}/><input type="hidden" name="q" value={q}/><input type="month" name="month" defaultValue={month} aria-label="대회 달력 월" min="1900-01" max="2200-12"/><button className={portal.secondary}>이동</button></form></div></div><CompetitionCalendar month={month} rows={rows}/><p className={styles.calendarHelp}>대회일자 기준으로 표시합니다. 여러 날 진행하는 대회는 기간 동안 표시되며, 대회명을 누르면 요강을 확인할 수 있습니다.</p></>}
        <div className={styles.monthList}>{view === 'calendar' && <h2>이달의 대회</h2>}<p className={portal.meta}>등록 대회 {count}개{view === 'list' && ` · ${page}페이지`}</p>
        {rows.length ? <CompetitionRows rows={rows}/> : <div className={portal.empty}><strong>조건에 맞는 등록 대회가 없습니다.</strong><p>{view === 'calendar' ? '다른 달을 선택하거나 검색 조건을 바꿔보세요.' : '등록된 대회정보가 공개되면 이곳에서 확인할 수 있습니다.'}</p></div>}</div>
        {view === 'list' && <nav className={portal.pager} aria-label="대회 페이지">{page > 1 && <Link className={portal.secondary} href={href({page:String(page-1)})}>이전</Link>}{page*15 < count && <Link className={portal.secondary} href={href({page:String(page+1)})}>다음</Link>}</nav>}
        <aside className={portal.notice}>일정·접수 현황은 주관사 사정으로 변경될 수 있습니다. 참가 전 요강과 접수 페이지를 확인해주세요. <Link href="/community?category=TOURNAMENT">대회 이야기 나누기 →</Link></aside>
    </div></div>;
}
