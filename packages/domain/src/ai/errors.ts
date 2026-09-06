// Domain-level invariant violations for AiPromptVersion and AiUsageRecord. packages/domain
// imports nothing, so this cannot be the kernel's ValidationError (that lives in
// packages/application/common) - the Application layer catches this and re-throws it as one,
// keyed on `field`, mirroring IdeaDomainError/OrganizationDomainError (see SPEC/decisions.md
// 2026-09-06 "Wave B conventions").
export class AiDomainError extends Error {
  readonly field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'AiDomainError'
    this.field = field
  }
}
