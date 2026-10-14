export const EQUIPMENT_CATEGORIES = [{id:'BALL',label:'볼링공',icon:'🎳'},{id:'SHOES',label:'볼링화',icon:'👟'},{id:'BAG',label:'가방',icon:'🎒'},{id:'ACCESSORY',label:'액세서리 · 관리용품',icon:'🧰'}] as const;
export const EQUIPMENT_TYPES = [{id:'INTRO',label:'제품 소개'},{id:'REVIEW',label:'사용 후기'}] as const;
export type EquipmentInput = {type:string;category:string;brand:string;model:string;link:string};
export class EquipmentInputError extends Error {}
export function equipmentCategory(value: string | null) { return EQUIPMENT_CATEGORIES.find(c=>c.id===value); }
export function equipmentType(value: string | null) { return EQUIPMENT_TYPES.find(c=>c.id===value)?.label ?? '용품 이야기'; }
export function validateEquipment(input: EquipmentInput) {
    if (!input || !EQUIPMENT_TYPES.some(t=>t.id===input.type) || !equipmentCategory(input.category)) throw new EquipmentInputError('글 유형과 용품 종류를 선택해주세요.');
    if (typeof input.model!=='string' || !input.model.trim() || input.model.trim().length>120) throw new EquipmentInputError('제품명·모델명을 1~120자로 입력해주세요.');
    if (typeof input.brand!=='string' || input.brand.trim().length>60) throw new EquipmentInputError('브랜드는 60자 이내로 입력해주세요.');
    if (typeof input.link!=='string' || input.link.trim().length>2048) throw new EquipmentInputError('관련 링크를 확인해주세요.');
    let equipmentLink: string | null = null;
    if (input.link.trim()) {
        try {
            if (/[\x00-\x20\x7f\\]/.test(input.link.trim())) throw new Error();
            const url=new URL(input.link.trim());
            if (!['https:','http:'].includes(url.protocol) || url.username || url.password) throw new Error();
            equipmentLink=url.href;
        } catch { throw new EquipmentInputError('관련 링크는 http 또는 https 주소로 입력해주세요.'); }
    }
    return {equipmentType:input.type,equipmentCategory:input.category,equipmentBrand:input.brand.trim() || null,equipmentModel:input.model.trim(),equipmentLink};
}
