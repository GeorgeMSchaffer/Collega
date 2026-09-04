"use client";

/**
 * The three assistant screens comp P puts on the Settings hub.
 *
 *  - `/settings/ai-assist` — an organization's scope statement. One free-text value; both
 *    admin roles read it, and only an Org Admin may save it (`PUT` is a **403 for a Site
 *    Admin** in the corpus, because a scope statement is organization content — rule 25
 *    again, on a screen that is not a table).
 *  - `/settings/ai-prompt` — the instructions every organization's assistant runs under.
 *    Site Admin only, and refused outright to everyone else.
 *  - `/settings/api-usage` — a meter, not a management surface. Read-only for both admin
 *    roles, which is why it carries no denied controls: an absent action needs no explanation.
 *
 * **What the corpus can show.** The deployment these fixtures came from had no AI credential:
 * `aiAssistAvailable` is false, every scope statement is null, and every usage total is zero
 * with an empty per-organization array. The prompt itself is real and substantial. So two of
 * these three screens are correct and nearly empty, and they say which of those two things
 * they are rather than looking broken.
 */

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  Screen,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  When,
  type ScreenState,
} from "@collega/design-system";
import * as React from "react";

import { CorpusNote, ErrorNotice, RefusalNotice } from "@/components/desk/notices";
import { useApi } from "@/lib/api";
import type { Role } from "@/lib/types";

import { Cols, Guarded, SubmitOutcome } from "@/app/(desk)/settings/_components/chrome";
import { useSubmit } from "@/app/(desk)/settings/_lib/api";
import type { AiAssistSettings, AiPrompt, AiUsage } from "@/app/(desk)/settings/_lib/types";

function loadingCard() {
  return (
    <Card className="max-w-[720px]">
      <CardContent className="flex flex-col gap-3">
        <span className="sr-only">Loading</span>
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </CardContent>
    </Card>
  );
}

/** `/settings/ai-assist`. */
export function AiAssistScreen({
  role,
  organizationId,
  organizationName,
  override,
}: {
  role: Role | undefined;
  organizationId: string | null;
  organizationName: string;
  override: "empty" | "loading" | "error" | null;
}) {
  const settings = useApi<AiAssistSettings>(
    organizationId ? `/organizations/${organizationId}/ai-assist/settings` : null,
  );
  const save = useSubmit<AiAssistSettings>();
  const [scope, setScope] = React.useState<string | null>(null);
  const value = scope ?? settings.data?.scopeStatement ?? "";

  const state: ScreenState =
    override ??
    (settings.state === "loading" ? "loading" : settings.state === "error" ? "error" : "normal");

  return (
    <Screen state={state} data-testid="settings-ai-assist">
      <When state="loading">{loadingCard()}</When>

      <When state="error">
        {settings.error?.isRefusal ? (
          <RefusalNotice error={settings.error} />
        ) : (
          <ErrorNotice error={settings.error} what="the assistant settings" onRetry={settings.reload} />
        )}
      </When>

      <When state={["normal", "empty"]}>
        <Cols
          aside={
            <Card>
              <CardContent className="flex flex-col gap-2">
                <h2 className="m-0 text-lg font-semibold tracking-tight">Availability</h2>
                <Badge variant={settings.data?.aiAssistAvailable ? "secondary" : "outline"} className="w-fit">
                  {settings.data?.aiAssistAvailable ? "Available" : "Not available"}
                </Badge>
                <p className="m-0 text-sm leading-relaxed text-muted-foreground">
                  Whether the assistant can run at all is a deployment-level setting — an API
                  credential configured once for the whole platform, not per organization. The
                  scope statement beside this is yours either way; it takes effect when the
                  assistant is switched on.
                </p>
              </CardContent>
            </Card>
          }
        >
          <Card className="max-w-[720px]">
            <CardContent>
              <h2 className="m-0 mb-1 text-xl font-semibold tracking-tight">Scope</h2>
              <p className="m-0 mb-4 text-sm text-muted-foreground">
                Tell the assistant what {organizationName} wants ideas about, so it can stay on
                subject and say so when a conversation drifts.
              </p>
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!organizationId) return;
                  void save.send("PUT", `/organizations/${organizationId}/ai-assist/settings`, {
                    scopeStatement: value,
                  });
                }}
              >
                <div>
                  <label htmlFor="settings-ai-scope" className="mb-1 block text-sm font-medium">
                    Scope statement
                  </label>
                  <Textarea
                    id="settings-ai-scope"
                    rows={6}
                    value={value}
                    aria-describedby="settings-ai-scope-hint"
                    placeholder="Ideas about our warehouse automation, shop-floor process and product direction."
                    onChange={(event) => setScope(event.target.value)}
                  />
                  <p id="settings-ai-scope-hint" className="mt-1 mb-0 text-xs text-muted-foreground">
                    A sentence or two. The assistant refuses anything it cannot plausibly turn
                    into an idea within this scope.
                  </p>
                </div>
                <Guarded role={role} scope="org-content">
                  {(denied) => (
                    <Button type="submit" className="w-fit" disabled={save.state === "sending"} {...(denied ?? {})}>
                      Save scope
                    </Button>
                  )}
                </Guarded>
              </form>
              <SubmitOutcome outcome={save} what="save" className="mt-4" />

              {settings.data?.scopeStatement === null ? (
                <CorpusNote className="mt-4">
                  the recorded deployment has no assistant credential, so{" "}
                  <code className="font-mono">aiAssistAvailable</code> is false and the scope
                  statement is null everywhere. The empty box above is the real recorded value,
                  not a failure to load one.
                </CorpusNote>
              ) : null}
            </CardContent>
          </Card>
        </Cols>
      </When>
    </Screen>
  );
}

/** `/settings/ai-prompt`. */
export function AiPromptScreen({ override }: { override: "empty" | "loading" | "error" | null }) {
  const prompt = useApi<AiPrompt>("/ai-assist/prompt");
  const publish = useSubmit<AiPrompt>();
  const reset = useSubmit<AiPrompt>();
  const probe = useSubmit<unknown>();

  const [body, setBody] = React.useState<string | null>(null);
  const value = body ?? prompt.data?.body ?? "";

  const state: ScreenState =
    override ?? (prompt.state === "loading" ? "loading" : prompt.state === "error" ? "error" : "normal");

  return (
    <Screen state={state} data-testid="settings-ai-prompt">
      <When state="loading">{loadingCard()}</When>

      <When state="error">
        {prompt.error?.isRefusal ? (
          <RefusalNotice error={prompt.error} />
        ) : (
          <ErrorNotice error={prompt.error} what="the assistant instructions" onRetry={prompt.reload} />
        )}
      </When>

      <When state={["normal", "empty"]}>
        <Cols
          aside={
            <Card>
              <CardContent className="flex flex-col gap-3">
                <h2 className="m-0 text-lg font-semibold tracking-tight">Version</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={prompt.data?.isBuiltInDefault ? "outline" : "secondary"}>
                    {prompt.data?.isBuiltInDefault
                      ? "Built-in default"
                      : `Version ${prompt.data?.version ?? "—"}`}
                  </Badge>
                </div>
                <p className="m-0 text-sm leading-relaxed text-muted-foreground">
                  Publishing replaces the instructions every organization’s assistant runs
                  under, immediately. Reset restores the built-in default.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void reset.send("POST", "/ai-assist/prompt/reset")}
                  >
                    Reset to default
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void probe.send("POST", "/ai-assist/prompt/probe", { body: value })}
                  >
                    Run safety probe
                  </Button>
                </div>
                <SubmitOutcome outcome={reset} what="reset the prompt" />
                {probe.state === "failed" && probe.error?.status === 503 ? (
                  <Alert variant="warning" role="status">
                    <AlertTitle>The probe could not run.</AlertTitle>
                    <AlertDescription>
                      The recorded deployment has no assistant credential, so the probe answered
                      503. That is the real recording, not a fault here.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <SubmitOutcome outcome={probe} what="probe the prompt" />
                )}

                {prompt.data && prompt.data.versions.length === 0 ? (
                  <CorpusNote>
                    the capture holds no published versions, so the history and rollback list
                    comp P draws here has nothing behind it and is left out.
                  </CorpusNote>
                ) : null}
              </CardContent>
            </Card>
          }
        >
          <Card>
            <CardContent>
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void publish.send("PUT", "/ai-assist/prompt", {
                    body: value,
                    outOfScopeRedirect: prompt.data?.outOfScopeRedirect ?? "",
                    conversationClosedRedirect: prompt.data?.conversationClosedRedirect ?? "",
                  });
                }}
              >
                <div>
                  <label htmlFor="settings-ai-prompt-body" className="mb-1 block text-sm font-medium">
                    Instructions
                  </label>
                  <Textarea
                    id="settings-ai-prompt-body"
                    rows={18}
                    value={value}
                    className="font-mono text-xs"
                    onChange={(event) => setBody(event.target.value)}
                  />
                </div>

                <dl className="m-0 grid gap-2 text-sm">
                  <dt className="font-medium">Out-of-scope reply</dt>
                  <dd className="m-0 text-muted-foreground">{prompt.data?.outOfScopeRedirect}</dd>
                  <dt className="font-medium">Conversation-closed reply</dt>
                  <dd className="m-0 text-muted-foreground">
                    {prompt.data?.conversationClosedRedirect}
                  </dd>
                </dl>

                <Button type="submit" className="w-fit" disabled={publish.state === "sending"}>
                  Publish to every organization
                </Button>
              </form>
              <SubmitOutcome outcome={publish} what="publish" className="mt-4" />
            </CardContent>
          </Card>
        </Cols>
      </When>
    </Screen>
  );
}

/** `/settings/api-usage`. */
export function UsageScreen({
  role,
  organizationId,
  organizationName,
  override,
}: {
  role: Role | undefined;
  organizationId: string | null;
  organizationName: string;
  override: "empty" | "loading" | "error" | null;
}) {
  // A Site Admin gets the platform roll-up with the shared daily limit; an Org Admin gets
  // their own consumption and no limit, because the cap applies to the whole deployment and
  // showing them a bar they share with organizations they cannot see would imply a budget
  // they control.
  const platform = role === "SiteAdmin";
  const usage = useApi<AiUsage>(
    platform
      ? "/ai-assist/usage"
      : organizationId
        ? `/organizations/${organizationId}/ai-assist/usage`
        : null,
  );

  const state: ScreenState =
    override ?? (usage.state === "loading" ? "loading" : usage.state === "error" ? "error" : "normal");

  const limit = usage.data?.dailyTokenLimit ?? null;
  const used = usage.data?.tokensUsedToday ?? 0;
  const percent = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null;
  const number = new Intl.NumberFormat("en-GB");

  return (
    <Screen state={state} data-testid="settings-api-usage">
      <When state="loading">{loadingCard()}</When>

      <When state="error">
        {usage.error?.isRefusal ? (
          <RefusalNotice error={usage.error} />
        ) : (
          <ErrorNotice error={usage.error} what="API usage" onRetry={usage.reload} />
        )}
      </When>

      <When state={["normal", "empty"]}>
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Calls", number.format(usage.data?.totalCalls ?? 0)],
              ["Tokens", number.format(usage.data?.totalTokens ?? 0)],
              [
                "Estimated cost",
                `$${(usage.data?.totalEstimatedCost ?? 0).toFixed(2)}`,
              ],
            ].map(([label, figure]) => (
              <Card key={label}>
                <CardContent>
                  <div className="text-xs tracking-wide text-muted-foreground uppercase">{label}</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">{figure}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {platform && limit !== null ? (
            <Card>
              <CardContent className="flex flex-col gap-2">
                <h2 className="m-0 text-base font-semibold">Daily limit</h2>
                <p className="m-0 text-sm text-muted-foreground">
                  {number.format(used)} of {number.format(limit)} tokens used today
                  {percent === null ? "" : ` — ${percent}%`}. The cap applies to the whole
                  deployment.
                </p>
                <div
                  role="meter"
                  aria-valuenow={used}
                  aria-valuemin={0}
                  aria-valuemax={limit}
                  aria-label="Tokens used today, against the daily limit"
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full bg-primary" style={{ width: `${percent ?? 0}%` }} />
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="gap-0 overflow-hidden py-0">
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead className="w-24 text-right">Calls</TableHead>
                    <TableHead className="w-32 text-right">Tokens</TableHead>
                    <TableHead className="w-32 text-right">Estimated cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(usage.data?.organizations ?? []).map((row) => (
                    <TableRow key={row.organizationId}>
                      <TableCell className="font-medium text-foreground">
                        {row.organizationTitle ?? row.organizationId}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {number.format(row.calls)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {number.format(row.totalTokens)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${row.estimatedCost.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
              {platform ? "Every organization" : organizationName}, today. Estimated cost is
              computed from published token prices and is not a bill.
            </div>
          </Card>

          {(usage.data?.organizations.length ?? 0) === 0 ? (
            <CorpusNote>
              the recorded deployment has no assistant credential and made no calls, so every
              figure above is a real zero and the per-organization table is genuinely empty.
              Nothing failed to load.
            </CorpusNote>
          ) : null}

          <p className="m-0 max-w-prose rounded-lg border-l-4 border-l-secondary bg-muted/40 px-4 py-3 text-sm leading-relaxed">
            <strong>A meter, not a management surface.</strong> There is nothing to change here
            and no per-organization limit to set — the page exists to answer “how much are we
            using, and is it about to stop?”
          </p>
        </div>
      </When>
    </Screen>
  );
}
