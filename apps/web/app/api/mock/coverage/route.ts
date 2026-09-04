/**
 * Which of the API's endpoints the corpus can actually answer, measured rather than
 * asserted: every recorded path is replayed through the router and checked against the
 * endpoint the capture filed it under.
 *
 * This is the mock's own diagnostics, not the product's API, which is why it sits outside
 * `/api/v1` — nothing under that prefix is ours to add, because Nest has to answer all of it.
 *
 * It is the first thing a screen slice should call: it says what can be built from
 * recordings and what would have to be invented, which is the line this whole increment
 * exists to hold.
 */

import { getCoverage } from "@/mocks/coverage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return Response.json(await getCoverage(), { headers: { "cache-control": "no-store" } });
}
