import type { MetadataRoute } from 'next';
import { PUBLISHED_GUIDE_ARTICLES } from '@/lib/guide-data';
import { PUBLIC_ORIGIN } from '@/lib/public-web';
export default function sitemap(): MetadataRoute.Sitemap {
 // Unknown change times are omitted, never replaced with request time.
 const pages=['','/guide','/about','/tools/average','/privacy','/terms','/disclaimer'];
 return [...pages.map(path=>({url:PUBLIC_ORIGIN+path})),...PUBLISHED_GUIDE_ARTICLES.map(article=>({url:PUBLIC_ORIGIN+'/guide/'+article.slug,lastModified:new Date(article.updatedAt||article.date)}))];
}
