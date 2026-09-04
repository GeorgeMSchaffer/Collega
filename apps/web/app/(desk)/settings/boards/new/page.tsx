"use client";

import { OwnOrgPage, type ScreenProps } from "@/app/(desk)/settings/_components/pages";
import { BoardFormScreen } from "@/app/(desk)/settings/_screens/board-form-screen";

const BOARDS = [{ label: "Boards", href: "/settings/boards" }];

function form(props: ScreenProps) {
  return <BoardFormScreen {...props} boardId={null} backHref="/settings/boards" />;
}

export default function NewBoardPage() {
  return (
    <OwnOrgPage
      crumbLabel="New"
      extraCrumbs={BOARDS}
      subject="board creation"
      orgAdmin={form}
      // A Site Admin reaches the same component, which renders the refusal instead of the
      // form: the mutation is the whole screen, so there is no control to disable.
      siteAdmin={form}
    />
  );
}
