import { Dot, Marker } from '@collega/design-system'

/** A filled chip carrying a dot plus a short label — priority, status, category. */
export const WithDot = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Marker>
      <Dot color="var(--sky)" /> Reporting
    </Marker>
    <Marker>
      <Dot color="var(--teal)" /> Onboarding
    </Marker>
    <Marker>
      <Dot color="var(--orange)" /> Billing
    </Marker>
  </div>
)

export const Priority = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Marker>
      <Dot color="var(--destructive)" /> High priority
    </Marker>
    <Marker>
      <Dot color="var(--warning)" /> Medium priority
    </Marker>
    <Marker>
      <Dot color="var(--muted-foreground)" /> Low priority
    </Marker>
  </div>
)

/** No dot — Marker is just the filled chip. */
export const LabelOnly = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Marker>Sprint 14</Marker>
    <Marker>Q3 Intake</Marker>
  </div>
)
