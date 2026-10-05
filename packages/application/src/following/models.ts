/** `PUT`/`DELETE /ideas/{ideaId}/follow` (SPEC/contracts/following.md). */
export type FollowResult = {
  readonly ideaId: string
  readonly isFollowing: boolean
  readonly followerCount: number
}
