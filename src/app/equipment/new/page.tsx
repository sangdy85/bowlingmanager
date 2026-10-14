import {redirect} from 'next/navigation';
import {communityViewer} from '@/lib/community-access';
import EquipmentEditor from '@/components/equipment/EquipmentEditor';
import styles from '@/components/portal/Portal.module.css';
export const metadata={title:'용품 소개·후기 작성 | 볼링매니저',robots:{index:false,follow:false}};
export default async function NewEquipmentPost(){if(!await communityViewer())redirect('/login?callbackUrl=%2Fequipment%2Fnew');return <div className={styles.page}><div className={styles.inner}><header className={styles.headline}><p className={styles.eyebrow}>SHARE YOUR GEAR EXPERIENCE</p><h1>용품 소개 · 후기 작성</h1><p>확인한 제품 정보와 직접 사용한 경험을 구분해서 들려주세요.</p></header><EquipmentEditor/></div></div>;}
