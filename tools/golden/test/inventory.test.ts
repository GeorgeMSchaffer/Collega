// The inventory used to be parsed out of controller source, and most of this file pinned that
// parser. The source is gone (conversion slice F6) and the inventory is a committed snapshot, so
// what is left to test splits in two:
//
//   1. The snapshot and the corpus manifest still describe the same 81 endpoints. They were
//      recorded together and are meaningless apart -- a coverage report measured against an
//      inventory the fixtures do not match would read as a coverage hole rather than as a broken
//      pair, which is the exact failure the parser existed to prevent.
//   2. Coverage and scaffold, which never cared where an Endpoint came from. They are fed
//      hand-built endpoints here, which is what the parser's sample was standing in for anyway.

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { report as coverageReport, expectedRoles } from '../src/coverage.ts'
import { type Endpoint, readInventory } from '../src/inventory.ts'
import { scenarioFor } from '../src/scaffold.ts'

const SAMPLE: Endpoint[] = [
  {
    id: 'POST /auth/login',
    verb: 'POST',
    route: '/auth/login',
    controller: 'Auth',
    action: 'Login',
    authorize: 'anonymous',
    params: [],
    statuses: [200, 401],
    source: 'AuthController.cs',
  },
  {
    id: 'GET /auth/me',
    verb: 'GET',
    route: '/auth/me',
    controller: 'Auth',
    action: 'Me',
    authorize: 'any',
    params: [],
    statuses: [200, 401],
    source: 'AuthController.cs',
  },
  {
    id: 'GET /organizations/{organizationId}/ai-assist/usage',
    verb: 'GET',
    route: '/organizations/{organizationId}/ai-assist/usage',
    controller: 'OrganizationAiAssist',
    action: 'GetOrganizationUsage',
    authorize: ['OrgAdmin', 'SiteAdmin'],
    params: ['organizationId'],
    statuses: [200, 401],
    source: 'AiAssistController.cs',
  },
]

test('the snapshot holds the 81 endpoints the plan is costed on', async () => {
  const endpoints = await readInventory()
  assert.equal(endpoints.length, 81)
  assert.deepEqual(
    endpoints
      .filter((e) => e.authorize === 'anonymous')
      .map((e) => e.id)
      .sort(),
    ['GET /health', 'POST /auth/login', 'POST /auth/register'],
  )
})

test('the snapshot and the corpus manifest describe the same surface', async () => {
  const endpoints = await readInventory()
  const manifestPath = path.resolve(import.meta.dirname, '..', 'fixtures', 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { endpoints: string[] }

  assert.deepEqual(
    endpoints.map((e) => e.id).sort(),
    [...manifest.endpoints].sort(),
    'the inventory and the fixtures were recorded together; one edited without the other is a bug',
  )
})

test('every endpoint carries the fields coverage and scaffold read', async () => {
  for (const e of await readInventory()) {
    assert.ok(e.id && e.verb && e.route && e.controller && e.action, `incomplete endpoint: ${e.id}`)
    assert.ok(Array.isArray(e.params), `${e.id}: params must be an array`)
    assert.ok(Array.isArray(e.statuses), `${e.id}: statuses must be an array`)
    assert.deepEqual(
      e.params,
      [...e.route.matchAll(/\{(\w+)\}/g)].map((m) => m[1]),
      `${e.id}: params must match the route template`,
    )
  }
})

test('coverage counts an endpoint no scenario touches', () => {
  const r = coverageReport(SAMPLE, [
    { endpoint: 'POST /auth/login', role: 'anonymous', kind: 'success' },
  ])
  assert.equal(r.covered, 1)
  assert.deepEqual(r.untouched, [
    'GET /auth/me',
    'GET /organizations/{organizationId}/ai-assist/usage',
  ])
  assert.deepEqual(r.successOnly, ['POST /auth/login'])
})

test('coverage names the roles an endpoint is missing', () => {
  const r = coverageReport(SAMPLE, [
    { endpoint: 'GET /auth/me', role: 'OrgAdmin', kind: 'success' },
    { endpoint: 'GET /auth/me', role: 'anonymous', kind: 'denied' },
  ])
  const partial = r.partialRoles.find((p) => p.endpoint === 'GET /auth/me')
  assert.deepEqual(partial?.missing, ['SiteAdmin', 'User', 'ReadOnly'])
})

test('an authorized endpoint expects all four roles plus anonymous', () => {
  assert.deepEqual(expectedRoles(SAMPLE[0]), ['anonymous'])
  assert.equal(expectedRoles(SAMPLE[1]).length, 5)
})

test('the scaffold writes a cell per role, with the status each should see', () => {
  const scenario = scenarioFor('Auth', SAMPLE.slice(0, 2))
  assert.equal(scenario.steps.length, 1 + 5)
  assert.ok(scenario.steps.every((s) => s.todo === true))

  const anonymousMe = scenario.steps.find((s) => s.id === 'me.anonymous')
  assert.deepEqual([anonymousMe?.kind, anonymousMe?.expect], ['denied', 401])
  const adminMe = scenario.steps.find((s) => s.id === 'me.orgadmin')
  assert.deepEqual([adminMe?.kind, adminMe?.expect], ['success', 200])
})

test('the scaffold turns route parameters into bindable variables', () => {
  const scenario = scenarioFor('OrganizationAiAssist', SAMPLE.slice(2))
  assert.equal(scenario.steps[0].path, '/organizations/{{organizationId}}/ai-assist/usage')

  const refused = scenario.steps.find((s) => s.id === 'getorganizationusage.user')
  assert.deepEqual(
    [refused?.kind, refused?.expect],
    ['denied', 401],
    'no 403 is declared on this action',
  )
})
