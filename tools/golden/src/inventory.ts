// The endpoint inventory, read from the .NET controllers rather than typed out.
//
// The corpus is only as good as its coverage, so coverage has to be measured
// against something derived from the code. Hand-listing 81 endpoints would drift
// the first time a route changed.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type HttpVerb = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type Endpoint = {
  /** Stable key: "GET /boards/{boardId}". Used everywhere a fixture points back. */
  id: string;
  verb: HttpVerb;
  /** Route template with EF-style constraints stripped: "/boards/{boardId}". */
  route: string;
  controller: string;
  action: string;
  /** Roles the [Authorize] attributes admit, or "anonymous", or "any" for a bare [Authorize]. */
  authorize: "anonymous" | "any" | string[];
  /** Path parameter names, in route order. */
  params: string[];
  /** Declared success + error statuses, from [ProducesResponseType]. */
  statuses: number[];
  source: string;
};

const VERB_ATTR = /^\s*\[Http(Get|Post|Put|Patch|Delete)(?:\("([^"]*)"\))?\]/;
const AUTHORIZE_ATTR = /^\s*\[Authorize(?:\(Roles\s*=\s*"([^"]*)"\))?\]\s*$/;
// Anything else inside [Authorize(...)] — a policy, a scheme — would be read as a
// bare [Authorize] and quietly widen the roles this endpoint looks reachable by.
const AUTHORIZE_UNKNOWN = /^\s*\[Authorize\(/;
const ALLOW_ANONYMOUS = /^\s*\[AllowAnonymous\]/;
const PRODUCES_ATTR = /StatusCodes\.Status(\d{3})/;
const ACTION_SIGNATURE = /^\s*(?:public|internal)\s+(?:async\s+)?[\w<>,\[\]\s?]+\s+(\w+)\s*\(/;

/** "{organizationId:guid}" -> "{organizationId}" — constraints are a routing detail. */
function stripConstraints(route: string): string {
  return route.replace(/\{(\w+)(?::[^}]+)?\}/g, "{$1}");
}

function paramsOf(route: string): string[] {
  return [...route.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

function unreadableAuthorize(source: string, line: string): string {
  return (
    `${source}: cannot read ${line.trim()} — only [Authorize] and [Authorize(Roles = "...")] ` +
    "are understood. Teach inventory.ts the new shape rather than letting it read as " +
    "unrestricted, which would show the endpoint as reachable by roles it refuses."
  );
}

const CLASS_DECL = /^\s*(?:public|internal)\s+(?:sealed\s+)?(?:partial\s+)?class\s+(\w+)\s*:/;
const ROUTE_ATTR = /^\s*\[Route\("([^"]*)"\)\]/;

function parseController(source: string, text: string): Endpoint[] {
  const lines = text.split("\n");

  const endpoints: Endpoint[] = [];
  // Attributes accumulate until the action signature closes the method, because
  // C# lets them appear in any order — [Authorize] above [HttpGet] is common here.
  type Method = {
    verb: HttpVerb | null;
    template: string;
    statuses: number[];
    authorize: string | null | undefined;
    anonymous: boolean;
  };
  const freshMethod = (): Method => ({
    verb: null,
    template: "",
    statuses: [],
    authorize: undefined,
    anonymous: false,
  });
  let method = freshMethod();

  // A file may hold more than one controller (AiAssistController.cs holds the
  // platform and per-organization pair), each with its own attributes.
  let controller = path.basename(source).replace(/Controller\.cs$/, "");
  let classPrefix = "";
  let classAuthorize: string | null = null;
  let classIsAuthorized = false;
  // Attributes seen at class indentation since the last class declaration.
  let pendingClass: { prefix: string; authorize: string | null; authorized: boolean } = {
    prefix: "",
    authorize: null,
    authorized: false,
  };

  for (const line of lines) {
    const classMatch = CLASS_DECL.exec(line);
    if (classMatch) {
      controller = classMatch[1].replace(/Controller$/, "");
      classPrefix = pendingClass.prefix;
      classAuthorize = pendingClass.authorize;
      classIsAuthorized = pendingClass.authorized;
      pendingClass = { prefix: "", authorize: null, authorized: false };
      method = freshMethod();
      continue;
    }
    // Class-level attributes are unindented; method-level ones are not.
    if (!line.startsWith(" ") && line.trimStart().startsWith("[")) {
      const routeMatch = ROUTE_ATTR.exec(line);
      if (routeMatch) pendingClass.prefix = routeMatch[1];
      const classAuth = AUTHORIZE_ATTR.exec(line);
      if (classAuth) {
        pendingClass.authorized = true;
        pendingClass.authorize = classAuth[1] ?? null;
      } else if (AUTHORIZE_UNKNOWN.test(line)) {
        throw new Error(unreadableAuthorize(source, line));
      }
      continue;
    }
    const verbMatch = VERB_ATTR.exec(line);
    if (verbMatch) {
      method.verb = verbMatch[1].toUpperCase() as HttpVerb;
      method.template = verbMatch[2] ?? "";
      continue;
    }
    if (ALLOW_ANONYMOUS.test(line)) {
      method.anonymous = true;
      continue;
    }
    if (!AUTHORIZE_ATTR.test(line) && AUTHORIZE_UNKNOWN.test(line)) {
      throw new Error(unreadableAuthorize(source, line));
    }
    const authMatch = AUTHORIZE_ATTR.exec(line);
    if (authMatch) {
      method.authorize = authMatch[1] ?? null;
      continue;
    }
    const statusMatch = PRODUCES_ATTR.exec(line);
    if (statusMatch) {
      method.statuses.push(Number(statusMatch[1]));
      continue;
    }

    const actionMatch = ACTION_SIGNATURE.exec(line);
    if (!actionMatch) continue;
    if (method.verb === null) {
      // A helper or constructor, not an action — its attributes belong to nothing.
      method = freshMethod();
      continue;
    }

    const authorized = method.authorize !== undefined || classIsAuthorized;
    const roles = method.authorize !== undefined ? method.authorize : classAuthorize;
    const joined = [classPrefix, method.template].filter((part) => part !== "").join("/");
    const full = "/" + stripConstraints(joined).replace(/^\//, "");
    const route = full === "/" ? "/" : full.replace(/\/$/, "");
    endpoints.push({
      id: `${method.verb} ${route}`,
      verb: method.verb,
      route,
      controller,
      action: actionMatch[1],
      authorize: method.anonymous || !authorized ? "anonymous" : roles ? roles.split(",") : "any",
      params: paramsOf(route),
      statuses: [...new Set(method.statuses)].sort((a, b) => a - b),
      source,
    });
    method = freshMethod();
  }

  return endpoints;
}

export async function readInventory(controllersDir: string): Promise<Endpoint[]> {
  const files = (await readdir(controllersDir)).filter((f) => f.endsWith("Controller.cs")).sort();
  const all: Endpoint[] = [];
  for (const file of files) {
    const full = path.join(controllersDir, file);
    all.push(...parseController(file, await readFile(full, "utf8")));
  }
  const seen = new Map<string, Endpoint>();
  for (const e of all) {
    const clash = seen.get(e.id);
    if (clash) {
      throw new Error(
        `two actions claim ${e.id}: ${clash.controller}.${clash.action} and ${e.controller}.${e.action}`,
      );
    }
    seen.set(e.id, e);
  }
  return all;
}

/** The four roles the corpus must cover. Authorization is behaviour, not decoration. */
export const ROLES = ["SiteAdmin", "OrgAdmin", "User", "ReadOnly"] as const;
export type Role = (typeof ROLES)[number];
