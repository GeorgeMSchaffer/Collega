// The endpoint inventory: the 81 routes the corpus was recorded against.
//
// It used to be parsed out of the controllers of the application this replaced, because the corpus
// is only as good as its coverage and coverage has to be measured against something derived from
// the code rather than hand-listed. Those controllers are gone (conversion slice F6), and with them
// the parser -- so the inventory it produced is committed instead, as `tools/golden/inventory.json`.
//
// That is not a downgrade for what the harness still does. The corpus is a RECORD of one captured
// run, and the inventory is the shape of the surface at that moment; freezing the two together is
// more honest than deriving one of them from source that has since moved on. `inventory.test.ts`
// holds the snapshot and the corpus manifest to each other, so the pair cannot drift apart
// unnoticed.
//
// Re-deriving it from the Nest controllers is a different job with a different parser, and it is
// not this file: read `SPEC/decisions.md` 2026-09-09 on the corpus being a regression detector and
// not a specification before deciding the harness needs one.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type HttpVerb = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type Endpoint = {
  /** Stable key: "GET /boards/{boardId}". Used everywhere a fixture points back. */
  id: string
  verb: HttpVerb
  /** Route template with type constraints stripped: "/boards/{boardId}". */
  route: string
  controller: string
  action: string
  /** The roles admitted, or "anonymous", or "any" for authenticated-but-unrestricted. */
  authorize: 'anonymous' | 'any' | string[]
  /** Path parameter names, in route order. */
  params: string[]
  /** The success and error statuses the endpoint declared. */
  statuses: number[]
  /** The file the route was read from, at capture time. That tree no longer exists. */
  source: string
}

const SNAPSHOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'inventory.json')

/** The recorded inventory. The argument exists so a test can point at a different snapshot. */
export async function readInventory(snapshot: string = SNAPSHOT): Promise<Endpoint[]> {
  return JSON.parse(await readFile(snapshot, 'utf8')) as Endpoint[]
}

export const ROLES = ['SiteAdmin', 'OrgAdmin', 'User', 'ReadOnly'] as const
export type Role = (typeof ROLES)[number]
