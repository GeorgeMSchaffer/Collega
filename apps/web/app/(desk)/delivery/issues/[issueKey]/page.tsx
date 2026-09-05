import type { Metadata } from "next";

import { IssueScreen } from "@/app/(desk)/delivery/issues/[issueKey]/issue-screen";

export const metadata: Metadata = {
  title: "Issue",
  description: "Design prototype — an issue in its delivery lens, with the idea's provenance intact.",
};

export default async function IssuePage({ params }: { params: Promise<{ issueKey: string }> }) {
  // Next has already percent-decoded the segment. Decoding again turns a key containing a
  // stray `%` into a URIError and a 500, in place of the screen below's own not-found state.
  const { issueKey } = await params;
  return <IssueScreen issueKey={issueKey} />;
}
