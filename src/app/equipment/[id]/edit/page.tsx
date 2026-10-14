import {notFound,redirect} from 'next/navigation';
import {communityViewer} from '@/lib/community-access';
import {publishedEquipment} from '@/lib/equipment-server';
import EquipmentEditor from '@/components/equipment/EquipmentEditor';
import styles from '@/components/portal/Portal.module.css';
export const metadata={title:'용품 소개·후기 수정 | 볼링매니저',robots:{index:false,follow:false}};
export default async function EditEquipment({params}:{params:Promise<{id:string}>}){const viewer=await communityViewer();if(!viewer)redirect('/login');const {id}=await params,post=await publishedEquipment(id);if(!post||(post.authorId!==viewer.id&&viewer.role!=='SUPER_ADMIN'))notFound();return <div className={styles.page}><div className={styles.inner}><header className={styles.headline}><h1>용품 소개 · 후기 수정</h1><p>제품 정보와 사용 경험을 최신 내용으로 정리하세요.</p></header><EquipmentEditor initial={post}/></div></div>;}
