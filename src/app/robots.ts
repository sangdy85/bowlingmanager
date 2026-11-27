import type { MetadataRoute } from 'next';
import { PUBLIC_ORIGIN, privateRobotsRules } from '@/lib/public-web';
export default function robots(): MetadataRoute.Robots {
 return {rules:[{userAgent:'*',allow:'/',disallow:privateRobotsRules()}],sitemap:PUBLIC_ORIGIN+'/sitemap.xml'};
}
