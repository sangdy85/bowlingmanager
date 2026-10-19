import Link from 'next/link';
import { searchManufacturerEquipment, MANUFACTURER_EQUIPMENT_CHECKED_AT } from '@/lib/manufacturer-equipment';
import { equipmentCategory } from '@/lib/equipment';
import equipment from './Equipment.module.css';
import styles from './ManufacturerEquipment.module.css';
import ProductPhoto from './ProductPhoto';

export default function ManufacturerEquipment({q, category, type}: {q: string; category: string; type: string}) {
    if (type === 'REVIEW') return null;
    const products = searchManufacturerEquipment(q, category, type);
    return <section className={styles.section} id="manufacturer-equipment" aria-labelledby="manufacturer-equipment-heading">
        <header><p className={styles.label}>OFFICIAL PRODUCT NOTES</p><h2 id="manufacturer-equipment-heading">제조사 자료로 살펴보는 볼링 용품</h2><p>공식 제품표를 확인해 사양과 비교할 점을 정리했습니다. 직접 사용 후기와 구분하며, 각 제품에서 제조사 원문으로 바로 이동할 수 있습니다.</p><p className={styles.meta}>자료 확인: {MANUFACTURER_EQUIPMENT_CHECKED_AT} · 조건에 맞는 제품 {products.length}개</p></header>
        {products.length ? <div className={equipment.grid}>{products.map(product => <article className={equipment.card} key={product.slug}>
            <Link className={styles.photoLink} href={'/equipment/products/' + product.slug}><ProductPhoto image={product.image} /></Link>
            <p className={styles.photoCredit}><span>{product.brand}</span><a href={product.sourceUrl} target="_blank" rel="noopener noreferrer">사진: 제조사 공식 자료 ↗</a></p>
            <div className={equipment.content}><div className={equipment.tags}><span>제조사 자료 정리</span><span>{equipmentCategory(product.category)?.label}</span></div><h3 className={styles.cardTitle}><Link href={'/equipment/products/' + product.slug}>{product.model}</Link></h3><p className={equipment.excerpt}>{product.summary}</p><div className={styles.links}><Link href={'/equipment/products/' + product.slug}>제품 소개·사양 보기 →</Link><a href={product.sourceUrl} target="_blank" rel="noopener noreferrer">제조사 공식 제품 링크 ↗</a></div></div>
        </article>)}</div> : <p className={styles.empty}>조건에 맞는 제조사 소개가 없습니다. 아래 회원 글을 확인하거나 검색 조건을 바꿔보세요.</p>}
        <p className={styles.meta}>해외 출시일과 국내 판매 여부는 다를 수 있습니다. 국내 출시·가격·재고는 확인된 판매처의 현재 안내를 확인해주세요.</p>
    </section>;
}
