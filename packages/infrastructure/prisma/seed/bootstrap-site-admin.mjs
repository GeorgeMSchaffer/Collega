// Creates the configured Site Admin during deployment. This uses JavaScript intentionally: Node's
// TypeScript executor is not part of the production bootstrap path.

import { createHash, pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto'
import { normalizeEmail } from '@collega/domain/users'
import { PrismaClient } from '../../dist/generated/prisma/client.js'

const PREFIX = 'PBKDF2'
const SALT_SIZE_BYTES = 16
const HASH_SIZE_BYTES = 32
const ITERATIONS = 100_000
const DIGEST = 'sha256'
const NAMESPACE = 'collega.demo.seed.v1'

function seedId(...parts) {
  const digest = createHash('sha1')
    .update(`${NAMESPACE}:${parts.join(':')}`)
    .digest()
  const bytes = Buffer.from(digest.subarray(0, 16))
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x50, 6)
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8)
  const hex = bytes.toString('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

function hash(password) {
  const salt = randomBytes(SALT_SIZE_BYTES)
  const passwordHash = pbkdf2Sync(password, salt, ITERATIONS, HASH_SIZE_BYTES, DIGEST)
  return [PREFIX, ITERATIONS, salt.toString('base64'), passwordHash.toString('base64')].join('.')
}

function isUniqueViolation(error) {
  return typeof error === 'object' && error !== null && error.code === 'P2002'
}

function report(email, account) {
  if (account.role === 'SiteAdmin' && account.status === 'Active') {
    console.log(`${email} already exists (Active SiteAdmin) - left untouched, including its password.`)
    return
  }

  throw new Error(
    `SITE_ADMIN_EMAIL is ${email}, but that address belongs to an account with role ${account.role} ` +
      `and status ${account.status} - not an active Site Admin. It has been left untouched.`,
  )
}

async function main() {
  const email = process.env.SITE_ADMIN_EMAIL?.trim()
  const password = process.env.SITE_ADMIN_PASSWORD?.trim()

  if (!email || !password) {
    console.log('SITE_ADMIN_EMAIL/SITE_ADMIN_PASSWORD unset - no Site Admin to create.')
    return
  }

  const normalized = normalizeEmail(email)
  const prisma = new PrismaClient()
  try {
    const existing = await prisma.users.findUnique({
      where: { normalized_email: normalized },
      select: { role: true, status: true },
    })
    if (existing) return report(email, existing)

    try {
      const now = new Date()
      await prisma.users.create({
        data: {
          id: seedId('user', 'configured-site-admin', normalized),
          organization_id: null,
          first_name: 'Site',
          last_name: 'Administrator',
          email,
          normalized_email: normalized,
          password_hash: hash(password),
          role: 'SiteAdmin',
          status: 'Active',
          must_change_password: true,
          failed_login_count: 0,
          security_stamp: randomUUID(),
          created_at_utc: now,
          updated_at_utc: now,
        },
      })
      console.log(`created Site Admin ${email} - it must change this password on first login.`)
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      report(
        email,
        await prisma.users.findUniqueOrThrow({
          where: { normalized_email: normalized },
          select: { role: true, status: true },
        }),
      )
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
