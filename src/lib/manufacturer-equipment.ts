import bundle from '../../content/equipment/manufacturers-20261019.json';
import koreaMall from '../../content/equipment/koreamall-20261020.json';
import twins from '../../content/equipment/twins-20261021.json';
import mk from '../../content/equipment/mk-20261021.json';
import brunswickKorea from '../../content/equipment/brunswick-korea-20261021.json';

const manufacturerProducts = bundle.products.map(product => {
    const additionalSources = [
        ...koreaMall.existingLinks.filter(link => link.slug === product.slug).map(link => ({ label: '진승 쇼핑몰 제품 페이지', url: link.sourceUrl, checkedAt: link.checkedAt })),
        ...mk.existingLinks.filter(link => link.slug === product.slug).map(link => ({ label: 'MK 제품 페이지', url: link.sourceUrl, checkedAt: link.checkedAt })),
        ...brunswickKorea.existingLinks.filter(link => link.slug === product.slug).map(link => ({ label: '브런스윅 코리아 제품 페이지', url: link.sourceUrl, checkedAt: link.checkedAt })),
    ];
    return { ...product, checkedAt: bundle.checkedAt,
        updatedAt: additionalSources.reduce((latest, source) => source.checkedAt > latest ? source.checkedAt : latest, bundle.checkedAt),
        sourceBadge: '제조사 자료 정리', sourceLabel: '제조사 공식 제품 자료', sourceLinkLabel: '제조사 공식 제품 페이지', additionalSources };
});
export const MANUFACTURER_EQUIPMENT = [
    ...brunswickKorea.products.map(product => ({ ...product, checkedAt: brunswickKorea.checkedAt, updatedAt: brunswickKorea.checkedAt,
        sourceBadge: '판매처 자료 정리', sourceLabel: '브런스윅 코리아 제품 자료', sourceLinkLabel: '브런스윅 코리아 제품 페이지' })),
    ...mk.products.map(product => ({ ...product, checkedAt: mk.checkedAt, updatedAt: mk.checkedAt,
        sourceBadge: '수입사 자료 정리', sourceLabel: '엠케이트레이딩 제품 자료', sourceLinkLabel: 'MK 제품 페이지' })),
    ...twins.products.map(product => ({ ...product, checkedAt: twins.checkedAt, updatedAt: twins.checkedAt,
        sourceBadge: '판매처 자료 정리', sourceLabel: '트윈스스포츠 제품 자료', sourceLinkLabel: '트윈스스포츠 제품 페이지',
        additionalSources: [] as {label: string; url: string; checkedAt: string}[] })),
    ...koreaMall.products.map(product => ({ ...product, checkedAt: koreaMall.checkedAt, updatedAt: koreaMall.checkedAt,
        sourceBadge: '판매처 자료 정리', sourceLabel: '진승 쇼핑몰 제품 자료', sourceLinkLabel: '진승 쇼핑몰 제품 페이지',
        additionalSources: [] as {label: string; url: string; checkedAt: string}[] })),
    ...manufacturerProducts,
];
export const MANUFACTURER_EQUIPMENT_CHECKED_AT = brunswickKorea.checkedAt;
export const MANUFACTURER_EQUIPMENT_PAGE_SIZE = 24;
export function manufacturerEquipment(slug: string) { return MANUFACTURER_EQUIPMENT.find(product => product.slug === slug); }
export function searchManufacturerEquipment(q = '', category = '', type = '') {
    if (type === 'REVIEW') return [];
    const query = q.trim().toLocaleLowerCase('ko-KR');
    return MANUFACTURER_EQUIPMENT.filter(product => (!category || product.category === category)
        && (!query || [product.title, product.brand, product.model, product.summary, ...product.paragraphs].join(' ').toLocaleLowerCase('ko-KR').includes(query)));
}
export function pageManufacturerEquipment(q = '', category = '', type = '', requestedPage = 1) {
    const matches = searchManufacturerEquipment(q, category, type);
    const pages = Math.max(1, Math.ceil(matches.length / MANUFACTURER_EQUIPMENT_PAGE_SIZE));
    const page = Number.isSafeInteger(requestedPage) ? Math.max(1, Math.min(pages, requestedPage)) : 1;
    return { products: matches.slice((page - 1) * MANUFACTURER_EQUIPMENT_PAGE_SIZE, page * MANUFACTURER_EQUIPMENT_PAGE_SIZE), total: matches.length, page, pages };
}
