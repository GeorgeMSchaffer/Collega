/**
 * What the mock can and cannot answer, measured rather than claimed.
 *
 * Two different questions, both worth asking before trusting a screen:
 *
 *  - **Does the router resolve the endpoint at all?** Every recorded request is replayed
 *    through `matchEndpoint` and checked against the endpoint the capture filed it under. A
 *    template that routes to the wrong endpoint — or to none — shows up here rather than as
 *    a screen with somebody else's data on it.
 *  - **Which identities can reach it?** An endpoint recorded at three roles is an endpoint
 *    that refuses the fourth, and walking the app as that fourth role should show the
 *    refusal, not a gap. The gaps that are decisions rather than holes are named in
 *    `tools/golden/README.md`; the rest are simply not covered.
 */

import { type Corpus, getCorpus } from "./corpus";
import { MOCK_IDENTITIES, type MockIdentity } from "./identity";
import { matchEndpoint } from "./router";

export interface EndpointCoverage {
  readonly endpoint: string;
  /** Recorded paths this endpoint routes correctly from, and any that do not. */
  readonly resolves: boolean;
  readonly identities: readonly MockIdentity[];
  readonly missingIdentities: readonly MockIdentity[];
  readonly cases: number;
}

export interface CoverageReport {
  readonly capturedAt: string;
  readonly fixturesDir: string;
  readonly fixtures: number;
  readonly endpoints: number;
  readonly endpointsResolved: number;
  readonly endpointsUnresolved: readonly string[];
  readonly endpointsWithoutFixtures: readonly string[];
  readonly identityGaps: readonly string[];
  readonly perEndpoint: readonly EndpointCoverage[];
}

function buildCoverage(corpus: Corpus): CoverageReport {
  const casesByEndpoint = new Map<string, number>();
  const unresolved = new Set<string>();

  for (const fixture of corpus.fixtures) {
    casesByEndpoint.set(fixture.endpoint, (casesByEndpoint.get(fixture.endpoint) ?? 0) + 1);
    const routed = matchEndpoint(corpus, fixture.request.method, fixture.request.path);
    if (routed?.id !== fixture.endpoint) unresolved.add(fixture.endpoint);
  }

  const perEndpoint: EndpointCoverage[] = corpus.endpoints.map((endpoint) => {
    const identities = corpus.identitiesByEndpoint.get(endpoint.id) ?? [];
    return {
      endpoint: endpoint.id,
      resolves: !unresolved.has(endpoint.id) && (casesByEndpoint.get(endpoint.id) ?? 0) > 0,
      identities,
      missingIdentities: MOCK_IDENTITIES.filter((identity) => !identities.includes(identity)),
      cases: casesByEndpoint.get(endpoint.id) ?? 0,
    };
  });

  return {
    capturedAt: corpus.capturedAt,
    fixturesDir: corpus.dir,
    fixtures: corpus.fixtures.length,
    endpoints: corpus.endpoints.length,
    endpointsResolved: perEndpoint.filter((entry) => entry.resolves).length,
    endpointsUnresolved: perEndpoint.filter((entry) => !entry.resolves).map((entry) => entry.endpoint),
    endpointsWithoutFixtures: perEndpoint.filter((entry) => entry.cases === 0).map((entry) => entry.endpoint),
    identityGaps: perEndpoint.flatMap((entry) =>
      entry.missingIdentities.map((identity) => `${entry.endpoint} | ${identity}`),
    ),
    perEndpoint,
  };
}

export async function getCoverage(): Promise<CoverageReport> {
  return buildCoverage(await getCorpus());
}
