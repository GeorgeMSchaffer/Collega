import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Textarea,
} from '@collega/design-system'
import Link from 'next/link'
import { InertForm } from '@/components/common/inert-form'
import { SettingsPage } from '@/components/settings/settings-page'
import { aiAssist, currentUser, ideaTypes, SCOPE_STATEMENT_MAX } from '@/lib/mock'

export const metadata = { title: 'AI Assist · Collega' }

/**
 * The scope statement an Org Admin writes for their own organization (rule 6).
 *
 * Three bodies, not two. A Site Admin passes the administrator gate and still has nothing to edit
 * here — the setting is organization content, and they belong to no organization — so this route
 * branches on the role itself rather than declaring `siteAdminOnly`, which would refuse the very
 * admin who owns the setting.
 */
export default function AiAssistPage() {
  const siteAdmin = currentUser.role === 'SiteAdmin'
  const org = currentUser.organizationName ?? 'this organization'

  return (
    <SettingsPage
      title="AI Assist"
      gate="the assistant"
      lead={
        siteAdmin
          ? 'Assistant scope is set per organization.'
          : `Tell the assistant what ${org} wants ideas about, so it can stay on subject.`
      }
    >
      {siteAdmin ? <ActAsAMember /> : <ScopeStatement org={org} />}
    </SettingsPage>
  )
}

function ActAsAMember() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed bg-card px-6 py-8">
      <h3 className="m-0 text-base font-semibold">
        Act as a member of an organization to configure its assistant
      </h3>
      <p className="m-0 max-w-prose text-sm text-muted-foreground">
        A scope statement describes one organization&rsquo;s subject matter, and a Site Admin
        belongs to none, so there is nothing for this page to load. Use View As to enter an
        organization, then return here.
      </p>
    </div>
  )
}

function ScopeStatement({ org }: { org: string }) {
  const inScope = ideaTypes.filter((type) => type.organizationId === 'acme-robotics')

  return (
    <div className="flex max-w-[720px] flex-col gap-4">
      {aiAssist.available ? null : (
        <Alert role="status" className="max-w-prose">
          <span>
            <b>AI assist is switched off for this deployment.</b> The statement below still saves,
            and takes effect whenever assist is turned back on. Nothing here is lost in the
            meantime.
          </span>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Scope statement</CardTitle>
          <CardDescription>
            Tell the assistant what this organization collects ideas about. It uses this to decide
            whether a request is on-topic, and refuses politely when it is not. Plain prose works
            better than a list of keywords.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InertForm>
            <Field htmlFor="scopeStatement" label={`What ${org} wants ideas about`}>
              {/* Counted from the fixture rather than from the live value: a counter that tracks
                  typing needs 'use client', and nothing else on this screen is interactive. */}
              <Textarea
                id="scopeStatement"
                name="scopeStatement"
                rows={5}
                maxLength={SCOPE_STATEMENT_MAX}
                defaultValue={aiAssist.scopeStatement}
                aria-describedby="scopeStatement-count"
              />
              <span
                id="scopeStatement-count"
                className="mt-1 block text-[0.8rem] text-muted-foreground"
              >
                {aiAssist.scopeStatement.length} / {SCOPE_STATEMENT_MAX}
              </span>
            </Field>

            <h4 className="m-0 mt-6 text-sm font-semibold">
              Always in scope &mdash; your active idea types
            </h4>
            <p className="m-0 mt-1 max-w-prose text-sm text-muted-foreground">
              Every active idea type is in scope whether or not the statement mentions it, so you
              never have to restate them. Change the set on{' '}
              <Link href="/settings/idea-types">Idea Types</Link>.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {inScope.map((type) => (
                <Badge key={type.id}>{type.name}</Badge>
              ))}
            </div>

            <h4 className="m-0 mt-6 text-sm font-semibold">What a refusal sounds like</h4>
            <div className="mt-2 rounded-lg bg-muted p-4">
              <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Assistant
              </div>
              <p className="m-0 mt-1.5 text-sm">{aiAssist.refusal}</p>
            </div>
            <p className="m-0 mt-2 max-w-prose text-sm text-muted-foreground">
              The wording is fixed. The statement changes <i>when</i> it is used, never what it says
              &mdash; so a scope mistake cannot turn into a rude reply.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="submit">Save</Button>
              <Button variant="outline">Clear statement</Button>
            </div>
          </InertForm>
        </CardContent>
      </Card>
    </div>
  )
}
