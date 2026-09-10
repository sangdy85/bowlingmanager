import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bowlingmanager.co.kr';

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/about',
          '/guide',
          '/guide/*',
          '/privacy',
          '/terms',
          '/disclaimer',
          '/inquiry',
          '/centers',
          '/tournaments',
        ],
        disallow: [
          '/admin/',
          '/api/',
          '/settings/',
          '/personal/',
          '/score/',
        ],
      },
      {
        userAgent: 'Mediapartners-Google',
        allow: '/',
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
