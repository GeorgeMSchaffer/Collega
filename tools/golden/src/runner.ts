// The execution engine, shared by capture and replay.
//
// Capture and replay must drive the API identically, or a diff reports the
// harness rather than the stack. So there is one runner: capture writes what it
// saw, replay compares what it saw against what was written.

import {
  interpolate,
  pluck,
  type Scenario,
  type Step,
} from "./scenarios.ts";
import type { Endpoint, Role } from "./inventory.ts";

export type RoleCredentials = { email: string; password: string };

/** Fixed, so two captures of the same upload produce identical bytes. */
const MULTIPART_BOUNDARY = "----GoldenCaptureBoundary";

export type RunnerConfig = {
  baseUrl: string;
  /** Route prefix the stack serves under. .NET mounts every controller under /api/v1. */
  basePath: string;
  credentials: Record<Role, RoleCredentials>;
  /** Fail a step rather than continue once the sequence has diverged. */
  stopOnError: boolean;
};

export type Exchange = {
  scenario: string;
  step: string;
  endpoint: string;
  as: Step["as"];
  kind: Step["kind"];
  note?: string;
  unstable: string[];
  request: {
    method: string;
    /** Path with variables resolved, base path included. */
    path: string;
    body: unknown;
    contentType?: string;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: unknown;
  };
};

export type StepFailure = { scenario: string; step: string; reason: string };

export type RunResult = {
  exchanges: Exchange[];
  failures: StepFailure[];
  /** Steps still carrying the scaffold's todo flag. */
  skipped: { scenario: string; step: string }[];
  /**
   * Steps where the API disagreed with the author's `expect`. The API is the
   * oracle, so the exchange is still recorded — but a corpus full of surprises
   * is a corpus whose author did not know what they were pinning.
   */
  surprises: { scenario: string; step: string; expected: number; actual: number }[];
};

/** Anything the runner sends over the wire goes through here, so tests can stub it. */
export type Fetcher = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ status: number; headers: Record<string, string>; text: string }>;

export const nodeFetcher: Fetcher = async (url, init) => {
  const response = await fetch(url, init);
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    headers[name.toLowerCase()] = value;
  });
  return { status: response.status, headers, text: await response.text() };
};

function parseBody(text: string, contentType: string | undefined): unknown {
  if (text === "") return null;
  if (contentType?.includes("json")) {
    try {
      return JSON.parse(text);
    } catch {
      // A malformed JSON body is itself a finding; keep it verbatim rather than throwing.
      return { "<unparsed>": text };
    }
  }
  return text;
}

export class Runner {
  #config: RunnerConfig;
  #fetch: Fetcher;
  #tokens = new Map<string, string>();

  constructor(config: RunnerConfig, fetcher: Fetcher = nodeFetcher) {
    this.#config = config;
    this.#fetch = fetcher;
  }

  /** Log a role in once per run and hold its token. Login itself is also a captured step. */
  async tokenFor(role: Role, override?: RoleCredentials): Promise<string> {
    const key = override ? `override:${override.email}` : role;
    const held = this.#tokens.get(key);
    if (held !== undefined) return held;

    const credentials = override ?? this.#config.credentials[role];
    if (!credentials) throw new Error(`no credentials configured for role ${role}`);
    const { status, headers, text } = await this.#fetch(this.#url("/auth/login"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(credentials),
    });
    if (status !== 200) {
      throw new Error(`login as ${role} (${credentials.email}) returned ${status}: ${text}`);
    }
    const body = parseBody(text, headers["content-type"]) as { accessToken?: string } | null;
    const token = body?.accessToken;
    if (typeof token !== "string" || token === "") {
      throw new Error(`login as ${role} returned no accessToken`);
    }
    this.#tokens.set(key, token);
    return token;
  }

  /** Forget held tokens — used between scenarios that end a View As session. */
  resetSessions() {
    this.#tokens.clear();
  }

  /** A read outside the corpus, for the seed fingerprint. Never recorded. */
  async get(routePath: string, role: Role): Promise<unknown> {
    const { status, headers, text } = await this.#fetch(this.#url(routePath), {
      method: "GET",
      headers: { accept: "application/json", authorization: `Bearer ${await this.tokenFor(role)}` },
    });
    return status === 200 ? parseBody(text, headers["content-type"]) : null;
  }

  #url(routePath: string, query?: Record<string, string>): string {
    const base = this.#config.baseUrl.replace(/\/$/, "");
    const prefix = this.#config.basePath.replace(/\/$/, "");
    const suffix = routePath.startsWith("/") ? routePath : `/${routePath}`;
    const url = new URL(`${base}${prefix}${suffix}`);
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
    return url.toString();
  }

  async runScenario(
    scenario: Scenario,
    endpoints: Map<string, Endpoint>,
  ): Promise<RunResult> {
    // Logins are seeded as variables so a committed scenario can exercise
    // POST /auth/login without carrying a password.
    const vars = new Map<string, unknown>();
    for (const [role, credential] of Object.entries(this.#config.credentials)) {
      const prefix = role[0].toLowerCase() + role.slice(1);
      vars.set(`${prefix}Email`, credential.email);
      vars.set(`${prefix}Password`, credential.password);
    }
    for (const [name, value] of Object.entries(scenario.bind ?? {})) vars.set(name, value);
    const exchanges: Exchange[] = [];
    const failures: StepFailure[] = [];
    const skipped: { scenario: string; step: string }[] = [];
    const surprises: RunResult["surprises"] = [];

    for (const step of scenario.steps) {
      if (step.todo === true) {
        skipped.push({ scenario: scenario.name, step: step.id });
        continue;
      }
      const endpoint = endpoints.get(step.endpoint);
      if (!endpoint) {
        failures.push({
          scenario: scenario.name,
          step: step.id,
          reason: `endpoint "${step.endpoint}" is not in the inventory — a route changed, or the id is a typo`,
        });
        if (this.#config.stopOnError) break;
        continue;
      }

      try {
        const exchange = await this.#runStep(scenario, step, endpoint, vars);
        exchanges.push(exchange);
        if (exchange.response.status !== step.expect) {
          surprises.push({
            scenario: scenario.name,
            step: step.id,
            expected: step.expect,
            actual: exchange.response.status,
          });
        }
      } catch (error) {
        failures.push({
          scenario: scenario.name,
          step: step.id,
          reason: (error as Error).message,
        });
        if (this.#config.stopOnError) break;
      }
    }

    return { exchanges, failures, skipped, surprises };
  }

  async #runStep(
    scenario: Scenario,
    step: Step,
    endpoint: Endpoint,
    vars: Map<string, unknown>,
  ): Promise<Exchange> {
    const routePath = String(interpolate(step.path ?? endpoint.route, vars));
    const query = interpolate(step.query ?? {}, vars) as Record<string, string>;
    const headers: Record<string, string> = { accept: "application/json" };

    if (step.as !== "anonymous") {
      const override = step.credentials
        ? (interpolate(step.credentials, vars) as RoleCredentials)
        : undefined;
      headers.authorization = `Bearer ${await this.tokenFor(step.as, override)}`;
    }

    let body: string | undefined;
    let contentType: string | undefined;
    if (step.file !== undefined) {
      // A fixed boundary, so two captures of the same step produce the same bytes.
      const file = step.file;
      body =
        `--${MULTIPART_BOUNDARY}\r\n` +
        `Content-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\n` +
        `Content-Type: ${file.contentType}\r\n\r\n` +
        `${String(interpolate(file.content, vars))}\r\n` +
        `--${MULTIPART_BOUNDARY}--\r\n`;
      contentType = `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`;
    } else if (step.text !== undefined) {
      body = String(interpolate(step.text, vars));
      contentType = step.contentType ?? "text/csv";
    } else if (step.body !== undefined) {
      body = JSON.stringify(interpolate(step.body, vars));
      contentType = step.contentType ?? "application/json";
    }
    if (contentType) headers["content-type"] = contentType;

    const response = await this.#fetch(this.#url(routePath, query), {
      method: endpoint.verb,
      headers,
      ...(body === undefined ? {} : { body }),
    });
    const parsed = parseBody(response.text, response.headers["content-type"]);

    for (const [name, pointer] of Object.entries(step.bind ?? {})) {
      vars.set(name, pluck(pointer, { body: parsed, headers: response.headers }));
    }

    return {
      scenario: scenario.name,
      step: step.id,
      endpoint: step.endpoint,
      as: step.as,
      kind: step.kind,
      ...(step.note === undefined ? {} : { note: step.note }),
      unstable: step.unstable ?? [],
      request: {
        method: endpoint.verb,
        path: routePath,
        body:
          body === undefined
            ? null
            : step.file !== undefined || step.text !== undefined
              ? body
              : JSON.parse(body),
        ...(contentType === undefined ? {} : { contentType }),
      },
      response: { status: response.status, headers: response.headers, body: parsed },
    };
  }
}
