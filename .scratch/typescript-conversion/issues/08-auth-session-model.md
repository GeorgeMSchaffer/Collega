# 08 — Auth and session model across Next + Nest

Type: grilling
Status: open
Blocked by: 07

## Question

Blazor WASM holds a JWT and sends it as a bearer token. Next.js has a server side, which opens options Blazor never had. Where does the session live?

## Options — select one

- [ ] **A — Bearer token held client-side.** Closest to today, smallest conceptual change. The token is exposed to client JS.
- [ ] **B — httpOnly session cookie terminated at Next**, Nest trusts a forwarded identity. Better security posture; introduces a trust relationship between the two apps that must be got right.
- [ ] **C — Nest issues cookies directly**, Next stays a pure client. Simple trust model, but constrains cross-origin setup — interacts with `02`'s answer.

No recommendation until `07` reports. Impersonation is a **server-side session where the token is never reissued**, so the effective role rides on something other than the token — and whichever option wins has to carry that correctly. That dependency is the whole reason this ticket is blocked rather than parallel.

## Also in scope

All currently working, all easy to drop on the floor during a rewrite:

- [ ] First-login forced password change (`ChangePassword.razor`)
- [ ] Session timeout (`SessionTimeoutGuard.razor`)
- [ ] Fixed-window lockout and the admin-issued temporary-reset flow
- [ ] Email as a **globally unique** identifier system-wide, not per-organization
- [ ] The JWT signing key, currently ephemeral pending Sprint 8

## Blocked by `07`

`07` determines how ambient identity works in Nest and Next. Answer it first.
