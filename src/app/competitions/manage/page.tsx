import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requireCompetitionEditor } from '@/lib/competition-notices-server';
import { searchPage } from '@/lib/portal-params';
import CompetitionRows from '@/components/competitions/CompetitionRows';
import styles from '@/components/portal/Portal.module.css';
export const metadata = {title:'대회정보 등록 관리 | 볼링매니저',robots:{index:false,follow:false}};
export default async function ManageCompetitions({searchParams}:{searchParams:Promise<{page?:string}>}) {
    await requireCompetitionEditor('/competitions/manage');
    const page = searchPage((await searchParams).page);
    const [rows,count] = await Promise.all([prisma.competitionNotice.findMany({orderBy:[{updatedAt:'desc'},{id:'desc'}],take:15,skip:(page-1)*15}),prisma.competitionNotice.count()]);
    return <div className={styles.page}><div className={styles.inner}><header className={styles.headline}><p className={styles.eyebrow}>ADMIN · TOURNAMENT NOTICE</p><h1>대회정보 등록 관리</h1><p>대회를 선택해 내용을 수정하거나 공개를 해제하세요. 비공개 대회는 사용자 목록·달력·상세에 노출되지 않습니다.</p></header><div className={styles.actions}><Link className={styles.button} href="/competitions/new">+ 대회정보 등록</Link><Link className={styles.secondary} href="/competitions">사용자 목록 보기</Link></div><p className={styles.meta}>전체 {count}개 · {page}페이지</p>{rows.length ? <CompetitionRows rows={rows} manage/> : <div className={styles.empty}>등록한 대회정보가 없습니다.</div>}<nav className={styles.pager} aria-label="대회 관리 페이지">{page>1 && <Link href={`/competitions/manage?page=${page-1}`} className={styles.secondary}>이전</Link>}{page*15<count && <Link href={`/competitions/manage?page=${page+1}`} className={styles.secondary}>다음</Link>}</nav></div></div>;
}
