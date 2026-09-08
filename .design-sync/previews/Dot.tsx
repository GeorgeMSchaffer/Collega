import { Dot } from '@collega/design-system'

/** `color` takes a CSS colour or a palette token — the category colours come from comp Q. */
export const PaletteTokens = () => (
  <div className="flex flex-col gap-2 text-sm">
    <span className="flex items-center gap-2">
      <Dot color="var(--sky)" /> Reporting
    </span>
    <span className="flex items-center gap-2">
      <Dot color="var(--teal)" /> Onboarding
    </span>
    <span className="flex items-center gap-2">
      <Dot color="var(--green)" /> Integrations
    </span>
    <span className="flex items-center gap-2">
      <Dot color="var(--orange)" /> Billing
    </span>
    <span className="flex items-center gap-2">
      <Dot color="var(--purple)" /> Access
    </span>
  </div>
)

/** With no `color` the dot falls back to muted — what a missing category lookup renders as. */
export const Fallback = () => (
  <span className="flex items-center gap-2 text-sm">
    <Dot /> Uncategorised
  </span>
)
