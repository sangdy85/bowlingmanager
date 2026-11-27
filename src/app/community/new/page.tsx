import { redirect } from 'next/navigation';
import { communityViewer } from '@/lib/community-access';
import { validCategory } from '@/lib/community';
import { searchText } from '@/lib/portal-params';
import CommunityEditor from '@/components/community/CommunityEditor';
import styles from '@/components/portal/Portal.module.css';
export const metadata={title:'커뮤니티 글쓰기 | 볼링매니저',robots:{index:false,follow:false}};
export default async function NewCommunityPost({searchParams}:{searchParams:Promise<{category?:string}>}) {
 const viewer=await communityViewer();if(!viewer)redirect('/login');
 const category=searchText((await searchParams).category);if(category==='EQUIPMENT')redirect('/equipment/new');
 return <div className={styles.page}><div className={styles.inner}><header className={styles.headline}><p className={styles.eyebrow}>SHARE YOUR STORY</p><h1>새로운 볼링 이야기</h1><p>질문, 경기 경험, 유용한 정보를 나눠주세요.</p></header><CommunityEditor defaultCategory={validCategory(category)?category:'FREE'}/></div></div>;
}
