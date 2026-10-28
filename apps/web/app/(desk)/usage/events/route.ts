import { apiPath, apiPost } from '@/lib/api/client'

/**
 * Where the browser's usage batches land (`components/analytics/usage-recorder.tsx`). The browser
 * never calls the API itself (`lib/api/config.ts`), so this forwards the batch with the session
 * cookie. Always `204`, whatever the API says or fails to say: a usage batch never produces an
 * error the reader could see (`SPEC/20-feature-analytics.md` rules 13-14).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    await apiPost(apiPath`/usage/events`, await request.json())
  } catch {
    // Dropped, not retried.
  }
  return new Response(null, { status: 204 })
}
