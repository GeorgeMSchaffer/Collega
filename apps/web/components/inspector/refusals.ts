/**
 * Why a control in this column will not work, said before it is pressed.
 *
 * Short and specific to the control, which is comp Q's treatment and the one Unit 4 already
 * set on *New idea*: the panel repeats these beside four or five actions, and the API's full
 * sentence repeated five times buries the panel it is meant to explain. The API's own words
 * are not lost — a refusal that actually happens renders `problem.detail` verbatim — so these
 * are the label, and the recording is the authority. Each is annotated with the fixture whose
 * 403 it stands in for, so the two cannot drift apart unnoticed.
 *
 * Gating is a convenience, never the authorization. Every one of these is reachable by
 * pressing the control anyway from a role the UI did not gate, and the server decides.
 */

export const REFUSALS = {
  /**
   * All four Site Admin cases carry the same recorded detail: "Site Admins cannot change
   * organization content directly. Use View As to act as a user in that organization."
   * (`ideas.update.siteadmin`, `ideas.delete.siteadmin`, `ideas.upvote.siteadmin`,
   * `comments.create.siteadmin`). A vote and a comment are a member's acts, so they are
   * refused for the same reason an edit is.
   */
  siteAdminEdit: "Act as a member to edit",
  siteAdminDelete: "Act as a member to delete",
  siteAdminVote: "Act as a member to vote",
  siteAdminComment: "Act as a member to comment",

  /** `ideas.update.readonly`: "Read Only users cannot create or edit ideas." */
  readOnlyEdit: "Read-only accounts can’t edit ideas",
  /** `ideas.delete.readonly`: "You are not allowed to delete ideas." */
  readOnlyDelete: "Read-only accounts can’t delete ideas",
  /**
   * `ideas.delete.own.user` — a member is refused deletion of an idea they raised themselves,
   * which is narrower than the general idea-edit permission and easy to get wrong.
   */
  memberDelete: "Only an administrator can delete an idea",
} as const;
