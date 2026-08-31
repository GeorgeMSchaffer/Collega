# 02 — Does the deployment target change?

Type: grilling
Status: open
Blocked by: —

## Question

Sprint 8 puts the .NET stack on Azure. Next.js + Nest opens other doors, and the charting motive included "ecosystem" — which may or may not have meant Vercel specifically.

- **(a) Vercel for web, Azure Container Apps for Nest**, Postgres stays where Sprint 8 put it.
- **(b) All Azure** — both apps as containers. Minimal ops change; Sprint 8's work largely carries forward.
- **(c) All Vercel** — Nest as functions, which it fits poorly.

This is not a preference question: it determines **whether Sprint 8's Azure work is reusable or written off**, and that is a line item in the estimate. It also gates the CI/CD fog on the map.

Asked during charting, not answered.
