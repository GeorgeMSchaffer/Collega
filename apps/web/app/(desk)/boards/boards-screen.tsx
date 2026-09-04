"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyTitle,
  Screen,
  When,
  type ScreenState,
} from "@collega/design-system";
import Link from "next/link";

import { CorpusNote, ErrorNotice, LoadingRows, RefusalNotice } from "@/components/desk/notices";
import { PageHeader } from "@/components/desk/page-header";
import { DeskTopBar, DeskWork } from "@/components/nav/desk-top-bar";
import { useActivateOnSpace } from "@/lib/keys";
import { useWorkspace } from "@/lib/workspace";

/**
 * The board list.
 *
 * It also carries the organization summary, and that is where a refusal shows up in this
 * slice without being staged: the organization record is `GET /organizations/{id}`, which the
 * API answers 200 to an Org Admin and a Site Admin and **403 to a member and to a read-only
 * account** — *"You are not allowed to administer organizations."* Both of those roles can
 * see every board on this page; what they cannot see is the organization itself, and the
 * panel says which of the two happened in the API's own words rather than going blank.
 */
export function BoardsScreen() {
  const activateOnSpace = useActivateOnSpace();
  // The board list the shell already holds, not a second copy of the same request: the
  // sidebar badge, the command palette and this page must not be able to disagree.
  const { organization, organizationRefusal, boards, stateOverride } = useWorkspace();

  const items = boards.data ?? [];
  const state: ScreenState =
    stateOverride ??
    (boards.state === "loading"
      ? "loading"
      : boards.state === "error"
        ? "error"
        : items.length === 0
          ? "empty"
          : "normal");

  return (
    <>
      <DeskTopBar crumbs={[{ label: "Boards" }]} />
      <DeskWork>
        <PageHeader title="Boards">
          Every board you can reach, with the number of swimlanes each one is configured with.
        </PageHeader>

        {organizationRefusal ? (
          <RefusalNotice error={organizationRefusal} what="Organization details" className="mb-6" />
        ) : organization ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{organization.title}</CardTitle>
              <CardDescription>{organization.description ?? "No description."}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Screen state={state} data-testid="boards-screen">
          <When state="loading">
            <LoadingRows rows={3} />
          </When>

          <When state="error">
            {boards.error?.isRefusal ? (
              <RefusalNotice error={boards.error} what="Boards" />
            ) : boards.error?.isMockGap ? (
              <CorpusNote>{boards.error.message}</CorpusNote>
            ) : (
              <ErrorNotice error={boards.error} what="boards" onRetry={boards.reload} />
            )}
          </When>

          <When state="empty">
            <Empty>
              <EmptyTitle>No boards yet</EmptyTitle>
              <EmptyDescription>
                An administrator creates the first board in organization settings.
              </EmptyDescription>
            </Empty>
          </When>

          <When state="normal">
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((board) => (
                <li key={board.boardId}>
                  <Card className="h-full transition-colors hover:bg-accent/40">
                    <CardHeader>
                      <CardTitle>
                        <Link
                          href={`/board/${board.boardId}`}
                          onKeyDown={activateOnSpace}
                          className="text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {board.name}
                        </Link>
                      </CardTitle>
                      <CardDescription>
                        {board.swimlaneCount} swimlane{board.swimlaneCount === 1 ? "" : "s"} ·{" "}
                        {board.allowUserStatusUpdate ? "members may move cards" : "members may not move cards"}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </li>
              ))}
            </ul>
          </When>
        </Screen>
      </DeskWork>
    </>
  );
}
