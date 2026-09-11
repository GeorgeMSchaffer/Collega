// The domain enums are hand-mirrored from packages/infrastructure/prisma/schema.prisma
// (packages/domain imports nothing - that is the layer rule biome.json enforces, so it
// cannot re-export the generated Prisma client's enums). Drift between the two copies is
// exactly the kind of thing nothing else would catch: TypeScript compiles either way, and
// nothing at runtime compares them.
//
// This parses the schema's `enum` blocks directly rather than trusting a remembered list, so
// an enum added to the schema without a domain counterpart - or a member renamed on one
// side only - fails here first.
//
// Nine of these came from the .NET domain at S0.2; five (IdeaPhase, EffortLevel,
// DeliveryStatus, SprintState, IssueTaskState) were added by Issues-and-Delivery Slice 1
// under the schema amendment recorded in SPEC/decisions.md 2026-09-11.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as Enums from '../src/enums/index.js'

const SCHEMA_PATH = resolve(
  fileURLToPath(import.meta.url),
  '../../../infrastructure/prisma/schema.prisma',
)

/** Enum name -> its member names, in declaration order, parsed out of `enum Name { ... }`. */
function parsePrismaEnums(source: string): Record<string, string[]> {
  const enums: Record<string, string[]> = {}
  for (const match of source.matchAll(/enum\s+(\w+)\s*\{([^}]*)\}/g)) {
    const [, name, body] = match
    if (name === undefined || body === undefined) {
      // The pattern has exactly two capturing groups, so a match missing either one means
      // the regex was edited without updating this destructure - fail loudly rather than
      // silently dropping an enum out of the comparison.
      throw new Error(`enum regex matched without both capture groups: ${match[0]}`)
    }
    enums[name] = body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('//'))
      .map((line) => {
        const [memberName] = line.split(/\s+/)
        if (memberName === undefined) {
          // Unreachable for a non-empty trimmed line - split always yields at least one
          // element - but asserted rather than assumed under noUncheckedIndexedAccess.
          throw new Error(`could not parse a member name out of line: ${JSON.stringify(line)}`)
        }
        return memberName
      })
  }
  return enums
}

const prismaEnums = parsePrismaEnums(readFileSync(SCHEMA_PATH, 'utf8'))

/** Export name in packages/domain/src/enums/index.ts -> the TS enum object. */
const DOMAIN_ENUMS: Record<string, Record<string, string>> = {
  Role: Enums.Role,
  UserStatus: Enums.UserStatus,
  Priority: Enums.Priority,
  FieldType: Enums.FieldType,
  IdeaTypeFieldMode: Enums.IdeaTypeFieldMode,
  ImpersonationEndReason: Enums.ImpersonationEndReason,
  NotificationEventType: Enums.NotificationEventType,
  AiCallOutcome: Enums.AiCallOutcome,
  AiKeySource: Enums.AiKeySource,
  IdeaPhase: Enums.IdeaPhase,
  EffortLevel: Enums.EffortLevel,
  DeliveryStatus: Enums.DeliveryStatus,
  SprintState: Enums.SprintState,
  IssueTaskState: Enums.IssueTaskState,
}

describe('domain enums vs packages/infrastructure/prisma/schema.prisma', () => {
  it('the schema parser actually found enums, so a regex miss cannot masquerade as a pass', () => {
    expect(Object.keys(prismaEnums).length).toBeGreaterThan(0)
  })

  it('the schema has exactly the enums the domain package hand-mirrors - no more, no fewer', () => {
    expect(Object.keys(prismaEnums).sort()).toEqual(Object.keys(DOMAIN_ENUMS).sort())
  })

  for (const [name, domainEnum] of Object.entries(DOMAIN_ENUMS)) {
    it(`${name} has exactly the schema's members, in the schema's declared order`, () => {
      const schemaMembers = prismaEnums[name]
      expect(schemaMembers, `schema.prisma has no enum named ${name}`).toBeDefined()

      // A TS string enum's keys enumerate in declaration order with no numeric reverse
      // mapping to confuse Object.keys, so this compares member NAMES directly.
      expect(Object.keys(domainEnum)).toEqual(schemaMembers)
    })

    it(`${name}'s members have string values equal to their own name`, () => {
      // Guards a different drift: a member present under the right name but assigned the
      // wrong string value (e.g. a typo, or copy-paste from a neighbouring enum) would pass
      // the key-order check above and still persist the wrong value to the database.
      for (const member of Object.keys(domainEnum)) {
        expect(domainEnum[member]).toBe(member)
      }
    })
  }
})
