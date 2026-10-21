import bundle from '../../content/equipment/manufacturers-20261019.json';
import koreaMall from '../../content/equipment/koreamall-20261020.json';
import twins from '../../content/equipment/twins-20261021.json';
import mk from '../../content/equipment/mk-20261021.json';
import brunswickKorea from '../../content/equipment/brunswick-korea-20261021.json';
import lordfield from '../../content/equipment/lordfield-20261021.json';

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
    ...lordfield.products.map(product => ({ ...product, checkedAt: lordfield.checkedAt, updatedAt: lordfield.checkedAt,
        sourceBadge: '공식몰 자료 정리', sourceLabel: '로드필드 공식몰 제품 자료', sourceLinkLabel: '로드필드 공식 상품 페이지' })),
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
// A seller's category is not a verified manufacturer. Keep those balls discoverable
// without presenting the distributor as their maker.
function ballBrandId(brand: string) {
    return brand === 'MK 하드 분류' ? 'unverified' : brand.trim().toLowerCase();
}
export const BOWLING_BALL_BRANDS = Array.from(
    MANUFACTURER_EQUIPMENT.filter(product => product.category === 'BALL').reduce((groups, product) => {
        const id = ballBrandId(product.brand);
        const existing = groups.get(id);
        groups.set(id, {id, label: id === 'unverified' ? '제조사 미확인' : id === 'storm' ? 'STORM' : product.brand, count: (existing?.count ?? 0) + 1});
        return groups;
    }, new Map<string, {id: string; label: string; count: number}>()).values(),
).sort((a, b) => a.id === 'unverified' ? 1 : b.id === 'unverified' ? -1 : a.label.localeCompare(b.label, 'en'));
export function bowlingBallBrand(value: string) {
    return BOWLING_BALL_BRANDS.find(brand => brand.id === value.trim().toLowerCase())?.id ?? '';
}
export function manufacturerEquipment(slug: string) { return MANUFACTURER_EQUIPMENT.find(product => product.slug === slug); }
export function searchManufacturerEquipment(q = '', category = '', type = '', requestedBrand = '') {
    if (type === 'REVIEW') return [];
    const query = q.trim().toLocaleLowerCase('ko-KR');
    const brand = bowlingBallBrand(requestedBrand);
    return MANUFACTURER_EQUIPMENT.filter(product => (!category || product.category === category)
        && (!brand || (product.category === 'BALL' && ballBrandId(product.brand) === brand))
        && (!query || [product.title, product.brand, product.model, product.summary, ...product.paragraphs].join(' ').toLocaleLowerCase('ko-KR').includes(query)));
}
export function pageManufacturerEquipment(q = '', category = '', type = '', requestedPage = 1, brand = '') {
    const matches = searchManufacturerEquipment(q, category, type, brand);
    const pages = Math.max(1, Math.ceil(matches.length / MANUFACTURER_EQUIPMENT_PAGE_SIZE));
    const page = Number.isSafeInteger(requestedPage) ? Math.max(1, Math.min(pages, requestedPage)) : 1;
    return { products: matches.slice((page - 1) * MANUFACTURER_EQUIPMENT_PAGE_SIZE, page * MANUFACTURER_EQUIPMENT_PAGE_SIZE), total: matches.length, page, pages };
}
