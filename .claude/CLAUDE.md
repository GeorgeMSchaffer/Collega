# Collega
- **App:** idea/issue management with boards, delivery tracking and AI-assisted idea authoring.
- **Stack:** TypeScript monorepo (pnpm + Turborepo), Next.js web, Nest.js API (serverless), Prisma on PostgreSQL 16, Vercel. Details: root `AGENTS.md`.
- **Users:** organization members, Org Admins and Site Admins (roles enforced in `packages/application`).
- **Storage:** PostgreSQL via Prisma (`packages/infrastructure/prisma`); local in Docker, Prisma Postgres in production. The seed rebuilds it.
- **Constraints:** `SPEC/*.md` is canonical; ask before contradicting it. `pnpm check` is the gate. No AI/agent references in commit messages.

# AI strategy
Use Haiku for simple tasks; Sonnet for main dev; Opus for complex arch or if Sonnet fails 2x.
Keep context low: Grep before Read, targeted reads only.

# Rules
Concise responses. No overengineering. No unrequested extras.
