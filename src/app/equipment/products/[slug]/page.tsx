import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MANUFACTURER_EQUIPMENT, manufacturerEquipment } from '@/lib/manufacturer-equipment';
import { equipmentCategory } from '@/lib/equipment';
import { PUBLIC_ORIGIN } from '@/lib/public-web';
import portal from '@/components/portal/Portal.module.css';
import styles from '@/components/equipment/ManufacturerEquipment.module.css';
import ProductPhoto from '@/components/equipment/ProductPhoto';

type Props = { params: Promise<{slug: string}> };
export function generateStaticParams() { return MANUFACTURER_EQUIPMENT.map(product => ({slug: product.slug})); }
export async function generateMetadata({params}: Props): Promise<Metadata> {
    const product = manufacturerEquipment((await params).slug);
    return product ? {title: product.title + ' | 볼링매니저', description: product.summary, alternates: {canonical: PUBLIC_ORIGIN + '/equipment/products/' + product.slug}}
        : {title: '제품 소개를 찾을 수 없습니다', robots: {index: false}};
}
export default async function ManufacturerEquipmentDetail({params}: Props) {
    const product = manufacturerEquipment((await params).slug);
    if (!product) notFound();
    const releaseLabel = product.releaseDate && product.releaseDate > product.checkedAt ? '제조사 해외 출시 예정일 · 확인일 기준' : '제조사 해외 출시일';
    return <div className={portal.page}><div className={portal.inner}>
        <Link href="/equipment#manufacturer-equipment">← 볼링 용품 목록</Link>
        <header className={portal.headline}><p className={portal.eyebrow}>PRODUCT NOTE · SOURCE CHECKED</p><span className={portal.tag}>{product.sourceBadge} · {equipmentCategory(product.category)?.label}</span><h1>{product.title}</h1><p>{product.summary}</p><p className={styles.credit}>BowlingManager 편집 · 제품 원문 확인 {product.checkedAt}</p></header>
        <div className={portal.actions}><a className={portal.button} href={product.sourceUrl} target="_blank" rel="noopener noreferrer">{product.sourceLinkLabel} ↗</a>{product.additionalSources.map(source => <a className={portal.secondary} key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗ · {source.checkedAt} 확인</a>)}<Link className={portal.secondary} href={'/equipment?type=REVIEW&q=' + encodeURIComponent(product.model)}>관련 회원 후기 찾기</Link></div>
        <figure className={styles.productFigure}><ProductPhoto image={product.image} detail /><figcaption>사진: <a className={styles.sourceLink} href={product.sourceUrl} target="_blank" rel="noopener noreferrer">{product.sourceLabel} ↗</a> · {product.image.checkedAt} 확인</figcaption></figure>
        <dl className={styles.specs}><div><dt>브랜드 / 모델</dt><dd>{product.brand} / {product.model}</dd></div><div><dt>제품 링크</dt><dd><a className={styles.sourceLink} href={product.sourceUrl} target="_blank" rel="noopener noreferrer">공식 사양·구성 확인 ↗</a></dd></div>{product.releaseDate && <div><dt>{releaseLabel}</dt><dd>{product.releaseDate} · 국내 판매 여부 별도 확인</dd></div>}{product.specs.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <section className={styles.copy}><h2>제품 원문에서 확인한 내용</h2>{product.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>
        <section className={styles.copy}><h2>구매 전 함께 확인할 점</h2><ul>{product.checks.map(item => <li key={item}>{item}</li>)}</ul><p className={styles.credit}>공개 사양을 비교하기 위한 BowlingManager의 편집 메모입니다.</p></section>
        <aside className={portal.notice}>제조사 또는 판매처 공개 자료를 요약한 제품 소개이며 직접 사용 후기나 독립 성능 시험 결과가 아닙니다. 원문의 성능 설명을 모든 사용자에게 같은 결과로 보장하지 않습니다. 국내 출시·공인·가격·재고와 보증 조건은 수입사·판매처의 최신 안내를 확인해주세요.</aside>
        <div className={portal.actions}><Link className={portal.secondary} href="/equipment#manufacturer-equipment">제품 목록으로 돌아가기</Link><Link className={portal.secondary} href="/equipment/new">내 사용 후기 작성하기</Link><Link className={portal.secondary} href="/guide">장비 선택 가이드</Link></div>
    </div></div>;
}
