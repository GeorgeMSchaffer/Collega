import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { KEY_VARIABLE, readEvaluationKey, redact } from '../src/credentials.ts'
import { scratchDir, TEST_KEY } from './helpers.ts'

async function envFile(text: string): Promise<string> {
  const file = path.join(await scratchDir(), '.env')
  await writeFile(file, text, 'utf8')
  return file
}

test('the key comes from PROMPT_EVAL_ANTHROPIC_API_KEY in the environment first', async () => {
  const file = await envFile(`${KEY_VARIABLE}=from-file\n`)
  assert.equal(await readEvaluationKey({ [KEY_VARIABLE]: ' from-env ' }, file), 'from-env')
})

test('without it in the environment, that one variable is read from the env file', async () => {
  const file = await envFile(
    [
      '# the API key sits beside it and is never read',
      'ANTHROPIC_API_KEY=sk-ant-api-not-this-one',
      `${KEY_VARIABLE}="quoted value" # a trailing comment`,
    ].join('\n'),
  )
  assert.equal(await readEvaluationKey({}, file), 'quoted value')
})

test('a commented-out line in the env file is not a key', async () => {
  const file = await envFile(`# ${KEY_VARIABLE}=commented-out\n`)
  assert.equal(await readEvaluationKey({}, file), null)
})

test('ANTHROPIC_API_KEY alone, in the environment or the file, gives no key', async () => {
  const file = await envFile('ANTHROPIC_API_KEY=sk-ant-api-production\n')
  assert.equal(await readEvaluationKey({ ANTHROPIC_API_KEY: 'sk-ant-api-local' }, file), null)
})

test('a blank key counts as unset, in the environment and in the file', async () => {
  const blankFile = await envFile(`${KEY_VARIABLE}="   "\n`)
  assert.equal(await readEvaluationKey({ [KEY_VARIABLE]: '   ' }, blankFile), null)
  assert.equal(await readEvaluationKey({}, blankFile), null)
})

test('a missing env file is no key, not an error', async () => {
  const missing = path.join(await scratchDir(), 'absent.env')
  assert.equal(await readEvaluationKey({}, missing), null)
})

test('reading the file leaves process.env untouched', async () => {
  const before = { ...process.env }
  const file = await envFile(`${KEY_VARIABLE}=${TEST_KEY}\nOTHER_VARIABLE=x\n`)
  assert.equal(await readEvaluationKey({}, file), TEST_KEY)
  assert.deepEqual({ ...process.env }, before)
})

test('redact removes every occurrence of the key', () => {
  const key = 'plain-key-without-prefix'
  assert.equal(redact(`first ${key} then ${key}.`, key), 'first [redacted] then [redacted].')
})

test('redact removes anything shaped like an Anthropic key, even with no key given', () => {
  assert.equal(
    redact('x-api-key: sk-ant-api03-AbC_d-9 was rejected', null),
    'x-api-key: [redacted] was rejected',
  )
})

/**
 * `.env.local` and `.env` side by side, as `pnpm env:pull` leaves them, in the order the runner
 * reads them. A file given as `undefined` is not written.
 */
async function envFilePair(local: string | undefined, env: string | undefined): Promise<string[]> {
  const dir = await scratchDir()
  const files = [path.join(dir, '.env.local'), path.join(dir, '.env')]
  for (const [file, text] of [
    [files[0], local],
    [files[1], env],
  ] as const) {
    if (text !== undefined) await writeFile(file as string, text, 'utf8')
  }
  return files
}

test('.env.local is read before .env', async () => {
  const files = await envFilePair(`${KEY_VARIABLE}=from-local\n`, `${KEY_VARIABLE}=from-env-file\n`)
  assert.equal(await readEvaluationKey({}, files), 'from-local')
})

test('a blank key in .env.local falls through to .env', async () => {
  const files = await envFilePair(`${KEY_VARIABLE}=   \n`, `${KEY_VARIABLE}=from-env-file\n`)
  assert.equal(await readEvaluationKey({}, files), 'from-env-file')
})

test('a .env.local without the key falls through to .env', async () => {
  const files = await envFilePair('OTHER_VARIABLE=x\n', `${KEY_VARIABLE}=from-env-file\n`)
  assert.equal(await readEvaluationKey({}, files), 'from-env-file')
})

test('a missing .env.local falls through to .env', async () => {
  const files = await envFilePair(undefined, `${KEY_VARIABLE}=from-env-file\n`)
  assert.equal(await readEvaluationKey({}, files), 'from-env-file')
})

test('the environment beats both files', async () => {
  const files = await envFilePair(`${KEY_VARIABLE}=from-local\n`, `${KEY_VARIABLE}=from-env-file\n`)
  assert.equal(await readEvaluationKey({ [KEY_VARIABLE]: 'from-env' }, files), 'from-env')
})

test('ANTHROPIC_API_KEY in either file, or the environment, is never read', async () => {
  const files = await envFilePair(
    'ANTHROPIC_API_KEY=sk-ant-api-local\n',
    'ANTHROPIC_API_KEY=sk-ant-api-env-file\n',
  )
  assert.equal(await readEvaluationKey({ ANTHROPIC_API_KEY: 'sk-ant-api-shell' }, files), null)
})

test('neither file present is no key, not an error', async () => {
  const files = await envFilePair(undefined, undefined)
  assert.equal(await readEvaluationKey({}, files), null)
})
