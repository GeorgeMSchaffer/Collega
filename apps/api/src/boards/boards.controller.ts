import {
  type BoardDetail,
  type BoardListItem,
  BoardService,
  type CreateBoardResult,
  type IdeaMoveInput,
  type PullCandidatePage,
  type SwimlaneInput,
  type UpdateBoardResult,
} from '@collega/application/boards'
import { BOARD_NAME_MAX_LENGTH } from '@collega/domain/boards'
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import {
  type FieldRules,
  RequestValidationError,
  validateFields,
} from '../common/errors/request-validation.error.js'
import {
  optional,
  optionalGuid,
  optionalInt,
  queryBool,
  queryList,
} from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

/** One entry of a request's `swimlanes` array - `SwimlaneRequest` on the .NET side. */
type SwimlaneBody = {
  statusId?: string
  order?: number
  isFinal?: boolean
  referencesBoardId?: string | null
  autoCreateTask?: boolean
}

type CreateBoardBody = {
  name?: string
  description?: string | null
  allowUserStatusUpdate?: boolean
  swimlanes?: readonly SwimlaneBody[]
  keyPrefix?: string | null
  sprintsEnabled?: boolean
  ideaFeaturesEnabled?: boolean
  pullItemIds?: unknown
  forceReason?: unknown
  allowedIdeaTypeIds?: unknown
}

/** `PUT /boards/{boardId}/allowed-idea-types` (added 2026-10-22). */
type SetAllowedIdeaTypesBody = { ideaTypeIds?: unknown }

/** One entry of `PUT`'s `ideaMoves` (added 2026-09-29): a removed lane and where its ideas go. */
type IdeaMoveBody = { fromStatusId?: string; toStatusId?: string }

type UpdateBoardBody = CreateBoardBody & { ideaMoves?: readonly IdeaMoveBody[] }

/** `ReorderSwimlanesRequest` carries no validation attributes at all - only the swimlane list. */
type ReorderSwimlanesBody = { swimlanes?: readonly SwimlaneBody[] }

/**
 * The `[RequiredField]` / `[MaxLengthField]` pair that `CreateBoardRequest` and
 * `UpdateBoardRequest` share - identical field for field, and the only attributes either DTO
 * carries (`allowUserStatusUpdate` and `swimlanes` have none).
 *
 * The domain enforces the same length (`packages/domain/src/boards/board.ts`) and must keep doing
 * so: that check is the invariant, this one is the contract. They are not interchangeable - only
 * this one produces the model-binding envelope a DTO attribute produced, and the domain's judges
 * the trimmed value where `MaxLengthAttribute` judged the raw one.
 */
function boardBodyRules(body: CreateBoardBody): Record<string, FieldRules> {
  return {
    name: { value: body.name, required: true, maxLength: BOARD_NAME_MAX_LENGTH },
  }
}

/**
 * `description` as the command wants it: absent stays `undefined` (on `PUT`, "leave it alone"),
 * `null` stays `null`, and a string passes through for the domain to trim and length-check. The
 * body type is compile-time only, so anything else - a number, an object - is refused here rather
 * than stored as its string form.
 */
function toDescription(description: unknown): string | null | undefined {
  if (description === undefined || description === null || typeof description === 'string') {
    return description
  }
  throw new RequestValidationError({ description: ['Description must be a string.'] })
}

/**
 * `BoardsController.ToSwimlaneInputs` in full, including its `?? new List<SwimlaneRequest>()`:
 * an absent list is an empty one, which the Application layer then refuses for falling under the
 * two-swimlane minimum.
 *
 * Takes `unknown` because the body type is compile-time only and there is no `ValidationPipe` -
 * `{"swimlanes": "x"}` would otherwise reach `.map` and answer 500. A non-array is read as
 * absent, and a member with no `statusId` becomes `''`, which fails the Application layer's
 * status-subset check exactly as .NET's `Guid.Empty` default did.
 */
function toSwimlaneInputs(swimlanes: unknown): readonly SwimlaneInput[] {
  if (!Array.isArray(swimlanes)) {
    return []
  }
  return swimlanes.map((entry: SwimlaneBody | null | undefined) => ({
    statusId: typeof entry?.statusId === 'string' ? entry.statusId : '',
    // `int`, not `int?`, on the .NET record - an absent order bound to 0 rather than failing.
    order: typeof entry?.order === 'number' ? entry.order : 0,
    isFinal: entry?.isFinal === true,
    referencesBoardId:
      typeof entry?.referencesBoardId === 'string' ? entry.referencesBoardId : null,
    autoCreateTask: entry?.autoCreateTask === true,
  }))
}

/** As `toDescription`: absent stays `undefined` (on `PUT`, "leave it alone"), `null` clears. */
function toKeyPrefix(keyPrefix: unknown): string | null | undefined {
  if (keyPrefix === undefined || keyPrefix === null || typeof keyPrefix === 'string') {
    return keyPrefix
  }
  throw new RequestValidationError({ keyPrefix: ['Key prefix must be a string.'] })
}

/** A flag the body did not send stays `undefined`, which leaves the stored value (or default). */
function toFlag(name: string, value: unknown): boolean | undefined {
  if (value === undefined || typeof value === 'boolean') {
    return value
  }
  throw new RequestValidationError({ [name]: [`${name} must be true or false.`] })
}

/**
 * `ideaMoves` read the way `toSwimlaneInputs` reads `swimlanes`: a non-array is none, and a member
 * missing an id carries `''`, which the Application layer refuses as naming no removed lane or no
 * kept one. Whether the moves are right for this board is the Application layer's question.
 */
function toIdeaMoves(moves: unknown): readonly IdeaMoveInput[] {
  if (!Array.isArray(moves)) {
    return []
  }
  return moves.map((entry: IdeaMoveBody | null | undefined) => ({
    fromStatusId: typeof entry?.fromStatusId === 'string' ? entry.fromStatusId : '',
    toStatusId: typeof entry?.toStatusId === 'string' ? entry.toStatusId : '',
  }))
}

/**
 * `pullItemIds`: absent or `null` pulls nothing. The body type is compile-time only, so anything
 * but an array of strings is refused here under the field's key; what the ids name, how many and
 * whether they repeat is the Application layer's.
 */
function toPullItemIds(value: unknown): readonly string[] {
  if (value === undefined || value === null) {
    return []
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new RequestValidationError({ pullItemIds: ['Pull item ids must be an array of ids.'] })
  }
  return value as readonly string[]
}

/**
 * An allowed-idea-types list (SPEC/contracts/boards.md "Allowed idea types"): anything but an array
 * of strings is refused here under `field`; whether each string is an id, repeats, or names an
 * active idea type is the Application layer's. Absent or `null` is empty only where `absentMeansAll`
 * (on create); the replace route needs the array.
 */
function toIdeaTypeIds(field: string, value: unknown, absentMeansAll: boolean): readonly string[] {
  if (absentMeansAll && (value === undefined || value === null)) {
    return []
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new RequestValidationError({ [field]: ['Idea type ids must be an array of ids.'] })
  }
  return value as readonly string[]
}

/**
 * Board configuration (SPEC/30-Contracts.md "Board Contracts").
 *
 * `@Controller()` carries no prefix on purpose. The .NET controller declared a full path on every
 * action rather than a `[Route]` prefix, so list and create hang off `organizations/{id}/boards`
 * while detail, update and reorder hang off `boards/{id}` - two different nouns from one class.
 * The golden corpus pins both, so a prefix here would move five routes.
 *
 * Authorization lives in `BoardService` throughout: read is open to any member of the
 * organization, create admits an Org Admin or a User, update/archive/reorder are Org Admin only,
 * and a Site Admin acting directly is
 * refused in favour of View As. None of that is decided here, and nothing here reads a
 * credential - identity reaches the service through `CurrentUserContext`.
 */
@Controller()
@UseGuards(AuthGuard)
export class BoardsController {
  constructor(private readonly boards: BoardService) {}

  @Get('organizations/:organizationId/boards')
  async list(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Query('includeArchived') includeArchived: unknown,
  ): Promise<readonly BoardListItem[]> {
    return this.boards.list(organizationId, { includeArchived: queryBool(includeArchived) })
  }

  /**
   * The pull picker's read (SPEC/contracts/boards.md). Declared beside the list rather than under
   * `boards/:boardId`, so it cannot be mistaken for a board id.
   */
  @Get('organizations/:organizationId/boards/pull-candidates')
  async pullCandidates(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<PullCandidatePage> {
    return this.boards.listPullCandidates(organizationId, {
      source: optional(query.source),
      excludeBoardId: optionalGuid(query.excludeBoardId),
      search: optional(query.search)?.trim() ?? null,
      tags: queryList(query.tag),
      authorUserId: optionalGuid(query.authorUserId),
      page: optionalInt(query.page),
      pageSize: optionalInt(query.pageSize),
    })
  }

  @Post('organizations/:organizationId/boards')
  @HttpCode(201)
  async create(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: CreateBoardBody,
  ): Promise<CreateBoardResult> {
    validateFields(boardBodyRules(body))

    return this.boards.create(organizationId, {
      name: body.name ?? '',
      description: toDescription(body.description),
      // A .NET `bool` (not `bool?`): an absent value bound to false.
      allowUserStatusUpdate: body.allowUserStatusUpdate === true,
      swimlanes: toSwimlaneInputs(body.swimlanes),
      keyPrefix: toKeyPrefix(body.keyPrefix),
      sprintsEnabled: toFlag('sprintsEnabled', body.sprintsEnabled),
      ideaFeaturesEnabled: toFlag('ideaFeaturesEnabled', body.ideaFeaturesEnabled),
      pullItemIds: toPullItemIds(body.pullItemIds),
      forceReason: optional(body.forceReason),
      allowedIdeaTypeIds: toIdeaTypeIds('allowedIdeaTypeIds', body.allowedIdeaTypeIds, true),
    })
  }

  @Get('boards/:boardId')
  async getById(@Param('boardId', UuidParamPipe) boardId: string): Promise<BoardDetail> {
    return this.boards.getById(boardId)
  }

  @Put('boards/:boardId')
  async update(
    @Param('boardId', UuidParamPipe) boardId: string,
    @Body() body: UpdateBoardBody,
  ): Promise<UpdateBoardResult> {
    validateFields(boardBodyRules(body))

    return this.boards.update(boardId, {
      name: body.name ?? '',
      description: toDescription(body.description),
      allowUserStatusUpdate: body.allowUserStatusUpdate === true,
      swimlanes: toSwimlaneInputs(body.swimlanes),
      keyPrefix: toKeyPrefix(body.keyPrefix),
      sprintsEnabled: toFlag('sprintsEnabled', body.sprintsEnabled),
      ideaFeaturesEnabled: toFlag('ideaFeaturesEnabled', body.ideaFeaturesEnabled),
      ideaMoves: toIdeaMoves(body.ideaMoves),
      pullItemIds: toPullItemIds(body.pullItemIds),
      forceReason: optional(body.forceReason),
    })
  }

  /**
   * Replaces the idea types the board takes (added 2026-10-22). Who may is the Application layer's:
   * an Org Admin, or the board's creator.
   */
  @Put('boards/:boardId/allowed-idea-types')
  async setAllowedIdeaTypes(
    @Param('boardId', UuidParamPipe) boardId: string,
    @Body() body: SetAllowedIdeaTypesBody | undefined,
  ): Promise<BoardDetail> {
    return this.boards.setAllowedIdeaTypes(boardId, {
      ideaTypeIds: toIdeaTypeIds('ideaTypeIds', body?.ideaTypeIds, false),
    })
  }

  /**
   * Drag-and-drop persists immediately, so this answers 204 rather than returning the board.
   * No `validateFields` call: `ReorderSwimlanesRequest` declares no attributes, and the rule that
   * a reorder must name exactly the board's current swimlanes is the Application layer's.
   */
  @Post('boards/:boardId/swimlanes/reorder')
  @HttpCode(204)
  async reorderSwimlanes(
    @Param('boardId', UuidParamPipe) boardId: string,
    @Body() body: ReorderSwimlanesBody,
  ): Promise<void> {
    await this.boards.reorderSwimlanes(boardId, {
      swimlanes: toSwimlaneInputs(body.swimlanes),
    })
  }

  /**
   * Archive in place of delete (added 2026-09-27). Both answer 204 whether or not anything
   * changed - archiving an archived board, or unarchiving an active one, is not an error.
   */
  @Post('boards/:boardId/archive')
  @HttpCode(204)
  async archive(@Param('boardId', UuidParamPipe) boardId: string): Promise<void> {
    await this.boards.archive(boardId)
  }

  @Post('boards/:boardId/unarchive')
  @HttpCode(204)
  async unarchive(@Param('boardId', UuidParamPipe) boardId: string): Promise<void> {
    await this.boards.unarchive(boardId)
  }
}
