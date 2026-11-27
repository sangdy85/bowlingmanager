import Link from 'next/link';
import {communityDate} from '@/lib/community';
import {equipmentCategory,equipmentType} from '@/lib/equipment';
import styles from './Equipment.module.css';
type Row={id:string;title:string;content:string;createdAt:Date;equipmentType:string|null;equipmentCategory:string|null;equipmentBrand:string|null;equipmentModel:string|null;author:{name:string};_count:{comments:number}};
export default function EquipmentCards({posts}:{posts:Row[]}) {
    return <div className={styles.grid}>{posts.map(post=><Link key={post.id} href={`/equipment/${post.id}`} className={styles.card}>
        <div className={styles.visual}><span className={styles.icon} aria-hidden="true">{equipmentCategory(post.equipmentCategory)?.icon ?? '🎳'}</span><span className={styles.brand}>{post.equipmentBrand || 'BOWLING GEAR'}</span></div>
        <div className={styles.content}><div className={styles.tags}><span>{equipmentType(post.equipmentType)}</span>{post.equipmentCategory&&<span>{equipmentCategory(post.equipmentCategory)?.label}</span>}</div><h2>{post.title}</h2>{post.equipmentModel&&<p className={styles.model}>{post.equipmentModel}</p>}<p className={styles.excerpt}>{post.content}</p><div className={styles.foot}><div>{post.author.name}<small>{communityDate(post.createdAt)}</small></div><span>댓글 {post._count.comments}</span></div></div>
    </Link>)}</div>;
}
