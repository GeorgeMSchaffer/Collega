/**
 * The auth route group exists to opt *out* of the desk shell. Sign in, register and the
 * forced first-login change carry no sidebar, no breadcrumb and no command palette
 * (`SPEC/20-feature-client-ui.md`); the forced change deliberately has no navigation escape
 * at all, because while `MustChangePassword` is set the API refuses everything but that
 * change and `GET /auth/me` — a rail here would be a rail of dead ends.
 *
 * So there is nothing for this layout to add. It exists so the group has one, and so the
 * absence is a decision on the record rather than an omission.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
