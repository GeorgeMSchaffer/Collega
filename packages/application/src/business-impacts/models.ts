// Wire-facing read models and commands for Business Impact administration
// (SPEC/30-Contracts.md "Idea Field Option Contracts").

export type BusinessImpactItem = {
  readonly businessImpactId: string
  readonly organizationId: string
  readonly name: string
  readonly color: string
  readonly sortOrder: number
  readonly isDeleted: boolean
}

export type CreateBusinessImpactCommand = {
  readonly name: string
  readonly color: string
  readonly sortOrder: number | null
}

export type UpdateBusinessImpactCommand = {
  readonly name: string
  readonly color: string
  readonly sortOrder: number | null
}
