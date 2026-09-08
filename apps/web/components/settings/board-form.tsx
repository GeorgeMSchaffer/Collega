import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
} from '@collega/design-system'
import Link from 'next/link'
import { InertForm } from '@/components/common/inert-form'
import { Topbar } from '@/components/nav/topbar'
import { RefusalPanel } from '@/components/settings/admin-only'
import { SwimlanePicker } from '@/components/settings/swimlane-picker'

/**
 * Create and edit are the same form with different seed values, so they are the same component.
 * The one thing edit does *not* add is a delete: a board's ideas outlive the board, and no screen
 * in comp Q offers to discard them as a side effect of tidying up the columns.
 */
export function BoardForm({
  defaultName = '',
  userStatusMoves,
  swimlaneIds,
  submitLabel,
  explainerHeading,
}: {
  defaultName?: string
  userStatusMoves: boolean
  swimlaneIds: string[]
  submitLabel: string
  explainerHeading: string
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_356px]">
      <Card>
        <CardContent>
          <InertForm>
            <Field
              htmlFor="board-name"
              label="Name"
              hint="Required. What this board is called everywhere it appears."
            >
              <Input id="board-name" name="name" defaultValue={defaultName} required />
            </Field>

            <div className="mb-4">
              <span className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="user-moves"
                  name="userStatusMoves"
                  defaultChecked={userStatusMoves}
                  className="mt-0.5"
                />
                <label htmlFor="user-moves" className="text-sm font-medium">
                  Let Users move ideas between statuses on this board
                </label>
              </span>
              <p className="m-0 mt-1 max-w-prose text-[0.8rem] text-muted-foreground">
                With this off, only administrators can change an idea&rsquo;s status here. Read Only
                accounts can never move anything, on any board.
              </p>
            </div>

            <div className="mb-3">
              <h2 className="m-0 text-sm font-semibold">Swimlanes</h2>
              <p className="m-0 mt-1 max-w-prose text-[0.8rem] text-muted-foreground">
                Pick from this organization&rsquo;s statuses. The order on the left is the
                left-to-right order of the board&rsquo;s columns.
              </p>
            </div>
            <SwimlanePicker selected={swimlaneIds} />

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button type="submit">{submitLabel}</Button>
              <Link href="/settings/boards" className={buttonVariants({ variant: 'outline' })}>
                Cancel
              </Link>
            </div>
          </InertForm>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{explainerHeading}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p className="m-0">
            A board groups ideas into columns. Which columns, and in what order, is what makes two
            boards in the same organization different from each other &mdash; they draw from one
            shared set of statuses.
          </p>
          <p className="m-0">
            Removing a swimlane does not delete the status, and does not delete the ideas sitting in
            it. Those ideas keep their status; they simply stop appearing on this board until the
            lane comes back.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * The Site Admin variant of both form routes.
 *
 * It cannot go through `SettingsPage`: that frame renders the screen's own heading before its gate
 * decides anything, and a refusal headed "New board" reads as the form failing to load rather than
 * the role being wrong. So this supplies the frame itself and hands the whole `main` to
 * `RefusalPanel`, the way `AdminOnly` does one layer down.
 */
export function BoardRefusal({ title, reading }: { title: string; reading: string }) {
  return (
    <>
      <Topbar
        title={
          <span className="text-sm font-normal text-muted-foreground">
            <Link href="/settings">Settings</Link> /{' '}
            <b className="font-medium text-foreground">{title}</b>
          </span>
        }
      />
      <main className="flex max-w-[1320px] min-w-0 flex-1 flex-col gap-4 p-6">
        <RefusalPanel heading="A Site Admin cannot create or change a board">
          Boards are organization-owned content, and a Site Admin is refused every mutation of it.
          Reading {reading} is fine; saving is not, so the form is absent rather than present and
          doomed. Use View As to act as an administrator of this organization, and this screen
          becomes ordinary.
        </RefusalPanel>
      </main>
    </>
  )
}
