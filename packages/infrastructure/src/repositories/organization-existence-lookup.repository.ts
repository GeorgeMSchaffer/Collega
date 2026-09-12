// Satisfies `OrganizationExistenceLookup`, declared identically in six feature ports
// (boards, business-impacts, fields, idea-fields, statuses, users): TypeScript is structural, so
// one adapter satisfies all six rather than six near-identical classes.

import type { OrganizationExistenceLookup as BoardsOrganizationExistenceLookup } from '@collega/application/boards'
import type { OrganizationExistenceLookup as BusinessImpactsOrganizationExistenceLookup } from '@collega/application/business-impacts'
import type { OrganizationExistenceLookup as FieldsOrganizationExistenceLookup } from '@collega/application/fields'
import type { OrganizationExistenceLookup as IdeaFieldsOrganizationExistenceLookup } from '@collega/application/idea-fields'
import type { OrganizationExistenceLookup as StatusesOrganizationExistenceLookup } from '@collega/application/statuses'
import type { OrganizationExistenceLookup as UsersOrganizationExistenceLookup } from '@collega/application/users'
import type { PrismaClient } from '../persistence/prisma-client.js'

export class OrganizationExistenceLookupRepository
  implements
    BoardsOrganizationExistenceLookup,
    BusinessImpactsOrganizationExistenceLookup,
    FieldsOrganizationExistenceLookup,
    IdeaFieldsOrganizationExistenceLookup,
    StatusesOrganizationExistenceLookup,
    UsersOrganizationExistenceLookup
{
  constructor(private readonly prisma: PrismaClient) {}

  async existsById(organizationId: string): Promise<boolean> {
    const found = await this.prisma.organizations.findUnique({
      where: { id: organizationId },
      select: { id: true },
    })
    return found !== null
  }
}
