/**
 * The mock API, mounted where the real one will be.
 *
 * Everything under `/api/v1` is answered out of the golden corpus — see
 * `apps/web/mocks/router.ts` for how a live request finds its recording, and
 * `apps/web/mocks/config.ts` for the one change that points the app at Nest instead.
 *
 * `/api/v1` is the corpus's own base path, so the path this handler strips is exactly the
 * prefix the capture stripped. PATCH is exported although the corpus never recorded one,
 * because a screen calling it should be told the corpus has nothing rather than get a 405
 * from Next and be left guessing which end the problem is at. HEAD is deliberately *not*
 * exported: Next answers it from GET, and taking it over would turn every HEAD — which the
 * corpus records nowhere and the real API answers everywhere — into a 501.
 */

import { serveFromCorpus } from "@/mocks/serve";

// The response depends on a header and a cookie, and the corpus is read from disk, so there
// is nothing here to prerender.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE_PATH = "/api/v1";

function handle(request: Request): Promise<Response> {
  return serveFromCorpus(request, BASE_PATH);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
