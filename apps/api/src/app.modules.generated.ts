// GENERATED FILE - do not hand-edit. Run `pnpm generate:modules` (apps/api) to refresh;
// `pnpm build` and `pnpm typecheck` do this automatically via the package.json pre* hooks.
// Source: apps/api/scripts/generate-modules.mjs, scanning apps/api/src/*/*.module.ts.
import { AuthenticationModule } from './authentication/authentication.module.js'
import { BoardsModule } from './boards/boards.module.js'
import { CommentsModule } from './comments/comments.module.js'
import { IdeasModule } from './ideas/ideas.module.js'
import { NotificationsModule } from './notifications/notifications.module.js'
import { OrganizationsModule } from './organizations/organizations.module.js'
import { StatusesModule } from './statuses/statuses.module.js'
import { TagsModule } from './tags/tags.module.js'
import { UsersModule } from './users/users.module.js'

/** Every Wave D feature module discovered under apps/api/src/, in directory-name order. */
export const FEATURE_MODULES = [
  AuthenticationModule,
  BoardsModule,
  CommentsModule,
  IdeasModule,
  NotificationsModule,
  OrganizationsModule,
  StatusesModule,
  TagsModule,
  UsersModule,
] as const
