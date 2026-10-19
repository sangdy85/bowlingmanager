import type { MetadataRoute } from 'next';
import { PUBLISHED_GUIDE_ARTICLES } from '@/lib/guide-data';
import { PUBLIC_ORIGIN } from '@/lib/public-web';
import prisma from '@/lib/prisma';
import { MANUFACTURER_EQUIPMENT, MANUFACTURER_EQUIPMENT_CHECKED_AT } from '@/lib/manufacturer-equipment';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
 // Unknown change times are omitted, never replaced with request time.
 const pages=['','/guide','/competitions','/equipment','/community','/tools/average','/privacy','/terms','/disclaimer'];
 const notices = await prisma.competitionNotice.findMany({where:{published:true},select:{id:true,updatedAt:true}});
 return [...pages.map(path=>({url:PUBLIC_ORIGIN+path})),...PUBLISHED_GUIDE_ARTICLES.map(article=>({url:PUBLIC_ORIGIN+'/guide/'+article.slug,lastModified:new Date(article.updatedAt||article.date)})),...MANUFACTURER_EQUIPMENT.map(product=>({url:PUBLIC_ORIGIN+'/equipment/products/'+product.slug,lastModified:new Date(MANUFACTURER_EQUIPMENT_CHECKED_AT)})),...notices.map(notice=>({url:PUBLIC_ORIGIN+'/competitions/'+notice.id,lastModified:notice.updatedAt}))];
}
