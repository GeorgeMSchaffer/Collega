import { type Page, ValidationError } from '@collega/application/common'
import {
  type BoardTaskListItem,
  type CreateBoardTaskCommand,
  type CreateIdeaResult,
  type IdeaActivityEntry,
  type IdeaDetail,
  type IdeaFieldValueWrite,
  type IdeaImportResult,
  type IdeaListItem,
  type IdeaPage,
  IdeaService,
} from '@collega/application/ideas'
import { UpvoteService, type UpvoteToggleResult } from '@collega/application/upvotes'
import {
  DESCRIPTION_MAX_LENGTH,
  IMPACT_RATIONALE_MAX_LENGTH,
  PROBLEM_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from '@collega/domain/ideas'
import { parseIdeaImportCsv } from '@collega/infrastructure/integrations/csv'
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
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { AuthGuard } from '../auth/auth.guard.js'
import { writeCsv } from '../common/csv/write-csv.js'
import { type FieldRules, validateFields } from '../common/errors/request-validation.error.js'
import {
  guidOrEmpty,
  guidQueryList,
  isGuid,
  optional,
  optionalGuid,
  optionalInt,
  queryBool,
  queryList,
  stringList,
} from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

/** Hard ceiling on a CSV import body, from .NET's `IdeasController.MaxImportBytes`. */
const MAX_IMPORT_BYTES = 5 * 1024 * 1024

/** Hard ceiling on parsed import rows, applied after the header row is dropped. */
const MAX_IMPORT_ROWS = 5_000

type IdeaFieldValueBody = { fieldDefinitionId?: unknown; value?: unknown }

/** `POST /boards/{boardId}/ideas` - `CreateIdeaRequest`. */
type CreateIdeaBody = {
  title?: string
  description?: string | null
  problem?: string
  proposedSolutions?: unknown
  impactRationale?: string
  priority?: string
  ideaTypeId?: unknown
  businessImpactId?: unknown
  dueDate?: unknown
  assigneeUserIds?: unknown
  statusId?: unknown
  tagNames?: unknown
  mentionEmails?: unknown
  fieldValues?: unknown
  effort?: unknown
}

/** `POST /organizations/{organizationId}/issues`: the create shape plus the promotion's fields. */
type AddIssueBody = CreateIdeaBody & { sprintId?: unknown }

/** `POST /boards/{boardId}/tasks`: a task's four fields plus an optional parent and sprint. */
type BoardCardBody = CreateIdeaBody & { parentIdeaId?: unknown; sprintId?: unknown }

/** `PUT /ideas/{ideaId}` - `UpdateIdeaRequest`: the create shape minus `statusId`. */
type UpdateIdeaBody = Omit<CreateIdeaBody, 'statusId'> & { effort?: unknown }

type ChangeIdeaStatusBody = { statusId?: unknown; forceReason?: unknown }

/** `DELETE /ideas/{ideaId}/board`'s optional body: an Org Admin's override of the reference-lane
 * lock. */
type DetachFromBoardBody = { forceReason?: unknown }

type SetBlockedByBody = { ideaIds?: unknown }

type ReassignIdeaTypeBody = { ideaTypeId?: unknown }

/** `List<Guid>?` - absent stays absent, so the Application layer can tell "not provided" apart. */
function guidList(value: unknown): readonly string[] | null {
  return Array.isArray(value) ? value.map(guidOrEmpty) : null
}

/** `List<IdeaFieldValueRequest>?` -> `IdeaFieldValueWrite[]`, mirroring .NET's `ToFieldValues`. */
function fieldValues(value: unknown): readonly IdeaFieldValueWrite[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  return value.map((entry: IdeaFieldValueBody) => ({
    // `[RequiredField]` on a `Guid` is a no-op - `RequiredAttribute` only rejects null, and a
    // boxed `Guid.Empty` is not null - so an omitted id was never a 400 on the .NET side either.
    fieldDefinitionId: guidOrEmpty(entry?.fieldDefinitionId),
    value: typeof entry?.value === 'string' ? entry.value : null,
  }))
}

/**
 * The `[RequiredField]` / `[MaxLengthField]` set `CreateIdeaRequest` and `UpdateIdeaRequest`
 * share - identical field for field on the .NET side, and the ONLY three attributes either
 * carries. `IdeaTypeId` and `BusinessImpactId` do carry `[RequiredField]`, but on a
 * non-nullable `Guid` it never fires (see `fieldValues` above); they are validated in the
 * Application layer as "an active option in the organization", which is a 400 of the other kind.
 *
 * The domain enforces the same two lengths (`packages/domain/src/ideas/idea.ts`) and must keep
 * doing so: that check is the invariant, this one is the contract. They are not redundant - only
 * this one produces the model-binding envelope a DTO attribute produced, and the domain's judges
 * the TRIMMED value where `MaxLengthAttribute` judged the raw one.
 */
function ideaBodyRules(body: CreateIdeaBody): Record<string, FieldRules> {
  return {
    title: { value: body.title, required: true, maxLength: TITLE_MAX_LENGTH },
    // Optional since 2026-09-27 (an optional summary); the three structured fields below are
    // required instead. `proposedSolutions` is a list, so its 1-to-5 and per-item limits are the
    // domain's (a field-keyed 400 all the same).
    description: { value: body.description, maxLength: DESCRIPTION_MAX_LENGTH },
    problem: { value: body.problem, required: true, maxLength: PROBLEM_MAX_LENGTH },
    // Present here only so a missing list is a 400 before authorization: without it, a non-author's
    // `[]` reads as a change to structured content and answers 403 instead.
    proposedSolutions: {
      value: Array.isArray(body.proposedSolutions)
        ? body.proposedSolutions.filter((entry) => typeof entry === 'string').join('')
        : '',
      required: true,
    },
    impactRationale: {
      value: body.impactRationale,
      required: true,
      maxLength: IMPACT_RATIONALE_MAX_LENGTH,
    },
    priority: { value: body.priority, required: true },
  }
}

/** A task's body, on create and on update: the idea-only fields are not taken. */
function taskBodyRules(body: UpdateIdeaBody): Record<string, FieldRules> {
  return {
    title: { value: body.title, required: true, maxLength: TITLE_MAX_LENGTH },
    description: { value: body.description, maxLength: DESCRIPTION_MAX_LENGTH },
  }
}

function taskFields(body: UpdateIdeaBody): CreateBoardTaskCommand {
  return {
    title: body.title ?? '',
    description: optional(body.description),
    assigneeUserIds: guidList(body.assigneeUserIds),
    tagNames: stringList('tagNames', body.tagNames),
  }
}

/** The create fields the board route and the pool route share. */
function newIdeaFields(body: CreateIdeaBody) {
  return {
    title: body.title ?? '',
    description: optional(body.description),
    problem: body.problem ?? '',
    proposedSolutions: stringList('proposedSolutions', body.proposedSolutions) ?? [],
    impactRationale: body.impactRationale ?? '',
    priority: body.priority ?? '',
    ideaTypeId: guidOrEmpty(body.ideaTypeId),
    businessImpactId: guidOrEmpty(body.businessImpactId),
    dueDate: optional(body.dueDate),
    assigneeUserIds: guidList(body.assigneeUserIds),
    tagNames: stringList('tagNames', body.tagNames),
    mentionEmails: stringList('mentionEmails', body.mentionEmails),
    fieldValues: fieldValues(body.fieldValues),
    ...effortField(body),
  }
}

/** `effort` on the update is three-state: an absent key is left out so the stored estimate is
 * untouched, an explicit `null` clears it, and anything else goes to the service to be parsed
 * (a non-string becomes text that no level matches, so it is a field-keyed 400). */
function effortField(body: UpdateIdeaBody): { effort?: string | null } {
  if (!('effort' in body) || body.effort === undefined) {
    return {}
  }
  return { effort: body.effort === null ? null : String(body.effort) }
}

/** `sprintId` on the board list: a GUID, or the literal `none` for the backlog. */
function sprintFilter(value: unknown): { sprintId: string | null; noSprint: boolean } {
  const text = optional(value)
  if (text === null) {
    return { sprintId: null, noSprint: false }
  }
  return text.toLowerCase() === 'none'
    ? { sprintId: null, noSprint: true }
    : { sprintId: guidOrEmpty(text), noSprint: false }
}

/** The organization list's repeatable `boardId`: GUIDs, and the literal `none` for no board. */
function boardFilter(value: unknown): { boardIds: readonly string[]; includeNoBoard: boolean } {
  const values = queryList(value)
  const isNone = (entry: string) => entry.toLowerCase() === 'none'
  return {
    boardIds: values.filter((entry) => !isNone(entry)).map(guidOrEmpty),
    includeNoBoard: values.some(isNone),
  }
}

/**
 * `fieldFilters[<fieldDefinitionId>]=<value>` (T059), read straight off the query string.
 *
 * .NET did the same by hand rather than model-binding a `Dictionary<Guid, string>`, and its
 * comment says why: that binder treats EVERY query key as a dictionary entry and 500s trying to
 * parse `page`, `search` and the rest as GUIDs. Keys whose inner text is not a GUID are skipped,
 * exactly as `Guid.TryParse` skipped them; a repeated key joins its values with a comma, which is
 * what `StringValues.ToString()` produced.
 *
 * The key is the TRIMMED inner text, because `Guid.TryParse` accepted surrounding whitespace and
 * then keyed the dictionary by the parsed `Guid` - so `fieldFilters[ <uuid> ]` applied the filter
 * there, and storing the padded text here would hand the Application layer an id that resolves
 * against nothing and silently drop it.
 *
 * **Express 5's default `simple` query parser is load-bearing here.** It leaves the literal key
 * `fieldFilters[<uuid>]` alone, which is the only reason the loop below can see it. Under
 * `extended` (the Express 4 default, and one `app.set('query parser', ...)` away) `qs` would fold
 * those keys into a NESTED OBJECT under `fieldFilters`, no key would carry the prefix, every field
 * filter would silently stop applying, and the endpoint would answer **200 with the wrong rows** -
 * no error anywhere. Do not change the query parser without rewriting this function.
 */
function parseFieldFilters(query: Record<string, unknown>): ReadonlyMap<string, string> | null {
  const prefix = 'fieldfilters['
  let filters: Map<string, string> | null = null
  for (const [key, value] of Object.entries(query)) {
    if (!key.toLowerCase().startsWith(prefix) || !key.endsWith(']')) {
      continue
    }
    const inner = key.slice(prefix.length, -1)
    if (!isGuid(inner)) {
      continue
    }
    const text = Array.isArray(value) ? value.join(',') : String(value)
    filters ??= new Map<string, string>()
    filters.set(inner.trim(), text)
  }
  return filters
}

/**
 * Idea lifecycle and upvotes (`SPEC/30-Contracts.md` "Idea Contracts" and "Upvote Contracts").
 *
 * **No controller prefix, deliberately.** These thirteen routes span three roots - `boards/...`,
 * `organizations/...` and `ideas/...` - because the .NET controller declared each path in full
 * rather than sharing one, and the golden corpus pins every one of them. A `@Controller('ideas')`
 * with relative paths would move six of the eleven.
 *
 * Authorization and scoping live in `IdeaService` and `UpvoteService` throughout: who may create,
 * who may move a card (a board setting, not a role), that deletion is administrative even for the
 * author, and that a direct Site Admin is refused where a View As session is not. Nothing here
 * branches on a role or an organization, and the caller's identity is never read - it reaches the
 * services through `CurrentUserContext`.
 */
@Controller()
@UseGuards(AuthGuard)
export class IdeasController {
  constructor(
    private readonly ideas: IdeaService,
    private readonly upvotes: UpvoteService,
  ) {}

  @Get('boards/:boardId/ideas')
  async listByBoard(
    @Param('boardId', UuidParamPipe) boardId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<IdeaPage<IdeaListItem>> {
    return this.ideas.listByBoard(boardId, {
      page: optionalInt(query.page),
      pageSize: optionalInt(query.pageSize),
      search: optional(query.search),
      statusIds: guidQueryList(query.statusId),
      tags: queryList(query.tag),
      priorities: queryList(query.priority),
      dueBefore: optional(query.dueBefore),
      ...sprintFilter(query.sprintId),
      hideFinal: queryBool(query.hideFinal),
      sortBy: optional(query.sortBy),
      sortDirection: optional(query.sortDirection),
    })
  }

  /** Cross-board, organization-scoped list for the global `/ideas` page. */
  @Get('organizations/:organizationId/ideas')
  async listByOrganization(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<IdeaPage<IdeaListItem>> {
    return this.ideas.listByOrganization(organizationId, {
      page: optionalInt(query.page),
      pageSize: optionalInt(query.pageSize),
      search: optional(query.search),
      scope: optional(query.scope),
      sortBy: optional(query.sortBy),
      sortDirection: optional(query.sortDirection),
      fieldFilters: parseFieldFilters(query),
      ...boardFilter(query.boardId),
      statusIds: guidQueryList(query.statusId),
      priorities: queryList(query.priority),
      tags: queryList(query.tag),
      phase: optional(query.phase),
      user: optionalGuid(query.user),
      ...sprintFilter(query.sprintId),
      hideFinal: queryBool(query.hideFinal),
    })
  }

  @Post('boards/:boardId/ideas')
  @HttpCode(201)
  async create(
    @Param('boardId', UuidParamPipe) boardId: string,
    @Body() body: CreateIdeaBody,
  ): Promise<CreateIdeaResult> {
    validateFields(ideaBodyRules(body))

    return this.ideas.create(boardId, {
      ...newIdeaFields(body),
      // `Guid?` here, not `Guid`: omitting it means "the board's left-most swimlane", which is not
      // the same request as naming a status that does not exist.
      statusId: optionalGuid(body.statusId),
    })
  }

  /** A task from the work board itself: with `parentIdeaId` the parent's `board-tasks` create,
   * without it a standalone card. */
  @Post('boards/:boardId/tasks')
  @HttpCode(201)
  async createBoardCard(
    @Param('boardId', UuidParamPipe) boardId: string,
    @Body() body: BoardCardBody,
  ): Promise<CreateIdeaResult> {
    validateFields(taskBodyRules(body))

    return this.ideas.createTaskOnBoard(boardId, {
      ...taskFields(body),
      parentIdeaId: optionalGuid(body.parentIdeaId),
      sprintId: optionalGuid(body.sprintId),
    })
  }

  /** A task on the board the parent's lane references. The body is `title`, `description`,
   * `assigneeUserIds` and `tagNames`; anything else sent is ignored, as on the other routes here. */
  @Post('ideas/:ideaId/board-tasks')
  @HttpCode(201)
  async createBoardTask(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Body() body: CreateIdeaBody,
  ): Promise<CreateIdeaResult> {
    validateFields(taskBodyRules(body))

    return this.ideas.createBoardTask(ideaId, taskFields(body))
  }

  /** The parent's tasks in creation order. */
  @Get('ideas/:ideaId/board-tasks')
  async listBoardTasks(
    @Param('ideaId', UuidParamPipe) ideaId: string,
  ): Promise<readonly BoardTaskListItem[]> {
    return this.ideas.listBoardTasks(ideaId)
  }

  /** Deletes the task card; the parent's counts and lock follow. */
  @Delete('ideas/:ideaId/board-tasks/:taskId')
  @HttpCode(204)
  async deleteBoardTask(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Param('taskId', UuidParamPipe) taskId: string,
  ): Promise<void> {
    await this.ideas.deleteBoardTask(ideaId, taskId)
  }

  /** An idea with no board. The body is the board create's minus `statusId`, which is ignored if
   * sent: the status is the organization's first active one. */
  @Post('organizations/:organizationId/ideas')
  @HttpCode(201)
  async createInPool(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: CreateIdeaBody,
  ): Promise<CreateIdeaResult> {
    validateFields(ideaBodyRules(body))

    return this.ideas.createInPool(organizationId, newIdeaFields(body))
  }

  /** Creates an idea with no board and promotes it in the same commit (an Issue added directly).
   * The pool create's body plus `effort` and `sprintId`; `statusId` is ignored. Validation runs
   * inside the service, after authorization, as the contract orders them. */
  @Post('organizations/:organizationId/issues')
  @HttpCode(201)
  async addIssue(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: AddIssueBody,
  ): Promise<CreateIdeaResult> {
    return this.ideas.addIssue(organizationId, () => {
      validateFields(ideaBodyRules(body))
      return {
        ...newIdeaFields(body),
        effort: optional(body.effort) ?? '',
        sprintId: optionalGuid(body.sprintId),
      }
    })
  }

  @Get('ideas/:ideaId')
  async getById(@Param('ideaId', UuidParamPipe) ideaId: string): Promise<IdeaDetail> {
    return this.ideas.getById(ideaId)
  }

  @Get('ideas/:ideaId/activity')
  async activity(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<Page<IdeaActivityEntry>> {
    return this.ideas.listActivity(ideaId, {
      page: optionalInt(query.page),
      pageSize: optionalInt(query.pageSize),
    })
  }

  @Put('ideas/:ideaId')
  async update(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Body() body: UpdateIdeaBody,
  ): Promise<IdeaDetail> {
    // A task takes only its four fields; the idea-only ones are ignored, not validated.
    if (await this.ideas.isTask(ideaId)) {
      validateFields(taskBodyRules(body))
      return this.ideas.updateTask(ideaId, taskFields(body))
    }

    validateFields(ideaBodyRules(body))

    return this.ideas.update(ideaId, {
      title: body.title ?? '',
      description: optional(body.description),
      problem: body.problem ?? '',
      proposedSolutions: stringList('proposedSolutions', body.proposedSolutions) ?? [],
      impactRationale: body.impactRationale ?? '',
      priority: body.priority ?? '',
      ideaTypeId: guidOrEmpty(body.ideaTypeId),
      businessImpactId: guidOrEmpty(body.businessImpactId),
      dueDate: optional(body.dueDate),
      assigneeUserIds: guidList(body.assigneeUserIds),
      tagNames: stringList('tagNames', body.tagNames),
      mentionEmails: stringList('mentionEmails', body.mentionEmails),
      fieldValues: fieldValues(body.fieldValues),
      ...effortField(body),
    })
  }

  /** The only path that changes an idea's type after creation, and it is admin-only. */
  @Put('organizations/:organizationId/ideas/:ideaId/idea-type')
  @HttpCode(204)
  async reassignIdeaType(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Body() body: ReassignIdeaTypeBody,
  ): Promise<void> {
    await this.ideas.reassignIdeaType(organizationId, ideaId, guidOrEmpty(body.ideaTypeId))
  }

  /** Replaces the item's blocker set; `[]` clears it. */
  @Put('ideas/:ideaId/blocked-by')
  @HttpCode(200)
  async setBlockedBy(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Body() body: SetBlockedByBody,
  ): Promise<IdeaDetail> {
    const ideaIds = guidList(body.ideaIds)
    if (ideaIds === null) {
      throw new ValidationError('One or more fields are invalid.', {
        ideaIds: ['Provide the complete blocker set; use an empty list to clear it.'],
      })
    }
    return this.ideas.setBlockedBy(ideaId, ideaIds)
  }

  @Post('ideas/:ideaId/status')
  @HttpCode(204)
  async changeStatus(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Body() body: ChangeIdeaStatusBody,
  ): Promise<void> {
    await this.ideas.changeStatus(ideaId, {
      statusId: guidOrEmpty(body.statusId),
      forceReason: optional(body.forceReason),
    })
  }

  /** Removes an idea from its board; it joins the organization's pool. Idempotent. */
  @Delete('ideas/:ideaId/board')
  @HttpCode(204)
  async detachFromBoard(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Body() body: DetachFromBoardBody | undefined,
  ): Promise<void> {
    await this.ideas.detachFromBoard(ideaId, optional(body?.forceReason))
  }

  /** Soft delete. Administrative even for the idea's own author - the corpus pins that. */
  @Delete('ideas/:ideaId')
  @HttpCode(204)
  async delete(@Param('ideaId', UuidParamPipe) ideaId: string): Promise<void> {
    await this.ideas.delete(ideaId)
  }

  /**
   * The one route on this controller that is not `IdeaService`. .NET reached toggling through
   * `IIdeaService`; the conversion gave upvotes their own feature, so the path is unchanged and
   * only the service behind it moved.
   */
  @Post('ideas/:ideaId/upvote/toggle')
  @HttpCode(200)
  async toggleUpvote(@Param('ideaId', UuidParamPipe) ideaId: string): Promise<UpvoteToggleResult> {
    return this.upvotes.toggle(ideaId)
  }

  /**
   * The board's active ideas as a CSV download.
   *
   * Headers are set AFTER the service call, not with `@Header()` decorators, because those run
   * before the handler: a 403 or 404 from `exportBoardIdeas` would then carry a stale
   * `content-disposition` the .NET response never had. `content-type` is `text/csv` with no
   * charset, exactly as recorded - Express appends one to a string body, which is why this returns
   * a `StreamableFile` over a Buffer rather than the text.
   *
   * The leading UTF-8 BOM is .NET's, and it is there so Excel opens accented text correctly. It
   * does not show up in the recorded fixture body because a BOM is consumed by the UTF-8 decode
   * that both the capture and the replay read the response through.
   */
  @Get('boards/:boardId/ideas/export')
  async exportCsv(
    @Param('boardId', UuidParamPipe) boardId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const csv = await this.ideas.exportBoardIdeas(boardId)

    response.setHeader('Content-Type', 'text/csv')
    response.setHeader(
      'Content-Disposition',
      "attachment; filename=ideas.csv; filename*=UTF-8''ideas.csv",
    )
    return new StreamableFile(Buffer.from(`﻿${writeCsv(csv.headers, csv.rows)}`, 'utf8'))
  }

  /**
   * Create-only CSV import onto a board. Rows are rejected individually and reported in the
   * response, so a file with one bad row still imports the rest and answers 200; a missing, empty
   * or over-long file is a 400, and one over the body limit is a 413 from the pipeline below.
   *
   * Idea import requires a View As session where user import does not
   * (`SPEC/50-typescript-migration.md`, C2's note). That rule lives in `IdeaService` - bulk create
   * is still create, and the CSV path was the bypass that moved the guard server-side (rule 26) -
   * so nothing here enforces or bypasses it.
   */
  @Post('boards/:boardId/ideas/import')
  @HttpCode(200)
  // The body bound in full: multer aborts an upload over the limit at the pipeline and Nest turns
  // that into a `413`, so the handler is never handed an oversized buffer and has no size check of
  // its own to make. `SPEC/30-Contracts.md` documents the 413 for both CSV imports.
  @UseInterceptors(FileInterceptor('csvFile', { limits: { fileSize: MAX_IMPORT_BYTES } }))
  async importCsv(
    @Param('boardId', UuidParamPipe) boardId: string,
    @UploadedFile() csvFile: { buffer?: Buffer } | undefined,
  ): Promise<IdeaImportResult> {
    const buffer = csvFile?.buffer
    if (buffer === undefined || buffer.length === 0) {
      // The kernel error, not `RequestValidationError`: .NET threw `ValidationAppException` here
      // rather than failing model binding, so this renders with a `traceId` and no charset.
      throw new ValidationError('One or more fields are invalid.', {
        csvFile: ['A CSV file is required.'],
      })
    }

    // Bounded HERE rather than during import: the upload is buffered into a string and then
    // re-materialised as parsed records before any per-row work happens.
    const rows = parseIdeaImportCsv(buffer.toString('utf8'))
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new ValidationError('One or more fields are invalid.', {
        csvFile: [
          `The file has ${rows.length} rows, which is more than the ${MAX_IMPORT_ROWS} this import supports. Split it into smaller files.`,
        ],
      })
    }

    return this.ideas.importBoardIdeas(boardId, rows)
  }
}
