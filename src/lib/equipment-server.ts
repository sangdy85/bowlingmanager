import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { EQUIPMENT_TYPES, equipmentCategory } from '@/lib/equipment';
export function publicEquipmentWhere(q='',category='',type=''):Prisma.CommunityPostWhereInput {
    return {category:'EQUIPMENT',status:'PUBLISHED',...(equipmentCategory(category) ? {equipmentCategory:category} : {}),...(EQUIPMENT_TYPES.some(t=>t.id===type) ? {equipmentType:type} : {}),...(q ? {OR:[{title:{contains:q}},{content:{contains:q}},{equipmentBrand:{contains:q}},{equipmentModel:{contains:q}}]} : {})};
}
export async function publishedEquipment(id:string) {
    return prisma.communityPost.findFirst({where:{id,category:'EQUIPMENT',status:'PUBLISHED'},include:{author:{select:{id:true,name:true}},comments:{where:{status:'PUBLISHED'},orderBy:[{createdAt:'asc'},{id:'asc'}],include:{author:{select:{id:true,name:true}}}}}});
}
