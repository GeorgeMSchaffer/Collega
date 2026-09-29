// Session reuse across scenarios (SPEC/decisions.md 2026-09-29, "The test harnesses reuse
// sessions; the auth rate limits stay"): each role signs in once per run, signs in again only after
// a scenario that starts or ends View As, and the sessions held for a scenario's own accounts are
// dropped after every scenario. Driven through a fake fetcher, so nothing here reaches a network.
//
// `cli.ts` composes these after each scenario as
// `runner.resetSessions(changesSessionState(scenario) ? 'all' : 'overrides')`. It runs on import,
// so `runAll` below repeats that one line rather than importing it.

import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import type { Endpoint, Role } from '../src/inventory.ts'
import { changesSessionState, type Fetcher, Runner } from '../src/runner.ts'
import { loadScenarios, type Scenario, type Step } from '../src/scenarios.ts'

const CREDENTIALS: Record<Role, { email: string; password: string }> = {
  SiteAdmin: { email: 'siteadmin@fake.test', password: 'pw' },
  OrgAdmin: { email: 'orgadmin@fake.test', password: 'pw' },
  User: { email: 'user@fake.test', password: 'pw' },
  ReadOnly: { email: 'readonly@fake.test', password: 'pw' },
}

function endpoint(id: string): Endpoint {
  const [verb, route] = id.split(' ') as [Endpoint['verb'], string]
  return {
    id,
    verb,
    route,
    controller: 'Fake',
    action: 'Fake',
    authorize: 'any',
    params: [],
    statuses: [200],
  }
}

const ENDPOINTS = new Map(
  ['GET /auth/me', 'POST /auth/view-as', 'DELETE /auth/view-as', 'PUT /auth/me/password'].map(
    (id) => [id, endpoint(id)],
  ),
)

/**
 * Answers every request 200. A sign-in the runner makes for a session (no `accept` header, unlike
 * a step) is counted by the email it signed in as, and gets a token naming it and its count.
 */
function fakeApi() {
  const signIns: string[] = []
  const tokensSeen: string[] = []
  const fetcher: Fetcher = async (url, init) => {
    if (url.endsWith('/auth/login') && init.headers.accept === undefined) {
      const { email } = JSON.parse(init.body ?? '{}') as { email: string }
      signIns.push(email)
      const token = `${email}#${signIns.filter((seen) => seen === email).length}`
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        text: JSON.stringify({ accessToken: token }),
      }
    }
    if (init.headers.authorization) tokensSeen.push(init.headers.authorization)
    return { status: 200, headers: { 'content-type': 'application/json' }, text: '{}' }
  }
  const runner = new Runner(
    { baseUrl: 'http://fake', basePath: '/api/v1', credentials: CREDENTIALS, stopOnError: false },
    fetcher,
  )
  return { runner, signIns, tokensSeen }
}

function step(
  id: string,
  as: Step['as'],
  stepEndpoint = 'GET /auth/me',
  extra: Partial<Step> = {},
) {
  return { id, endpoint: stepEndpoint, as, kind: 'success', expect: 200, ...extra } as Step
}

function scenario(name: string, steps: Step[]): Scenario {
  return { name, steps, file: `${name}.json` }
}

/** The replay's loop, as `cli.ts` runs it. */
async function runAll(runner: Runner, scenarios: readonly Scenario[], endpoints = ENDPOINTS) {
  for (const each of scenarios) {
    await runner.runScenario(each, endpoints)
    runner.resetSessions(changesSessionState(each) ? 'all' : 'overrides')
  }
}

const count = (list: readonly string[], value: string) => list.filter((x) => x === value).length

test('a role signs in once however many scenarios and steps use it', async () => {
  const { runner, signIns, tokensSeen } = fakeApi()

  await runAll(runner, [
    scenario('first', [step('a', 'OrgAdmin'), step('b', 'OrgAdmin'), step('c', 'User')]),
    scenario('second', [step('a', 'OrgAdmin'), step('b', 'User')]),
    scenario('third', [step('a', 'OrgAdmin')]),
  ])

  assert.deepEqual(signIns, ['orgadmin@fake.test', 'user@fake.test'])
  assert.deepEqual(
    new Set(tokensSeen),
    new Set(['Bearer orgadmin@fake.test#1', 'Bearer user@fake.test#1']),
  )
})

test('every role signs in again after a scenario that starts or ends View As', async () => {
  const { runner, signIns } = fakeApi()

  await runAll(runner, [
    scenario('before', [step('a', 'SiteAdmin'), step('b', 'User')]),
    scenario('view-as', [
      step('start', 'SiteAdmin', 'POST /auth/view-as'),
      step('end', 'SiteAdmin', 'DELETE /auth/view-as'),
    ]),
    scenario('after', [step('a', 'SiteAdmin'), step('b', 'User')]),
    scenario('later', [step('a', 'SiteAdmin'), step('b', 'User')]),
  ])

  assert.equal(count(signIns, 'siteadmin@fake.test'), 2)
  assert.equal(count(signIns, 'user@fake.test'), 2)
})

test("a scenario's own accounts sign in afresh in every scenario", async () => {
  const { runner, signIns } = fakeApi()
  const own = { email: 'created@fake.test', password: 'pw' }
  const withOwn = (name: string) =>
    scenario(name, [
      step('a', 'User', 'GET /auth/me', { credentials: own }),
      step('b', 'User', 'GET /auth/me', { credentials: own }),
      step('c', 'User'),
    ])

  await runAll(runner, [withOwn('first'), withOwn('second')])

  assert.equal(count(signIns, 'created@fake.test'), 2)
  assert.equal(count(signIns, 'user@fake.test'), 1)
})

test('only a View As step that runs makes a scenario change session state', () => {
  assert.equal(
    changesSessionState(scenario('start', [step('a', 'SiteAdmin', 'POST /auth/view-as')])),
    true,
  )
  assert.equal(
    changesSessionState(scenario('end', [step('a', 'SiteAdmin', 'DELETE /auth/view-as')])),
    true,
  )
  assert.equal(
    changesSessionState(
      scenario('todo', [step('a', 'SiteAdmin', 'POST /auth/view-as', { todo: true })]),
    ),
    false,
  )
  assert.equal(
    changesSessionState(scenario('password', [step('a', 'User', 'PUT /auth/me/password')])),
    false,
  )
})

test('resetSessions drops overrides alone, or everything', async () => {
  const { runner, signIns } = fakeApi()
  const own = { email: 'created@fake.test', password: 'pw' }
  await runner.sessionFor('OrgAdmin')
  await runner.sessionFor('User', own)

  runner.resetSessions('overrides')
  await runner.sessionFor('OrgAdmin')
  await runner.sessionFor('User', own)
  assert.deepEqual(signIns, ['orgadmin@fake.test', 'created@fake.test', 'created@fake.test'])

  runner.resetSessions('all')
  await runner.sessionFor('OrgAdmin')
  await runner.sessionFor('User', own)
  assert.deepEqual(signIns.slice(3), ['orgadmin@fake.test', 'created@fake.test'])
})

test('the committed corpus signs each role in at most once per View As boundary', async () => {
  const dir = fileURLToPath(new URL('../scenarios', import.meta.url))
  const scenarios = await loadScenarios(path.resolve(dir))
  const endpoints = new Map(
    scenarios.flatMap((each) => each.steps).map((each) => [each.endpoint, endpoint(each.endpoint)]),
  )
  const { runner, signIns } = fakeApi()

  await runAll(runner, scenarios, endpoints)

  const epochs = 1 + scenarios.filter(changesSessionState).length
  for (const { email } of Object.values(CREDENTIALS)) {
    assert.ok(
      count(signIns, email) <= epochs,
      `${email} signed in ${count(signIns, email)} times over ${epochs} session epochs`,
    )
  }
  const roleSignIns = signIns.filter((email) => email.endsWith('@fake.test'))
  assert.ok(roleSignIns.length <= 4 * epochs, `${roleSignIns.length} role sign-ins`)
})
