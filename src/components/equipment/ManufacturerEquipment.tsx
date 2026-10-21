import Link from 'next/link';
import { pageManufacturerEquipment, MANUFACTURER_EQUIPMENT_CHECKED_AT } from '@/lib/manufacturer-equipment';
import { equipmentCategory } from '@/lib/equipment';
import equipment from './Equipment.module.css';
import styles from './ManufacturerEquipment.module.css';
import ProductPhoto from './ProductPhoto';
import portal from '@/components/portal/Portal.module.css';

export default function ManufacturerEquipment({q, category, type, page: requestedPage = 1, memberPage = 1}: {q: string; category: string; type: string; page?: number; memberPage?: number}) {
    if (type === 'REVIEW') return null;
    const {products, total, page, pages} = pageManufacturerEquipment(q, category, type, requestedPage);
    const href = (next: number) => '/equipment?' + new URLSearchParams({q, category, type, page: String(memberPage), productPage: String(next)}) + '#manufacturer-equipment';
    return <section className={styles.section} id="manufacturer-equipment" aria-labelledby="manufacturer-equipment-heading">
        <header><p className={styles.label}>PRODUCT NOTES · CHECK THE SOURCE</p><h2 id="manufacturer-equipment-heading">제조사·판매처 자료로 살펴보는 볼링 용품</h2><p>제조사·MK·브런스윅 코리아·진승 쇼핑몰·트윈스스포츠의 제품표를 확인해 사양과 비교할 점을 정리했습니다. 직접 사용 후기와 구분하며, 각 제품에 자료 출처와 원문 링크를 표시합니다.</p><p className={styles.meta}>최근 자료 추가: {MANUFACTURER_EQUIPMENT_CHECKED_AT} · 조건에 맞는 제품 {total}개 · {page}/{pages}페이지</p></header>
        {products.length ? <div className={equipment.grid}>{products.map(product => <article className={equipment.card} key={product.slug}>
            <Link className={styles.photoLink} href={'/equipment/products/' + product.slug}><ProductPhoto image={product.image} /></Link>
            <p className={styles.photoCredit}><span>{product.brand}</span><a href={product.sourceUrl} target="_blank" rel="noopener noreferrer">사진: {product.sourceLabel} ↗</a></p>
            <div className={equipment.content}><div className={equipment.tags}><span>{product.sourceBadge}</span><span>{equipmentCategory(product.category)?.label}</span></div><h3 className={styles.cardTitle}><Link href={'/equipment/products/' + product.slug}>{product.model}</Link></h3><p className={equipment.excerpt}>{product.summary}</p><div className={styles.links}><Link href={'/equipment/products/' + product.slug}>제품 소개·사양 보기 →</Link><a href={product.sourceUrl} target="_blank" rel="noopener noreferrer">{product.sourceLinkLabel} ↗</a>{product.additionalSources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a>)}</div></div>
        </article>)}</div> : <p className={styles.empty}>조건에 맞는 제조사 소개가 없습니다. 아래 회원 글을 확인하거나 검색 조건을 바꿔보세요.</p>}
        {total > 24 && <nav className={portal.pager} aria-label="제조사·판매처 제품 페이지">{page > 1 && <Link className={portal.secondary} href={href(page - 1)}>이전 제품</Link>}<span className={styles.meta}>{page} / {pages}</span>{page < pages && <Link className={portal.secondary} href={href(page + 1)}>다음 제품</Link>}</nav>}
        <p className={styles.meta}>제품별 자료 확인일은 상세에서 확인할 수 있습니다. 해외 출시일과 국내 판매 여부는 다를 수 있으며, 가격·재고·구매 가능한 무게는 판매처의 현재 안내를 확인해주세요.</p>
    </section>;
}
