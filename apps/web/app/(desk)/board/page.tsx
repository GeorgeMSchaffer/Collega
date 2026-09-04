import { redirect } from "next/navigation";

/** Compatibility redirect, `SPEC/20-feature-client-ui.md`: `/board` → `/boards`. */
export default function BoardIndexPage(): never {
  redirect("/boards");
}
