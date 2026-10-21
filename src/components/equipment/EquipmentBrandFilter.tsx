import Link from 'next/link';
import {BOWLING_BALL_BRANDS} from '@/lib/manufacturer-equipment';
import styles from './ManufacturerEquipment.module.css';

export default function EquipmentBrandFilter({brand, q, type, memberPage}: {brand: string; q: string; type: string; memberPage: number}) {
    const href = (next: string) => '/equipment?' + new URLSearchParams({q, category: 'BALL', type, brand: next, page: String(memberPage), productPage: '1'});
    return <section className={styles.brandFilter} aria-labelledby="ball-brands-heading">
        <div className={styles.brandHeading}><h2 id="ball-brands-heading">볼링공 제조사별 보기</h2><p>제조사·판매처 제품 정보에 적용됩니다. 숫자는 등록된 볼링공 수입니다.</p></div>
        <nav className={styles.brandOptions} aria-label="볼링공 제조사">
            <Link href={href('')} aria-current={!brand ? 'page' : undefined}>전체 제조사 <span>{BOWLING_BALL_BRANDS.reduce((sum, item) => sum + item.count, 0)}</span></Link>
            {BOWLING_BALL_BRANDS.map(item => <Link key={item.id} href={href(item.id)} aria-current={brand === item.id ? 'page' : undefined}>{item.label} <span>{item.count}</span></Link>)}
        </nav>
    </section>;
}
