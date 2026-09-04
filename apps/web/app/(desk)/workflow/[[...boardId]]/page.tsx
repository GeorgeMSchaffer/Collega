import { redirect } from "next/navigation";

/**
 * Compatibility redirects, `SPEC/20-feature-client-ui.md`: `/workflow` → `/boards` and
 * `/workflow/{boardId}` → `/board/{boardId}`. Workflow was the old name for a board and no
 * user-facing surface uses it any more, but links to it are in the wild.
 */
export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ boardId?: string[] }>;
}): Promise<never> {
  const { boardId } = await params;
  redirect(boardId?.[0] ? `/board/${boardId[0]}` : "/boards");
}
