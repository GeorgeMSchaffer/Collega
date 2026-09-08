import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Code,
  Field,
  Input,
  Textarea,
} from '@collega/design-system'
import { InertForm } from '@/components/common/inert-form'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import { aiProbes, aiPrompt, promptVersions, SYSTEM_PROMPT_MAX } from '@/lib/mock'

export const metadata = { title: 'AI Prompt · Collega' }

/**
 * The deployment-wide system prompt (rules 34-37).
 *
 * Site Admin only, and deliberately so: this is one setting for the whole deployment rather than
 * organization content, which is why editing it does not go through View As the way a scope
 * statement does.
 */
export default function AiPromptPage() {
  return (
    <SettingsPage
      title="AI Prompt"
      gate="the assistant prompt"
      siteAdminOnly
      lead={
        <>
          The instructions every organization&rsquo;s assistant runs under, with safety probes and
          version history.
        </>
      }
      actions={<Badge variant="outline">Affects every organization</Badge>}
    >
      <div className="flex max-w-[900px] flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
            <CardDescription>
              The system prompt every organization&rsquo;s assistant runs under. Two placeholders
              are filled in per request: <Code>{'{{ORGANIZATION_CATALOG}}'}</Code> with that
              organization&rsquo;s idea types, and <Code>{'{{SCOPE_STATEMENT}}'}</Code> with the
              statement its admin wrote. Both must appear somewhere in the text.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InertForm>
              <Field htmlFor="systemPrompt" label="System prompt">
                {/* Counted from the fixture rather than from the live value: a counter that tracks
                    typing needs 'use client', and nothing else on this screen is interactive. */}
                <Textarea
                  id="systemPrompt"
                  name="systemPrompt"
                  rows={14}
                  maxLength={SYSTEM_PROMPT_MAX}
                  defaultValue={aiPrompt.text}
                  className="font-mono text-xs"
                  aria-describedby="systemPrompt-count"
                />
                <span
                  id="systemPrompt-count"
                  className="mt-1 block text-[0.8rem] text-muted-foreground"
                >
                  {aiPrompt.text.length} / {SYSTEM_PROMPT_MAX.toLocaleString('en-US')}
                </span>
              </Field>

              <div className="mt-4 grid gap-x-4 sm:grid-cols-2">
                <Field htmlFor="opening" label="Opening message">
                  <Input id="opening" name="opening" type="text" defaultValue={aiPrompt.opening} />
                </Field>
                <Field htmlFor="refusal" label="Refusal message">
                  <Input id="refusal" name="refusal" type="text" defaultValue={aiPrompt.refusal} />
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline">Run safety probes</Button>
                <Button type="submit">Publish</Button>
                <Button variant="outline">Reset to built-in default</Button>
                <span className="ml-auto text-xs text-muted-foreground">
                  Publishing takes effect for every organization at once.
                </span>
              </div>
            </InertForm>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="m-0 text-base font-semibold">Safety probes</h2>
            <p className="m-0 mt-1 max-w-prose text-sm text-muted-foreground">
              Three fixed requests run against the draft above. The first two must be refused; the
              third must be allowed. This is a smoke test, not a guarantee &mdash; it catches
              instructions that have stopped refusing at all, not every way one can go wrong.
            </p>
          </div>
          <AdminTable summary={`${aiProbes.length} probes ran against the draft above.`}>
            <thead>
              <tr className="border-b bg-muted/40">
                <Th>Request</Th>
                <Th className="w-32">Outcome</Th>
                <Th className="w-40">Verdict</Th>
              </tr>
            </thead>
            <tbody>
              {aiProbes.map((probe) => (
                <tr key={probe.request} className="border-b last:border-0">
                  <td className="px-4 py-2.5">{probe.request}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{probe.outcome}</td>
                  <td className="px-4 py-2.5">
                    {probe.asExpected ? (
                      <Badge variant="success">as expected</Badge>
                    ) : (
                      <Badge variant="destructive">unexpected</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="m-0 text-base font-semibold">History</h2>
            <p className="m-0 mt-1 max-w-prose text-sm text-muted-foreground">
              Every publish is kept. Restoring copies an old version into the editor above; it does
              not publish on its own.
            </p>
          </div>
          <AdminTable summary={`${promptVersions.length} published versions.`}>
            <thead>
              <tr className="border-b bg-muted/40">
                <Th className="w-32">Version</Th>
                <Th className="w-64">Published</Th>
                <Th>Author</Th>
                <Th className="w-28">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {promptVersions.map((version) => (
                <tr key={version.version} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <b className="font-medium">v{version.version}</b>
                      {version.active ? <Badge variant="success">active</Badge> : null}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{version.publishedAt}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{version.author}</td>
                  <td className="px-4 py-2.5 text-right">
                    {version.active ? null : (
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Restore version ${version.version}`}
                      >
                        Restore
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        </section>
      </div>
    </SettingsPage>
  )
}
