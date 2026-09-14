/**
 * The demo screenshot set, taken from a running Collega rather than drawn.
 *
 *   pnpm start      # in one terminal — API on :3001, web on :3000, database seeded
 *   pnpm shots      # in another
 *
 * Every image under `demo/screenshots/` comes out of this script, so a screen that changes is
 * re-photographed by re-running it rather than by somebody remembering which PNG went stale.
 * `shots.js` holds the order and the captions; this file holds only how each one is reached.
 *
 * **It signs in as the seeded demo accounts and writes through the UI.** That is deliberate — the
 * discussion shot is a real comment posted by a real account, not fixture text — and it is why this
 * refuses to run against anything but a local server: `demo.md`'s passwords are public.
 */

import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Page } from '@playwright/test'
import { SHOTS } from './shots.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = join(ROOT, 'demo', 'screenshots')
const BASE = process.env.COLLEGA_DEMO_URL ?? 'http://localhost:3000'

/** `demo.md` — every seeded account shares this, and none is forced to change it. */
const PASSWORD = 'Abc123!'
const ORG = 'acme-robotics.demo.collega.test'
const ACCOUNTS = {
  admin: `orgadmin@${ORG}`,
  user: `user@${ORG}`,
  readonly: `readonly@${ORG}`,
}

/** The board and the idea the walkthrough follows, by name — the seed's ids are not the contract. */
const BOARD_NAME = 'Ideas'
const HERO_IDEA = 'Field service enablement: Reduce manual handoffs'
const HERO_COMMENT =
  'Agreed — @Maya Collaborator can you check the handoff timings before we scope this?'

/**
 * A deck slide is a window onto the product, not a page dump: a tall `fullPage` capture of a
 * twenty-two-row list is unreadable at slide size. So every shot is one viewport, and 16:10 at 2x
 * lands on a projector without resampling.
 */
const VIEWPORT = { width: 1600, height: 1000 }
const SCALE = 2

/** The Next dev-server badge floats over the bottom-left corner of every screen. */
const HIDE_DEV_OVERLAY = 'nextjs-portal{display:none!important}'

function say(message: string): void {
  console.log(`  ${message}`)
}

function fail(message: string): never {
  console.error(`\n\x1b[31m${message}\x1b[0m\n`)
  process.exit(1)
}

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE)) {
  fail(
    `Refusing to run against ${BASE}.\n\n` +
      'This script signs in with the demo passwords published in demo.md and posts a comment, so it\n' +
      'only ever points at a server on this machine.',
  )
}

const probe = await fetch(`${BASE}/login`).catch(() => null)
if (probe === null || !probe.ok) {
  fail(`Nothing answering at ${BASE}/login. Start the application first:\n\n  pnpm start`)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })

/** One context per account, because the session is a cookie and the roles must not share one. */
async function signIn(email: string) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE })
  const page = await context.newPage()
  await page.goto(`${BASE}/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  // The route gate sends a signed-in visitor on; which surface it lands on is not this script's
  // business, only that it is no longer the form.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 })
  return page
}

/** Settled: the route rendered, the dev badge is gone, and nothing is still animating in. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: HIDE_DEV_OVERLAY })
  await page.waitForTimeout(400)
}

const captured = new Set<string>()

async function shoot(page: Page, id: string): Promise<void> {
  const shot = SHOTS.find((s) => s.id === id)
  if (shot === undefined) fail(`No shot named '${id}' in shots.js.`)
  await page.screenshot({ path: join(OUT, shot.file) })
  captured.add(id)
  say(`${shot.file}  ${shot.title}`)
}

// --- The walkthrough -----------------------------------------------------------------------------

say(`capturing to demo/screenshots at ${VIEWPORT.width}×${VIEWPORT.height} @${SCALE}x`)

// 01 — the sign-in form, before anyone is signed in.
const anon = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE })
const anonPage = await anon.newPage()
await anonPage.goto(`${BASE}/login`)
await settle(anonPage)
await shoot(anonPage, 'sign-in')
await anon.close()

const admin = await signIn(ACCOUNTS.admin)

// 02 — boards, and the id of the one the rest of the walkthrough follows.
await admin.goto(`${BASE}/boards`)
await settle(admin)
await shoot(admin, 'boards')

const boardHref = await admin
  .locator('a[href^="/boards/"]')
  .filter({ hasText: new RegExp(`^${BOARD_NAME}$`) })
  .first()
  .getAttribute('href')
if (boardHref === null) fail(`No board called '${BOARD_NAME}' — has the demo seed run?`)
const boardUrl = `${BASE}${boardHref}`

// 03/04 — the board, from its left-most lane and then from its right-most.
await admin.goto(boardUrl)
await settle(admin)
await shoot(admin, 'board-kanban')

// The lane strip scrolls inside a page that does not, so the right-hand lanes are reached by
// scrolling the strip itself. `max-w-[1320px]` on the main column means no viewport is wide enough
// to make this unnecessary.
const lanes = admin.locator('main div.overflow-x-auto').first()
await lanes.evaluate((el) => {
  el.scrollLeft = el.scrollWidth
})
await admin.waitForTimeout(500)
await shoot(admin, 'board-kanban-right')

// 05 — the create form, over the board it creates into.
await admin.goto(boardUrl)
await settle(admin)
await admin.getByRole('button', { name: /^new idea$/i }).click()
await admin.getByLabel('Title').waitFor()
await admin.waitForTimeout(400)
await shoot(admin, 'new-idea')
await admin.keyboard.press('Escape')

// 06 — every idea in the organization.
await admin.goto(`${BASE}/ideas`)
await settle(admin)
await shoot(admin, 'ideas-list')

const ideaHref = await admin
  .locator('a[href^="/ideas/"]')
  .filter({ hasText: HERO_IDEA })
  .first()
  .getAttribute('href')
if (ideaHref === null) fail(`No idea called '${HERO_IDEA}' — has the demo seed run?`)
const ideaUrl = `${BASE}${ideaHref}`

// 07 — the inspector, beside the list rather than over it.
await admin.goto(ideaUrl)
await settle(admin)
await shoot(admin, 'idea-inspector')

// 09 — the palette. Typed rather than bare, because an empty palette shows a menu and a typed one
// shows it filtering.
await admin.keyboard.press('Control+k')
await admin.waitForTimeout(600)
await admin.keyboard.type('boa', { delay: 80 })
await admin.waitForTimeout(600)
await shoot(admin, 'palette')
await admin.keyboard.press('Escape')

// 08/10 — the contributor's view, and the comment that makes the discussion worth photographing.
const user = await signIn(ACCOUNTS.user)
await user.goto(ideaUrl)
await settle(user)

// Idempotent: a second run must not stack a fourth, fifth and sixth copy of the same sentence onto
// the demo data. The comment is posted only when it is not already there.
const alreadyCommented = await user.getByText(HERO_COMMENT, { exact: false }).count()
if (alreadyCommented === 0) {
  await user.getByPlaceholder(/add a comment/i).fill(HERO_COMMENT)
  await user.getByRole('button', { name: /^comment$/i }).click()
  await user.getByText(HERO_COMMENT, { exact: false }).waitFor({ timeout: 20_000 })
  await user.waitForTimeout(600)
}
// The thread is the point of this shot, and it sits at the bottom of a scrolling inspector.
await user.getByText(HERO_COMMENT, { exact: false }).scrollIntoViewIfNeeded()
await user.waitForTimeout(400)
await shoot(user, 'discussion')

await user.goto(boardUrl)
await settle(user)
await shoot(user, 'role-user')

// 11 — and the same board with nothing on it available to press.
const readonly = await signIn(ACCOUNTS.readonly)
await readonly.goto(boardUrl)
await settle(readonly)
await shoot(readonly, 'role-readonly')

await browser.close()

const missing = SHOTS.filter((shot) => !captured.has(shot.id))
if (missing.length > 0) fail(`Never captured: ${missing.map((s) => s.id).join(', ')}`)
if (!existsSync(join(OUT, SHOTS[0].file))) fail('Wrote nothing.')

console.log(`\n  ${SHOTS.length} screenshots in demo/screenshots\n`)
