import { redirect } from "next/navigation";

/**
 * `SPEC/20-feature-client-ui.md`: "A bare `/ideas/{ideaId}` link resolves to the Ideas list
 * with that idea open." The inspector is not a page of its own — its state is a query
 * parameter on the list it is docked beside — so the bare path is a redirect onto that.
 */
export default async function IdeaDeepLinkPage({
  params,
}: {
  params: Promise<{ ideaId: string }>;
}): Promise<never> {
  const { ideaId } = await params;
  redirect(`/ideas?idea=${encodeURIComponent(ideaId)}`);
}
