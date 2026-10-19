import bundle from '../../content/equipment/manufacturers-20261019.json';

export const MANUFACTURER_EQUIPMENT = bundle.products;
export const MANUFACTURER_EQUIPMENT_CHECKED_AT = bundle.checkedAt;
export function manufacturerEquipment(slug: string) { return MANUFACTURER_EQUIPMENT.find(product => product.slug === slug); }
export function searchManufacturerEquipment(q = '', category = '', type = '') {
    if (type === 'REVIEW') return [];
    const query = q.trim().toLocaleLowerCase('ko-KR');
    return MANUFACTURER_EQUIPMENT.filter(product => (!category || product.category === category)
        && (!query || [product.title, product.brand, product.model, product.summary, ...product.paragraphs].join(' ').toLocaleLowerCase('ko-KR').includes(query)));
}
