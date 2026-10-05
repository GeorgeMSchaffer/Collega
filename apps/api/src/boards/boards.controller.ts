import {
  type BoardDetail,
  type BoardListItem,
  BoardService,
  type CreateBoardResult,
  type IdeaMoveInput,
  type SwimlaneInput,
} from '@collega/application/boards'
import { BOARD_NAME_MAX_LENGTH } from '@collega/domain/boards'
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import {
  type FieldRules,
  RequestValidationError,
  validateFields,
} from '../common/errors/request-validation.error.js'
import { queryBool } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

/** One entry of a request's `swimlanes` array - `SwimlaneRequest` on the .NET side. */
type SwimlaneBody = { statusId?: string; order?: number }

type CreateBoardBody = {
  name?: string
  description?: string | null
  allowUserStatusUpdate?: boolean
  swimlanes?: readonly SwimlaneBody[]
}

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
  }))
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
  ): Promise<BoardDetail> {
    validateFields(boardBodyRules(body))

    return this.boards.update(boardId, {
      name: body.name ?? '',
      description: toDescription(body.description),
      allowUserStatusUpdate: body.allowUserStatusUpdate === true,
      swimlanes: toSwimlaneInputs(body.swimlanes),
      ideaMoves: toIdeaMoves(body.ideaMoves),
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
