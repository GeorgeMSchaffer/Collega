import { describe, expect, it } from 'vitest'
import { ConfigError, loadConfig } from '../src/common/config/index.js'

/**
 * A minimal environment that satisfies every required fragment. Individual tests override or
 * delete keys from a copy of this rather than repeating the full shape each time.
 *
 * Values are fabricated for the test only - never anything from the repository's real .env.
 */
function validEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const base: Record<string, string | undefined> = {
    SITE_ADMIN_EMAIL: 'admin@example.test',
    SITE_ADMIN_PASSWORD: 'correct-horse-battery-staple',
    POSTGRES_USER: 'test_user',
    POSTGRES_PASSWORD: 'test_password',
    // ANTHROPIC_API_KEY deliberately absent: the AI feature is unconfigured by default.
  }
  return { ...base, ...overrides }
}

describe('loadConfig - AI asymmetry', () => {
  it('succeeds with ai.isConfigured false when ANTHROPIC_API_KEY is absent', () => {
    const config = loadConfig(validEnv())
    expect(config.ai.isConfigured).toBe(false)
    expect(config.ai.anthropicApiKey).toBeUndefined()
  })

  it('succeeds with ai.isConfigured true when ANTHROPIC_API_KEY is present', () => {
    const config = loadConfig(validEnv({ ANTHROPIC_API_KEY: 'a-test-key' }))
    expect(config.ai.isConfigured).toBe(true)
    expect(config.ai.anthropicApiKey).toBe('a-test-key')
  })

  it('throws ConfigError naming SITE_ADMIN_EMAIL when it is absent', () => {
    const env = validEnv({ SITE_ADMIN_EMAIL: undefined })
    expect(() => loadConfig(env)).toThrow(ConfigError)
    expect(() => loadConfig(env)).toThrow(/SITE_ADMIN_EMAIL/)
  })

  it('throws ConfigError naming SITE_ADMIN_PASSWORD when it is absent', () => {
    const env = validEnv({ SITE_ADMIN_PASSWORD: undefined })
    expect(() => loadConfig(env)).toThrow(ConfigError)
    expect(() => loadConfig(env)).toThrow(/SITE_ADMIN_PASSWORD/)
  })

  it('the missing AI key and the missing Site Admin values are handled oppositely', () => {
    // Same environment shape, missing key from each fragment: one boots dark, the other refuses.
    const aiMissing = validEnv()
    expect(() => loadConfig(aiMissing)).not.toThrow()

    const siteAdminMissing = validEnv({ SITE_ADMIN_EMAIL: undefined })
    expect(() => loadConfig(siteAdminMissing)).toThrow(ConfigError)
  })
})

describe('loadConfig - reports every problem at once', () => {
  it('names all missing required variables in a single thrown message', () => {
    const env: NodeJS.ProcessEnv = {
      // SITE_ADMIN_EMAIL, SITE_ADMIN_PASSWORD, POSTGRES_USER, POSTGRES_PASSWORD all absent,
      // and no DATABASE_URL to short-circuit the database fragment.
    }

    let thrown: unknown
    try {
      loadConfig(env)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(ConfigError)
    const message = (thrown as ConfigError).message
    expect(message).toContain('SITE_ADMIN_EMAIL')
    expect(message).toContain('SITE_ADMIN_PASSWORD')
    expect(message).toContain('POSTGRES_USER')
    expect(message).toContain('POSTGRES_PASSWORD')
  })
})

describe('loadConfig - empty and whitespace-only values are treated as absent', () => {
  it('treats ANTHROPIC_API_KEY="" as absent, not as an empty credential', () => {
    const config = loadConfig(validEnv({ ANTHROPIC_API_KEY: '' }))
    expect(config.ai.isConfigured).toBe(false)
    expect(config.ai.anthropicApiKey).toBeUndefined()
  })

  it('treats a whitespace-only ANTHROPIC_API_KEY as absent', () => {
    const config = loadConfig(validEnv({ ANTHROPIC_API_KEY: '   ' }))
    expect(config.ai.isConfigured).toBe(false)
    expect(config.ai.anthropicApiKey).toBeUndefined()
  })

  it('rejects an empty SITE_ADMIN_EMAIL the same way as a missing one', () => {
    const env = validEnv({ SITE_ADMIN_EMAIL: '' })
    expect(() => loadConfig(env)).toThrow(/SITE_ADMIN_EMAIL/)
  })

  it('rejects a whitespace-only SITE_ADMIN_EMAIL the same way as a missing one', () => {
    const env = validEnv({ SITE_ADMIN_EMAIL: '   ' })
    expect(() => loadConfig(env)).toThrow(/SITE_ADMIN_EMAIL/)
  })
})

describe('loadConfig - database URL composition', () => {
  it('uses DATABASE_URL verbatim when present, ignoring the POSTGRES_* parts', () => {
    const config = loadConfig(
      validEnv({
        DATABASE_URL: 'postgresql://someone:secret@remote-host:6543/OtherDb?schema=public',
        POSTGRES_USER: undefined,
        POSTGRES_PASSWORD: undefined,
      }),
    )
    expect(config.database.url).toBe(
      'postgresql://someone:secret@remote-host:6543/OtherDb?schema=public',
    )
  })

  it('composes a default URL from parts using 127.0.0.1, port 5432 and database Collega', () => {
    const config = loadConfig(validEnv())
    const parsed = new URL(config.database.url)

    expect(parsed.hostname).toBe('127.0.0.1')
    expect(parsed.port).toBe('5432')
    expect(parsed.pathname).toBe('/Collega')
  })

  it('honours POSTGRES_HOST, POSTGRES_HOST_PORT and POSTGRES_DB when given', () => {
    const config = loadConfig(
      validEnv({
        POSTGRES_HOST: 'db.internal',
        POSTGRES_HOST_PORT: '5433',
        POSTGRES_DB: 'CustomDb',
      }),
    )
    const parsed = new URL(config.database.url)

    expect(parsed.hostname).toBe('db.internal')
    expect(parsed.port).toBe('5433')
    expect(parsed.pathname).toBe('/CustomDb')
  })

  it('percent-encodes a password containing URL-significant characters', () => {
    // @, :, /, # and a space each have meaning in a URL; none of them may appear literally.
    const password = 'p@ss:w/ord#1 two'
    const config = loadConfig(validEnv({ POSTGRES_PASSWORD: password }))

    // The raw password must not appear unescaped in the composed string.
    expect(config.database.url).not.toContain(password)

    // And the encoded form must still parse back to the exact original password.
    const parsed = new URL(config.database.url)
    expect(decodeURIComponent(parsed.password)).toBe(password)
    expect(parsed.hostname).toBe('127.0.0.1')
    expect(parsed.pathname).toBe('/Collega')
  })
})

describe('loadConfig - reads the given environment, not the process one', () => {
  it('reflects values passed explicitly rather than ambient process.env', () => {
    const env = validEnv({
      SITE_ADMIN_EMAIL: 'distinct@example.test',
      ANTHROPIC_API_KEY: 'distinct-key',
    })

    const config = loadConfig(env)

    expect(config.siteAdmin.email).toBe('distinct@example.test')
    expect(config.ai.anthropicApiKey).toBe('distinct-key')
  })

  it('two calls with different explicit environments do not influence each other', () => {
    const first = loadConfig(validEnv({ SITE_ADMIN_EMAIL: 'first@example.test' }))
    const second = loadConfig(validEnv({ SITE_ADMIN_EMAIL: 'second@example.test' }))

    expect(first.siteAdmin.email).toBe('first@example.test')
    expect(second.siteAdmin.email).toBe('second@example.test')
  })
})
