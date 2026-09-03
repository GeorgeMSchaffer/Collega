// Where the harness gets its base URL and its four logins.
//
// Credentials come from the environment, never from a committed file. The demo
// seed's passwords are already documented in the tracker, but a corpus that
// carries logins is a corpus nobody can safely point at a real deployment.

import { ROLES, type Role } from "./inventory.ts";
import type { RoleCredentials } from "./runner.ts";

export const DEFAULT_BASE_URL = "http://localhost:5000";
export const DEFAULT_BASE_PATH = "/api/v1";

/**
 * Demo-seed accounts, as `StartupSeeder` actually creates them: the three
 * organization roles are slug-scoped, and Acme Robotics is the organization the
 * corpus works in. The convenience Site Admin belongs to no organization.
 */
const DEMO_ORG_SLUG = "acme-robotics";
const DEMO_EMAILS: Record<Role, string> = {
  SiteAdmin: "siteadmin@demo.collega.test",
  OrgAdmin: `orgadmin@${DEMO_ORG_SLUG}.demo.collega.test`,
  User: `user@${DEMO_ORG_SLUG}.demo.collega.test`,
  ReadOnly: `readonly@${DEMO_ORG_SLUG}.demo.collega.test`,
};

function envKey(role: Role, field: "EMAIL" | "PASSWORD"): string {
  return `GOLDEN_${role.toUpperCase()}_${field}`;
}

export function readCredentials(env: NodeJS.ProcessEnv = process.env): Record<Role, RoleCredentials> {
  const shared = env.GOLDEN_PASSWORD;
  const out = {} as Record<Role, RoleCredentials>;
  const missing: string[] = [];

  for (const role of ROLES) {
    const email = env[envKey(role, "EMAIL")] ?? DEMO_EMAILS[role];
    const password = env[envKey(role, "PASSWORD")] ?? shared;
    if (!password) missing.push(envKey(role, "PASSWORD"));
    out[role] = { email, password: password ?? "" };
  }

  if (missing.length > 0) {
    throw new Error(
      `no password for ${missing.length} role(s). Set GOLDEN_PASSWORD for all four, ` +
        `or ${missing.join(", ")} individually. Emails default to the demo seed and ` +
        `override with GOLDEN_<ROLE>_EMAIL.`,
    );
  }
  return out;
}
