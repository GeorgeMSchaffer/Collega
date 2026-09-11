import { type IssueTaskItem, IssueTaskService } from '@collega/application/issue-tasks'
import { IssueTaskState } from '@collega/domain/enums'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import { RequestValidationError } from '../common/errors/request-validation.error.js'
import { optional, optionalGuid, stringList } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

type IssueTaskBody = { title?: unknown; assigneeUserId?: unknown }

type ChangeIssueTaskStateBody = { state?: unknown }

type ReorderIssueTasksBody = { taskIds?: unknown }

/**
 * `state`, parsed because `IssueTaskService.changeState` takes the enum rather than the text. There
 * is no "no state" here - unlike the sprint list's filter this names the value to write, so absent
 * and unrecognised are the same refusal.
 */
function issueTaskState(value: unknown): IssueTaskState {
  const text = optional(value)
  const match =
    text === null
      ? undefined
      : Object.values(IssueTaskState).find((s) => s.toLowerCase() === text.trim().toLowerCase())
  if (!match) {
    throw new RequestValidationError({
      state: [`State must be one of: ${Object.values(IssueTaskState).join(', ')}.`],
    })
  }
  return match
}

/**
 * An Issue's task checklist (`SPEC/30-Contracts.md` "Issue Task Contracts",
 * `SPEC/20-feature-issues-and-delivery.md` "Tasks (Slice 1)").
 *
 * Nested under the Issue that owns them, because a task has no life outside it: no organization of
 * its own, no board, no scope. `IssueTaskService` resolves the parent Idea on every call and
 * authorizes against that, which is what keeps `ideas`' org scoping the single enforcement point -
 * and why a `taskId` whose parent is not `{ideaId}` answers 404 rather than 403. Reading is open to
 * anyone who can see the Issue; every mutation is the author, an assignee, or an in-scope admin,
 * and refuses a direct Site Admin.
 */
@Controller()
@UseGuards(AuthGuard)
export class IssueTasksController {
  constructor(private readonly tasks: IssueTaskService) {}

  @Get('ideas/:ideaId/tasks')
  async list(@Param('ideaId', UuidParamPipe) ideaId: string): Promise<readonly IssueTaskItem[]> {
    return this.tasks.list(ideaId)
  }

  /** Appends to the end of the checklist. On a `Discovery` item this is a 400 - a task list is a
   * delivery artifact, and an idea that has not been promoted does not have one. */
  @Post('ideas/:ideaId/tasks')
  @HttpCode(201)
  async create(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Body() body: IssueTaskBody,
  ): Promise<IssueTaskItem> {
    return this.tasks.create(ideaId, {
      title: optional(body.title) ?? '',
      assigneeUserId: optionalGuid(body.assigneeUserId),
    })
  }

  /**
   * Declared BEFORE `PUT /ideas/{ideaId}/tasks/{taskId}` and that is load-bearing: Nest registers a
   * controller's routes in method-declaration order, so with the parameterised route first
   * `.../tasks/order` would match it, `UuidParamPipe` would reject `order` as a malformed id, and
   * a reorder would answer 404.
   */
  @Put('ideas/:ideaId/tasks/order')
  @HttpCode(204)
  async reorder(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Body() body: ReorderIssueTasksBody,
  ): Promise<void> {
    // A partial or unknown id set is the domain's 400, keyed `taskIds`: every reading of a partial
    // list is a guess at what the caller meant, so it is refused rather than interpreted.
    await this.tasks.reorder(ideaId, stringList('taskIds', body.taskIds) ?? [])
  }

  @Put('ideas/:ideaId/tasks/:taskId')
  async update(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Param('taskId', UuidParamPipe) taskId: string,
    @Body() body: IssueTaskBody,
  ): Promise<IssueTaskItem> {
    return this.tasks.update(ideaId, taskId, {
      title: optional(body.title) ?? '',
      assigneeUserId: optionalGuid(body.assigneeUserId),
    })
  }

  /** `Done` stamps the completion fields and leaving it clears them. Tasks never gate the Issue's
   * own delivery status - it may be set to `Complete` with tasks outstanding. */
  @Put('ideas/:ideaId/tasks/:taskId/state')
  @HttpCode(204)
  async changeState(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Param('taskId', UuidParamPipe) taskId: string,
    @Body() body: ChangeIssueTaskStateBody,
  ): Promise<void> {
    await this.tasks.changeState(ideaId, taskId, issueTaskState(body.state))
  }

  /** Hard delete - a checklist step keeps no history beyond the completion stamps on its own row -
   * then the survivors are re-densified so `sortOrder` stays `0..n-1`. */
  @Delete('ideas/:ideaId/tasks/:taskId')
  @HttpCode(204)
  async delete(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Param('taskId', UuidParamPipe) taskId: string,
  ): Promise<void> {
    await this.tasks.delete(ideaId, taskId)
  }
}
