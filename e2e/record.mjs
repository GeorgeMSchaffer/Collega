/**
 * Runs the suite with video on, then collects the clips somewhere watchable.
 *
 * Playwright writes one `video.webm` per test into `test-results/<mangled-name>/` — accurate and
 * unwatchable: every file has the same name, and the directory carries a hash in the middle. This
 * copies them out as `NN - <title>.webm`.
 *
 * **The numbering is declaration order, not directory order**, and that is the whole point. The
 * journey spec is a chain — create an organization, then a user, then sign in as them — and sorting
 * its clips alphabetically puts step 7 before step 1. Reading the JSON reporter rather than the
 * directory names is what makes the order the order somebody would watch in, and it gets the real
 * test titles for free instead of a truncated hash.
 *
 * `COLLEGA_E2E_VIDEO=on` is set here rather than in the config, so an ordinary `pnpm test:e2e`
 * still records only failures — a full run writes a file per test and nobody wants that in CI.
 *
 * Usage: `pnpm --filter collega-e2e test:record`, or with a filter,
 * `pnpm --filter collega-e2e test:record journey`.
 */

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const RESULTS = join(HERE, 'test-results')
const OUT = join(HERE, 'recordings')
const REPORT = join(RESULTS, 'record-report.json')

// A clean slate, so the numbering matches this run rather than accumulating across runs.
rmSync(RESULTS, { recursive: true, force: true })
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const result = spawnSync('playwright', ['test', ...process.argv.slice(2)], {
  cwd: HERE,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    COLLEGA_E2E_VIDEO: 'on',
    PLAYWRIGHT_JSON_OUTPUT_NAME: REPORT,
    // `list` keeps the console output readable; `json` is what this script reads afterwards.
    PW_TEST_REPORTER: 'list',
  },
})

if (!existsSync(REPORT)) {
  console.log('\nNo JSON report was written, so there is nothing to collect.')
  process.exit(result.status ?? 1)
}

/** Walks the reporter's nested suites in declaration order, yielding every test with its video. */
function* testsInOrder(suites, trail = []) {
  for (const suite of suites ?? []) {
    const here = suite.title ? [...trail, suite.title] : trail
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        for (const run of test.results ?? []) {
          const video = (run.attachments ?? []).find((a) => a.name === 'video')
          if (video?.path) yield { title: [...here, spec.title].join(' › '), video: video.path, status: run.status }
        }
      }
    }
    yield* testsInOrder(suite.suites, here)
  }
}

/** Windows forbids these in a filename, and a test title is free text. */
function safe(title) {
  return title.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 110)
}

const report = JSON.parse(readFileSync(REPORT, 'utf8'))
let n = 0
const written = []
for (const { title, video, status } of testsInOrder(report.suites)) {
  if (!existsSync(video)) continue
  n += 1
  const mark = status === 'passed' ? '' : ` [${String(status)}]`
  const name = `${String(n).padStart(2, '0')} - ${safe(title)}${mark}.webm`
  copyFileSync(video, join(OUT, name))
  written.push(name)
}

console.log(`\n▸ ${String(n)} recording(s) in e2e/recordings/, in the order they ran\n`)
for (const name of written) console.log(`    ${name}`)
if (n === 0) console.log('    (none — a run where every test is skipped writes no video)')

// The run's own exit code stands: a deliberately failing spec should still fail a recording run.
process.exit(result.status ?? 0)
