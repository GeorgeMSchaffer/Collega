import { ValidationError } from '@collega/application/common'
import {
  type CreateIdeaResult,
  type IdeaDetail,
  type IdeaFieldValueWrite,
  type IdeaImportResult,
  type IdeaListItem,
  type IdeaPage,
  IdeaService,
} from '@collega/application/ideas'
import { UpvoteService, type UpvoteToggleResult } from '@collega/application/upvotes'
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from '@collega/domain/ideas'
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
  isGuid,
  optional,
  optionalGuid,
  optionalInt,
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
  description?: string
  priority?: string
  ideaTypeId?: unknown
  businessImpactId?: unknown
  dueDate?: unknown
  assigneeUserIds?: unknown
  statusId?: unknown
  tagNames?: unknown
  mentionEmails?: unknown
  fieldValues?: unknown
}

/** `PUT /ideas/{ideaId}` - `UpdateIdeaRequest`: the create shape minus `statusId`. */
type UpdateIdeaBody = Omit<CreateIdeaBody, 'statusId'>

type ChangeIdeaStatusBody = { statusId?: unknown }

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
    description: { value: body.description, required: true, maxLength: DESCRIPTION_MAX_LENGTH },
    priority: { value: body.priority, required: true },
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
 * **No controller prefix, deliberately.** These eleven routes span three roots - `boards/...`,
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
      statusId: optionalGuid(query.statusId),
      tag: optional(query.tag),
      priority: optional(query.priority),
      dueBefore: optional(query.dueBefore),
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
      tag: optional(query.tag),
      phase: optional(query.phase),
      user: optionalGuid(query.user),
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
      title: body.title ?? '',
      description: body.description ?? '',
      priority: body.priority ?? '',
      ideaTypeId: guidOrEmpty(body.ideaTypeId),
      businessImpactId: guidOrEmpty(body.businessImpactId),
      dueDate: optional(body.dueDate),
      assigneeUserIds: guidList(body.assigneeUserIds),
      // `Guid?` here, not `Guid`: omitting it means "the board's left-most swimlane", which is not
      // the same request as naming a status that does not exist.
      statusId: optionalGuid(body.statusId),
      tagNames: stringList('tagNames', body.tagNames),
      mentionEmails: stringList('mentionEmails', body.mentionEmails),
      fieldValues: fieldValues(body.fieldValues),
    })
  }

  @Get('ideas/:ideaId')
  async getById(@Param('ideaId', UuidParamPipe) ideaId: string): Promise<IdeaDetail> {
    return this.ideas.getById(ideaId)
  }

  @Put('ideas/:ideaId')
  async update(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Body() body: UpdateIdeaBody,
  ): Promise<IdeaDetail> {
    validateFields(ideaBodyRules(body))

    return this.ideas.update(ideaId, {
      title: body.title ?? '',
      description: body.description ?? '',
      priority: body.priority ?? '',
      ideaTypeId: guidOrEmpty(body.ideaTypeId),
      businessImpactId: guidOrEmpty(body.businessImpactId),
      dueDate: optional(body.dueDate),
      assigneeUserIds: guidList(body.assigneeUserIds),
      tagNames: stringList('tagNames', body.tagNames),
      mentionEmails: stringList('mentionEmails', body.mentionEmails),
      fieldValues: fieldValues(body.fieldValues),
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

  @Post('ideas/:ideaId/status')
  @HttpCode(204)
  async changeStatus(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Body() body: ChangeIdeaStatusBody,
  ): Promise<void> {
    await this.ideas.changeStatus(ideaId, { statusId: guidOrEmpty(body.statusId) })
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
