/**
 * The absolute origin the sitemap and robots responses name. Vercel sets the production host on
 * every deployment, so a preview's sitemap still points crawlers at production.
 */
export function siteUrl(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL
  return host ? `https://${host}` : 'http://localhost:3000'
}
