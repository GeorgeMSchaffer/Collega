# 08 — Auth and session model across Next + Nest

Type: grilling
Status: open
Blocked by: 07

## Question

Today: Blazor WASM holds a JWT and calls the API as a bearer token. The JWT signing key is ephemeral until Sprint 8 addresses it, and lockout is fixed-window (a judgment call settled for MVP).

Next.js changes the shape of the question, because a Next app has a server side that Blazor WASM never had:

- **(a) Bearer token held client-side** — closest to today, smallest conceptual change, but the token is exposed to client JS.
- **(b) httpOnly session cookie terminated at Next**, with Nest trusting a forwarded identity. Better security posture; introduces a trust relationship between the two apps that has to be got right.
- **(c) Nest issues cookies directly**, Next stays a pure client. Simple trust model, but constrains cross-origin and deployment topology — interacts with `02`.

Interacts hard with `07`: impersonation is a **server-side session where the token is never reissued**, so the effective role rides on something other than the token. Wherever the session lives, View As has to live compatibly. That dependency is why this is blocked rather than parallel.

Also in scope, all currently working and easy to drop on the floor during a rewrite:

- First-login forced password change (`ChangePassword.razor`)
- Session timeout (`SessionTimeoutGuard.razor`)
- Fixed-window lockout and the temporary-reset flow
- Email as a **globally unique** identifier system-wide, not per-org
