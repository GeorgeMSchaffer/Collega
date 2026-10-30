import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'

/** The public pages only (`SPEC/20-feature-analytics.md` requirement 5). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl()}/login` },
    { url: `${siteUrl()}/register` },
    { url: `${siteUrl()}/privacy` },
  ]
}
