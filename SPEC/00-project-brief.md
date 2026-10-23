# Project Brief: Collega

## Purpose
Collega is a collaboration and project management tool for submitting, tracking, and improving process ideas.

## Product Model
The product is conceptually similar to Trello/Jira:
- Data is scoped to organizations.
- Organizations contain users, boards, statuses, and ideas.
- Boards organize ideas by workflow status using swimlanes.

## Technology Stack
- Next.js (App Router) + Tailwind CSS v4 + shadcn/ui
- Nest.js, running serverless
- Prisma
- PostgreSQL 16
- TypeScript on Node.js 24.x; pnpm workspaces + Turborepo

## Solution Structure
- `apps/api` — Nest.js HTTP host; the only thing that talks to the database
- `apps/web` — Next.js client; reaches the server over HTTP only
- `packages/application` — business logic and use-case orchestration
- `packages/domain` — entities, enums, value objects, shared contracts
- `packages/infrastructure` — Prisma persistence and external integrations
- `packages/design-system` — comp P tokens and primitives

## Architecture Rules
- API depends on Application.
- Application depends on Domain.
- Infrastructure implements abstractions from Application/Domain.
- Domain must not depend on API, Client, or Infrastructure.
- Business rules must not live in controllers or UI components.

## Dependency Policy
- Do not add new packages without approval.

## Coding Standards
- Follow the Coding Standards in the root `AGENTS.md`.