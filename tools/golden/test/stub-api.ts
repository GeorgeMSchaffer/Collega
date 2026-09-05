// A stand-in API, just real enough to exercise the harness end to end:
// login for four roles, one create-then-read sequence, a refusal, a validation
// failure, and volatile values (guids, timestamps, a token) in every response.

import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";

export type StubOptions = {
  /** Flip a value to prove replay notices. Called with the body about to be sent. */
  mutate?: (path: string, body: Record<string, unknown>) => Record<string, unknown>;
  basePath?: string;
};

const PASSWORD = "stub-password";
const ROLE_BY_EMAIL: Record<string, string> = {
  "siteadmin@stub.test": "SiteAdmin",
  "orgadmin@stub.test": "OrgAdmin",
  "user@stub.test": "User",
  "readonly@stub.test": "ReadOnly",
};

function jwtFor(role: string): string {
  const part = Buffer.from(JSON.stringify({ role, iat: Date.now() })).toString("base64url");
  return `eyJhbGciOiJIUzI1NiJ9.${part}.${Buffer.from(randomUUID()).toString("base64url")}`;
}

function roleOf(auth: string | undefined): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  const payload = auth.slice(7).split(".")[1];
  if (!payload) return null;
  try {
    return (JSON.parse(Buffer.from(payload, "base64url").toString()) as { role: string }).role;
  } catch {
    return null;
  }
}

export async function startStub(options: StubOptions = {}): Promise<{
  url: string;
  basePath: string;
  close: () => Promise<void>;
  boards: Map<string, unknown>;
}> {
  const basePath = options.basePath ?? "/api/v1";
  const boards = new Map<string, unknown>();

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString();
      const url = new URL(req.url ?? "/", "http://stub");
      const route = url.pathname.startsWith(basePath) ? url.pathname.slice(basePath.length) : url.pathname;
      const role = roleOf(req.headers.authorization);

      const send = (status: number, body: unknown) => {
        const shaped =
          body && typeof body === "object" && options.mutate
            ? options.mutate(route, body as Record<string, unknown>)
            : body;
        const text = shaped === null ? "" : JSON.stringify(shaped);
        res.writeHead(status, { "content-type": "application/json" });
        res.end(text);
      };

      if (route === "/auth/login" && req.method === "POST") {
        const { email, password } = JSON.parse(raw || "{}") as { email?: string; password?: string };
        const loginRole = email ? ROLE_BY_EMAIL[email] : undefined;
        if (!loginRole || password !== PASSWORD) return send(401, { title: "Invalid credentials" });
        return send(200, {
          accessToken: jwtFor(loginRole),
          expiresInSeconds: 3600,
          requiresPasswordChange: false,
          user: { id: randomUUID(), email, role: loginRole, lastSeenAt: new Date().toISOString() },
        });
      }

      if (route === "/auth/me" && req.method === "GET") {
        if (!role) return send(401, { title: "Unauthorized" });
        return send(200, { id: randomUUID(), role, viewingAs: null });
      }

      const boardsMatch = /^\/organizations\/([\w-]+)\/boards$/.exec(route);
      if (boardsMatch && req.method === "POST") {
        if (!role) return send(401, { title: "Unauthorized" });
        if (role === "User" || role === "ReadOnly") {
          return send(403, { title: "Forbidden", detail: "Board creation is an administrator action." });
        }
        const body = JSON.parse(raw || "{}") as { name?: string };
        if (!body.name) {
          return send(400, { title: "Validation failed", errors: { name: ["Name is required."] } });
        }
        const board = {
          id: randomUUID(),
          organizationId: boardsMatch[1],
          name: body.name,
          createdAt: new Date().toISOString(),
        };
        boards.set(board.id, board);
        return send(201, board);
      }

      const boardMatch = /^\/boards\/([\w-]+)$/.exec(route);
      if (boardMatch && req.method === "GET") {
        if (!role) return send(401, { title: "Unauthorized" });
        const board = boards.get(boardMatch[1]);
        if (!board) return send(404, { title: "Not found" });
        return send(200, board);
      }

      send(404, { title: "No stub route", detail: `${req.method} ${route}` });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("stub did not bind a port");

  return {
    url: `http://127.0.0.1:${address.port}`,
    basePath,
    boards,
    close: () => new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    ),
  };
}

export const STUB_CREDENTIALS = {
  SiteAdmin: { email: "siteadmin@stub.test", password: PASSWORD },
  OrgAdmin: { email: "orgadmin@stub.test", password: PASSWORD },
  User: { email: "user@stub.test", password: PASSWORD },
  ReadOnly: { email: "readonly@stub.test", password: PASSWORD },
};
