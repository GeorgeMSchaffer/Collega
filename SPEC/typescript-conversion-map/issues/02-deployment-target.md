# 02 — Does the deployment target change?

> **Answered 2026-09-03; see `SPEC/decisions.md`.** Vercel for both apps, Prisma Postgres in
> production. The consequence to design against: Nest runs as serverless functions, so no
> long-lived in-process state — AI idea assist's budget gate and usage counters must be
> storage-backed, and its long turns are where cold starts and function limits bite first.
> Sprint 8's Azure deployment of the .NET stack is unaffected and does not bind this.
> This file is kept as written.

Type: grilling
Status: answered 2026-09-03 in `SPEC/decisions.md` (Vercel + Prisma Postgres)
Blocked by: —

## Question

Sprint 8 puts the .NET stack on Azure. Where does the TypeScript stack run?

## Options — select one

- [ ] **A — Vercel for web, Azure Container Apps for Nest.** Postgres stays where Sprint 8 put it. Choose this if "ecosystem" meant Vercel specifically.
- [ ] **B — All Azure.** Both apps as containers. Minimal ops change, and Sprint 8's work largely carries forward. Choose this if "ecosystem" meant the npm/TypeScript world generally.
- [ ] **C — All Vercel.** Nest as functions, which it fits poorly. Listed for completeness.

No recommendation on this one — it depends on what you meant by "ecosystem" in the charting conversation, and only you know that.

## Why it matters

This decides **whether Sprint 8's Azure work is reusable or written off**, which is a real line item in the estimate. It also gates the CI/CD pipeline fog on the map, and constrains `08` (a cookie-based session model is harder across two origins on different providers).

Asked during charting, not answered.
