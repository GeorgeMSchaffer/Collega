// `pnpm dev`'s reading of `.env` (`env-file.ts`): quoted values unquoted, and the remote-database
// opt-in honoured from the file as well as the shell.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { allowsRemoteDatabase, parseEnvText } from './env-file.ts'

test('a double- or single-quoted value is read without its quotes', () => {
  const values = parseEnvText(
    [
      'DATABASE_URL="postgresql://collega:pw@127.0.0.1:5432/Collega"',
      "POSTGRES_PASSWORD='s3cret'",
    ].join('\n'),
  )
  assert.equal(values.get('DATABASE_URL'), 'postgresql://collega:pw@127.0.0.1:5432/Collega')
  assert.equal(values.get('POSTGRES_PASSWORD'), 's3cret')
})

test('an unquoted value, and one whose quotes do not match, is read as written', () => {
  const values = parseEnvText(['PLAIN=value', `MIXED="value'`, 'LONE="'].join('\n'))
  assert.equal(values.get('PLAIN'), 'value')
  assert.equal(values.get('MIXED'), `"value'`)
  assert.equal(values.get('LONE'), '"')
})

test('an empty pair of quotes is an empty value', () => {
  assert.equal(parseEnvText('EMPTY=""').get('EMPTY'), '')
})

test('the value keeps any = after the first, and the spaces around it are trimmed', () => {
  const values = parseEnvText('  DATABASE_URL = "postgresql://h/db?schema=a=b"  \r\n')
  assert.equal(values.get('DATABASE_URL'), 'postgresql://h/db?schema=a=b')
})

test('comments, blank lines and lines without a key are skipped', () => {
  const values = parseEnvText(
    ['# DATABASE_URL=commented', '', '   ', '=orphan', 'NOEQUALS'].join('\n'),
  )
  assert.deepEqual([...values], [])
})

test('the opt-in is honoured from .env when the shell does not set it', () => {
  assert.equal(allowsRemoteDatabase(undefined, '1'), true)
})

test('the opt-in is honoured from the shell alone', () => {
  assert.equal(allowsRemoteDatabase('1', undefined), true)
})

test("the shell's value wins over .env's, either way", () => {
  assert.equal(allowsRemoteDatabase('0', '1'), false)
  assert.equal(allowsRemoteDatabase('', '1'), false)
  assert.equal(allowsRemoteDatabase('1', '0'), true)
})

test('anything but 1 is no opt-in', () => {
  for (const value of [undefined, '', '0', 'true', 'yes', ' 1']) {
    assert.equal(allowsRemoteDatabase(undefined, value), false)
  }
})

test('a quoted opt-in in .env counts', () => {
  const values = parseEnvText('COLLEGA_ALLOW_REMOTE_DATABASE="1"')
  assert.equal(allowsRemoteDatabase(undefined, values.get('COLLEGA_ALLOW_REMOTE_DATABASE')), true)
})
