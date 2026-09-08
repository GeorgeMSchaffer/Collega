#!/bin/bash
# SessionStart hook - makes a Claude Code on the web container able to run this repo's gate
# (`pnpm check`) and its Playwright suite without a human first setting anything up.
#
# Five things the cloud container does not give us:
#   1. Node 24. The image ships v22; package.json requires >=24.20.0, so pnpm refuses to install.
#   2. Workspace dependencies. The repo is cloned fresh, with no node_modules.
#   3. A database. There is no `collega-postgres` container here - and there cannot be, because
#      the egress policy blocks Docker Hub's blob CDN, so `docker compose up postgres` cannot
#      pull an image. PostgreSQL 16 is installed natively instead, which needs no network at all.
#   4. A migrated schema, so Prisma work has something real to run against.
#   5. Demo data, so the schema is worth querying and the live-database test suite can run.
#
# Local machines already have all four, so this exits immediately off the web.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

REPO="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$REPO"

NODE_VERSION="$(tr -d '[:space:]' < .nvmrc)"
NVM_DIR="${NVM_DIR:-/opt/nvm}"
PGDATA=/var/lib/collega-pg
PGPORT=5432
PGUSER_ROLE=collega
PGDATABASE_NAME=Collega
PGBIN=/usr/lib/postgresql/16/bin
PW_CHROMIUM="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}/chromium"
# Two spellings of the same connection: Prisma wants `?schema=`, and psql rejects it as an
# unknown URI parameter.
PSQL_URL="postgresql://${PGUSER_ROLE}@127.0.0.1:${PGPORT}/${PGDATABASE_NAME}"
DB_URL="${PSQL_URL}?schema=public"

say() { printf '\n[session-start] %s\n' "$1"; }

# --- 1. Node 24 -------------------------------------------------------------------------------
# nvm is installed but carries no versions; the download is cached into the container image
# after this hook completes, so it is paid once per environment rather than once per session.
say "Node ${NODE_VERSION}"
NODE_BIN="${NVM_DIR}/versions/node/v${NODE_VERSION}/bin"
if [ ! -x "${NODE_BIN}/node" ]; then
  # nvm's functions return non-zero internally on paths that are not failures, and read unset
  # variables, so `set -eu` has to come off while it is sourced and run.
  set +eu
  # shellcheck disable=SC1091
  . "${NVM_DIR}/nvm.sh"
  nvm install "${NODE_VERSION}" >/dev/null
  set -eu
fi
# Straight onto PATH rather than `nvm use`, which reports success or failure too unreliably to
# branch on. If the binary is not there after an install, nothing below can work anyway.
export PATH="${NODE_BIN}:${PATH}"

# packageManager pins pnpm, so corepack provisions the exact version rather than whatever the
# image happened to have next to Node 22.
corepack enable pnpm
say "node $(node -v) / pnpm $(pnpm -v)"

# --- 2. Dependencies --------------------------------------------------------------------------
# `install`, not `--frozen-lockfile`: this is a development container, and install is the form
# that benefits from the layer cache when the lockfile has not moved.
say "pnpm install"
pnpm install

# --- 3. PostgreSQL 16, natively -----------------------------------------------------------------
# initdb refuses to run as root, so the cluster is owned by the `postgres` system user. `trust`
# auth is deliberate: the cluster listens on loopback inside a single-tenant disposable container,
# and a password here would only be a secret to store.
say "PostgreSQL"
if [ ! -s "${PGDATA}/PG_VERSION" ]; then
  mkdir -p "${PGDATA}"
  chown postgres:postgres "${PGDATA}"
  su postgres -c "${PGBIN}/initdb -D ${PGDATA} -U ${PGUSER_ROLE} --auth=trust" >/dev/null
fi

if ! su postgres -c "${PGBIN}/pg_ctl -D ${PGDATA} status" >/dev/null 2>&1; then
  su postgres -c "${PGBIN}/pg_ctl -D ${PGDATA} -o '-p ${PGPORT}' -l ${PGDATA}/server.log -w start" >/dev/null
fi

if ! psql "postgresql://${PGUSER_ROLE}@127.0.0.1:${PGPORT}/postgres" -tAc \
  "SELECT 1 FROM pg_database WHERE datname = '${PGDATABASE_NAME}'" | grep -q 1; then
  createdb -h 127.0.0.1 -p "${PGPORT}" -U "${PGUSER_ROLE}" "${PGDATABASE_NAME}"
fi
say "$(psql "${PSQL_URL}" -tAc 'SELECT version()' | cut -d, -f1)"

# --- 4. Schema ------------------------------------------------------------------------------------
# A fresh database, so the baseline migration lays down the schema as written - including the nine
# enum types. The in-place `prisma migrate resolve --applied` dance in the tracker is for the
# EF-migrated database on someone's machine, and does not apply to a cluster created seconds ago.
say "prisma migrate deploy"
DATABASE_URL="${DB_URL}" pnpm --filter @collega/infrastructure db:migrate

# --- 5. Demo data --------------------------------------------------------------------------------
# The seed imports the shared catalog constants from @collega/application, so that package and the
# domain it depends on have to be built first; turbo's `^build` gets the order right. Both are
# cached after the first run.
say "demo seed"
pnpm exec turbo run build --filter=@collega/application >/dev/null
DATABASE_URL="${DB_URL}" \
  SITE_ADMIN_EMAIL="${SITE_ADMIN_EMAIL:-admin@collega.local}" \
  SITE_ADMIN_PASSWORD="${SITE_ADMIN_PASSWORD:-Ch4ngeMe!Now}" \
  pnpm --filter @collega/infrastructure db:seed

# --- 6. Session environment -----------------------------------------------------------------------
# DATABASE_URL is exported, and also written to .env (gitignored, and what .env.example documents
# as its single home, since the Prisma CLI reads it from there).
#
# Exporting it is only safe because the step above seeds. `packages/infrastructure` guards a
# live-database suite with `skipIf(!DATABASE_URL)`, and its fixture throws unless the database holds
# an organizations row - so against a schema-only database, exporting this would un-skip that suite
# and turn `pnpm check` red. With the seed in place the suite runs and passes, which is better than
# skipping: it is the only test in the repo that touches a real database.
if [ ! -f .env ]; then
  cp .env.example .env
fi
if grep -q '^DATABASE_URL=' .env; then
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${DB_URL}|" .env
else
  printf '\n# Written by .claude/hooks/session-start.sh - the container-local cluster.\nDATABASE_URL=%s\n' "${DB_URL}" >> .env
fi

{
  echo "export NVM_DIR=\"${NVM_DIR}\""
  echo "export PATH=\"${NODE_BIN}:\$PATH\""
  echo "export DATABASE_URL=\"${DB_URL}\""
} >> "${CLAUDE_ENV_FILE}"

# --- 7. Playwright ------------------------------------------------------------------------------
# The image ships a Chromium and blocks `cdn.playwright.dev`, so `playwright install` cannot run
# and the build Playwright pins is not the build that is here. `e2e/playwright.config.ts` reads
# this and launches the one that is; turbo passes it through explicitly (strict env mode is the
# default in turbo 2, so an undeclared variable never reaches the test process).
if [ -x "${PW_CHROMIUM}" ]; then
  echo "export PLAYWRIGHT_CHROMIUM_PATH=\"${PW_CHROMIUM}\"" >> "${CLAUDE_ENV_FILE}"
  say "Chromium: ${PW_CHROMIUM}"
else
  say "no Chromium at ${PW_CHROMIUM} - pnpm test:e2e will not run"
fi

say "ready - pnpm check, and pnpm test:e2e for the browser suite"
