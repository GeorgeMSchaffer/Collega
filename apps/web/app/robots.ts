import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'

/** Sign-in and register are crawlable; nothing else is (`SPEC/20-feature-analytics.md` req. 5). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: ['/login', '/register'], disallow: '/' },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
