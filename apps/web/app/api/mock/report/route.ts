/**
 * What the mock has served since this server started: every resolution, and whether it was a
 * literal recording, a substitution, or a refusal.
 *
 * This is the mock's own diagnostics, not the product's API, which is why it sits outside
 * `/api/v1` — nothing under that prefix is ours to add, because Nest has to be able to
 * answer all of it.
 */

import { readReport } from "@/mocks/report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(): Response {
  return Response.json(readReport(), { headers: { "cache-control": "no-store" } });
}
