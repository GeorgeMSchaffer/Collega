// Satisfies `OrganizationBootstrapPort` (organizations/ports.ts). Deferred in the first pass of
// this slice on the theory that composing it needed ports outside this slice's globs - wrong,
// once C1 landed its own Boards/Statuses/IdeaTypes/BusinessImpacts repositories, there was nothing
// left to wait on. This is pure orchestration: `organization-defaults.ts` (Application) already
// owns the policy of what the defaults ARE, and `createStatus`/`createBoard`/`createIdeaType`/
// `createBusinessImpact` (Domain) already own their construction invariants. This class only
// wires the two together and stages the writes - exactly mirroring the .NET
// `OrganizationBootstrapService`, which does the same four `AddRangeAsync`/`AddAsync` calls with
// no commit of its own (the caller's `SaveChangesAsync` covers it).
//
// Every write below is enqueued, never awaited-and-committed here - `OrganizationService.create`
// calls `organizations.add(organization)` before this runs and `unitOfWork.saveChanges()` once
// after, so the organization row and every default row land in the same transaction. This is safe
// under the command-buffer design specifically because nothing here READS anything: Postgres
// still sees earlier statements in the same transaction when later ones run (ordinary
// per-statement transactional visibility), which is a different question from whether the
// APPLICATION layer can read back a staged-but-uncommitted row through a fresh Prisma query - it
// cannot, and nothing here tries to.

import { randomUUID } from 'node:crypto'
import type {
  OrganizationBootstrapPort,
  OrganizationBootstrapResult,
} from '@collega/application/organizations'
import {
  DEFAULT_BOARD_NAME,
  DEFAULT_BUSINESS_IMPACTS,
  DEFAULT_IDEA_TYPES,
  DEFAULT_STATUSES,
} from '@collega/application/organizations'
import { createBoard } from '@collega/domain/boards'
import { createBusinessImpact } from '@collega/domain/business-impacts'
import { createIdeaType } from '@collega/domain/idea-fields'
import { createStatus } from '@collega/domain/statuses'
import type { PrismaBoardRepository } from './board.repository.js'
import type { PrismaBusinessImpactRepository } from './business-impact.repository.js'
import type { PrismaIdeaTypeRepository } from './idea-type.repository.js'
import type { PrismaStatusRepository } from './status.repository.js'

export class OrganizationBootstrapRepository implements OrganizationBootstrapPort {
  constructor(
    private readonly statuses: PrismaStatusRepository,
    private readonly boards: PrismaBoardRepository,
    private readonly ideaTypes: PrismaIdeaTypeRepository,
    private readonly businessImpacts: PrismaBusinessImpactRepository,
  ) {}

  async provisionDefaults(
    organizationId: string,
    nowUtc: Date,
    actorUserId: string | null,
  ): Promise<OrganizationBootstrapResult> {
    const statuses = DEFAULT_STATUSES.map((s) =>
      createStatus({
        id: randomUUID(),
        organizationId,
        name: s.name,
        color: s.color,
        sortOrder: s.sortOrder,
        nowUtc,
        actorUserId,
      }),
    )
    await this.statuses.addMany(statuses)

    // The default board opens with every default status as a swimlane, in catalog order -
    // mirrors the .NET `OrganizationBootstrapService`.
    const board = createBoard({
      id: randomUUID(),
      organizationId,
      name: DEFAULT_BOARD_NAME,
      allowUserStatusUpdate: true,
      orderedStatusIds: statuses.map((s) => s.id),
      nowUtc,
      actorUserId,
    })
    await this.boards.add(board)

    const ideaTypes = DEFAULT_IDEA_TYPES.map((t) =>
      createIdeaType({
        id: randomUUID(),
        organizationId,
        name: t.name,
        sortOrder: t.sortOrder,
        nowUtc,
        actorUserId,
      }),
    )
    await this.ideaTypes.addMany(ideaTypes)

    const businessImpacts = DEFAULT_BUSINESS_IMPACTS.map((b) =>
      createBusinessImpact({
        id: randomUUID(),
        organizationId,
        name: b.name,
        color: b.color,
        sortOrder: b.sortOrder,
        nowUtc,
        actorUserId,
      }),
    )
    await this.businessImpacts.addMany(businessImpacts)

    return { defaultBoardId: board.id, defaultStatusCount: statuses.length }
  }
}
