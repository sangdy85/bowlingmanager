import { requireCompetitionEditor } from '@/lib/competition-notices-server';
import CompetitionEditor from '@/components/competitions/CompetitionEditor';
import styles from '@/components/portal/Portal.module.css';
export const metadata = {title:'대회정보 등록 | 볼링매니저',robots:{index:false,follow:false}};
export default async function NewCompetition() {
    await requireCompetitionEditor('/competitions/new');
    return <div className={styles.page}><div className={styles.inner}><header className={styles.headline}><p className={styles.eyebrow}>ADMIN · TOURNAMENT NOTICE</p><h1>대회정보 등록</h1><p>주관사 확인 자료를 바탕으로 일정·참가 조건·요강을 안내하세요. 공개 여부는 저장 전에 선택할 수 있습니다.</p></header><CompetitionEditor/></div></div>;
}
