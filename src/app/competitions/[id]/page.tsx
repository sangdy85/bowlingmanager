import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PUBLIC_ORIGIN } from '@/lib/public-web';
import { competitionEditor, publishedCompetition } from '@/lib/competition-notices-server';
import { noticeDate, noticeDateRange, noticePhase } from '@/lib/competition-notices';
import portal from '@/components/portal/Portal.module.css';
import styles from '@/components/competitions/Competitions.module.css';
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata> {
    const {id} = await params, row = await publishedCompetition(id);
    return row ? {title:`${row.title} | 볼링 대회 정보`,description:row.description.slice(0,160),alternates:{canonical:`${PUBLIC_ORIGIN}/competitions/${id}`}} : {title:'대회정보를 찾을 수 없습니다',robots:{index:false}};
}
export default async function CompetitionDetail({params}:{params:Promise<{id:string}>}) {
    const {id} = await params;
    const [row, editor] = await Promise.all([publishedCompetition(id),competitionEditor()]);
    if (!row) notFound();
    const details = [['주관사',row.organizer],['대회형식',row.format],['접수일자',noticeDateRange(row.registrationStartDate,row.registrationEndDate)],['대회일자',noticeDateRange(row.startDate,row.endDate)],['시간',row.eventTime],['대회장소',row.venue],['참가비',row.fee],['최근 수정',noticeDate(row.updatedAt)]];
    return <div className={portal.page}><div className={portal.inner}><Link href="/competitions" className={portal.meta}>← 대회정보 목록</Link><header className={portal.headline}><p className={portal.eyebrow}>TOURNAMENT NOTICE</p><span className={styles.badge}>{noticePhase(row)}</span><h1>{row.title}</h1><p>{row.organizer} · {row.venue}</p></header>
        <div className={portal.actions}>{row.registrationUrl && <a className={portal.button} href={row.registrationUrl} target="_blank" rel="noopener noreferrer">접수 페이지로 이동 ↗</a>}{row.relatedUrl && <a className={portal.secondary} href={row.relatedUrl} target="_blank" rel="noopener noreferrer">대회 공지 원문 보기 ↗</a>}{editor && <Link className={portal.secondary} href={`/competitions/${row.id}/edit`}>대회정보 수정</Link>}</div>
        <dl className={styles.details}>{details.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}{row.relatedUrl && <div><dt>대회 링크</dt><dd><a className={styles.sourceLink} href={row.relatedUrl} target="_blank" rel="noopener noreferrer">주관사 공지·요강 바로가기 ↗</a></dd></div>}</dl>
        <section className={styles.copy}><h2>대회 안내</h2><p>{row.description}</p></section><section className={styles.copy}><h2>대회 요강</h2><p>{row.rules}</p></section>
        <aside className={portal.notice}>접수와 결제는 주관사의 안내에 따라 진행해주세요. 표시된 접수 기간이 실제 잔여 인원이나 접수 가능 여부를 보장하지는 않습니다.</aside><div className={portal.actions}><Link className={portal.secondary} href="/competitions">목록으로 돌아가기</Link><Link className={portal.secondary} href="/competitions?view=calendar">달력으로 보기</Link></div>
    </div></div>;
}
