import {
  type CommentListItem,
  type CommentListResult,
  CommentService,
  type CreateCommentResult,
} from '@collega/application/comments'
import type { SortDirection } from '@collega/application/common'
import { BODY_MAX_LENGTH } from '@collega/domain/comments'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import {
  type FieldRules,
  RequestValidationError,
  validateFields,
} from '../common/errors/request-validation.error.js'
import { optional } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

/** `POST /ideas/{ideaId}/comments` - `CreateCommentRequest`. */
type CreateCommentBody = { body?: string; mentionEmails?: unknown }

/** `PUT /comments/{commentId}` - `UpdateCommentRequest`: the same two properties. */
type UpdateCommentBody = CreateCommentBody

/**
 * Query strings arrive as strings or, for a repeated key, as an array; anything unparseable
 * becomes `null` so the Application layer applies its own default. Same known divergence
 * `ideas.controller.ts` records: ASP.NET turned `?page=abc` into a model-binding 400 whose
 * message is one of its own resource strings, which no fixture pins.
 */
function optionalInt(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * `CommentListQuery.sortDirection` is typed `'asc' | 'desc'`, not a raw string, so the coercion
 * .NET did inside `SortDirection.Normalize` has to happen here instead of in the repository.
 *
 * Trimmed and case-insensitive, matching `SortDirection.IsDescending`'s
 * `StringComparison.OrdinalIgnoreCase` - `?sortDirection=DESC` was descending there and must stay
 * descending here. Everything that is not "desc" is ascending, which is why an unrecognised value
 * is `'asc'` rather than an error: `Normalize` never rejected one.
 */
function sortDirection(value: unknown): SortDirection | null {
  const text = optional(value)
  if (text === null) {
    return null
  }
  return text.trim().toLowerCase() === 'desc' ? 'desc' : 'asc'
}

/**
 * `List<string>?`; absent and null stay absent, and a non-string ELEMENT becomes `''`, which
 * mention resolution skips as blank.
 *
 * A present value that is not an array is REFUSED rather than read as absent, which is the one
 * place this file departs from the "default it and record the divergence" rule the query
 * coercions follow. Those only change the STATUS of a request that was going to be rejected
 * anyway; reading `{"body":"m","mentionEmails":"someone@example.test"}` as absent would ACCEPT the
 * request and silently discard content the caller asked for - a **201 with the @-mention gone**,
 * nobody notified and nothing recorded. System.Text.Json could not bind a bare string to
 * `List<string>` either, so the model-binding envelope is the right one.
 *
 * **The exact .NET message text is unverified** - no fixture in the corpus sends a mistyped
 * `mentionEmails`, so the wording below is this API's own, following the same house convention as
 * the templates it sits beside. Record one against the frozen .NET app and replace it, exactly as
 * `absent-body.pipe.ts` says for the body-less request.
 */
function mentionEmailList(value: unknown): readonly string[] | null {
  if (value === undefined || value === null) {
    return null
  }
  if (!Array.isArray(value)) {
    throw new RequestValidationError({ mentionEmails: ['Mention Emails is invalid.'] })
  }
  return value.map((item) => (typeof item === 'string' ? item : ''))
}

/**
 * The `[RequiredField]` / `[MaxLengthField(2000)]` pair that `CreateCommentRequest` and
 * `UpdateCommentRequest` both carry on `Body`, and the only attributes either declares -
 * `MentionEmails` is a bare `List<string>?`.
 *
 * **Not redundant with the domain's identical pair** (`packages/domain/src/comments/comment.ts`'s
 * `normalizeBody`), for the reason `ideas.controller.ts` gives about titles: only this one
 * produces the model-binding envelope, and the corpus is explicit about which envelope belongs
 * here. `comments.create.empty.user` records a 400 with **no `traceId`** and a `content-type`
 * carrying `; charset=utf-8` - the shape `RequestValidationError` renders and the kernel
 * `ValidationError` does not. Reaching the domain check instead would answer the other shape.
 *
 * The domain's copy still has to stay: that one is the invariant, and it judges the TRIMMED body
 * where `MaxLengthAttribute` judged the raw one.
 */
function commentBodyRules(body: CreateCommentBody): Record<string, FieldRules> {
  return { body: { value: body.body, required: true, maxLength: BODY_MAX_LENGTH } }
}

/**
 * Idea comments (`SPEC/30-Contracts.md` "Comment Contracts").
 *
 * **No controller prefix, deliberately.** The five routes span two roots - `ideas/{ideaId}/
 * comments` for the list and create, `comments/{commentId}` for the edit and delete - because the
 * .NET controller declared each path in full rather than sharing one, and the corpus pins all
 * five. Any `@Controller(prefix)` would move at least two of them.
 *
 * Authorization lives entirely in `CommentService`: that every member including Read Only may
 * comment, that editing is the author's alone while an in-scope admin may delete, and that a
 * direct Site Admin is refused where a View As session is not. Nothing here branches on a role or
 * an organization, and the caller's identity is never read - it reaches the service through
 * `CurrentUserContext`.
 *
 * Mentions are resolved by the service too, and an address it cannot resolve to an active user of
 * the idea's organization is a **400 keyed on `mentionEmails`** (`SPEC/30-Contracts.md` line 1250,
 * correcting an earlier line that said such addresses were ignored - they never were). That one is
 * thrown from Application code, so it renders with a `traceId` and no charset: the opposite
 * envelope to the body rules above, and the reason the two failures are raised in different
 * layers rather than merged into one check here.
 */
@Controller()
@UseGuards(AuthGuard)
export class CommentsController {
  constructor(private readonly comments: CommentService) {}

  @Get('ideas/:ideaId/comments')
  async listByIdea(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<CommentListResult> {
    return this.comments.listByIdea(ideaId, {
      page: optionalInt(query.page),
      pageSize: optionalInt(query.pageSize),
      sortDirection: sortDirection(query.sortDirection),
    })
  }

  @Post('ideas/:ideaId/comments')
  @HttpCode(201)
  async create(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Body() body: CreateCommentBody,
  ): Promise<CreateCommentResult> {
    validateFields(commentBodyRules(body))

    return this.comments.create(ideaId, {
      body: body.body ?? '',
      mentionEmails: mentionEmailList(body.mentionEmails),
    })
  }

  @Put('comments/:commentId')
  async update(
    @Param('commentId', UuidParamPipe) commentId: string,
    @Body() body: UpdateCommentBody,
  ): Promise<CommentListItem> {
    validateFields(commentBodyRules(body))

    return this.comments.update(commentId, {
      body: body.body ?? '',
      mentionEmails: mentionEmailList(body.mentionEmails),
    })
  }

  /** Hard delete - comments carry no soft-delete flag, unlike ideas. */
  @Delete('comments/:commentId')
  @HttpCode(204)
  async delete(@Param('commentId', UuidParamPipe) commentId: string): Promise<void> {
    await this.comments.delete(commentId)
  }
}
