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
