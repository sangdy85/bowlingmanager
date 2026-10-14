import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireCompetitionEditor } from '@/lib/competition-notices-server';
import { noticeDateKey } from '@/lib/competition-notices';
import CompetitionEditor from '@/components/competitions/CompetitionEditor';
import styles from '@/components/portal/Portal.module.css';
export const metadata = {title:'대회정보 수정 | 볼링매니저',robots:{index:false,follow:false}};
export default async function EditCompetition({params}:{params:Promise<{id:string}>}) {
    const {id} = await params;
    await requireCompetitionEditor(`/competitions/${id}/edit`);
    const row = await prisma.competitionNotice.findUnique({where:{id}});
    if (!row) notFound();
    const initial = {...row, registrationStartDate:noticeDateKey(row.registrationStartDate),registrationEndDate:noticeDateKey(row.registrationEndDate),startDate:noticeDateKey(row.startDate),endDate:noticeDateKey(row.endDate),registrationUrl:row.registrationUrl ?? '',relatedUrl:row.relatedUrl ?? '',updatedAt:row.updatedAt.toISOString()};
    return <div className={styles.page}><div className={styles.inner}><header className={styles.headline}><p className={styles.eyebrow}>ADMIN · TOURNAMENT NOTICE</p><h1>대회정보 수정</h1><p>일정과 요강을 최신 상태로 유지하세요. 공개를 해제해도 등록한 내용은 보관됩니다.</p></header><CompetitionEditor initial={initial}/></div></div>;
}
