import { type DeliveryCard, IdeaService } from '@collega/application/ideas'
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import { optional, optionalGuid } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

/** `POST /ideas/{ideaId}/promote`. `effort` is required at the gate; `sprintId` null is the backlog. */
type PromoteIdeaBody = { effort?: unknown; sprintId?: unknown; note?: unknown }

type ChangeDeliveryStatusBody = { deliveryStatus?: unknown }

type AssignIssueToSprintBody = { sprintId?: unknown }

/**
 * The promotion gate and the delivery operations on an idea, plus the sprint-board/backlog query
 * (`SPEC/30-Contracts.md` "Delivery Contracts", `SPEC/20-feature-issues-and-delivery.md`
 * "API Endpoints").
 *
 * A second controller rather than four more methods on `IdeasController`: that one is pinned
 * route-for-route by the golden corpus and its header counts them, so keeping the new surface
 * separate leaves it reading as the recorded set. Both live in `IdeasModule` because both are
 * `IdeaService` - an Issue IS an Idea, the same row, so there is no second service to build.
 *
 * **No enum parsing here, deliberately.** `effort` and `deliveryStatus` reach the service as the
 * raw strings its own `parseEffort`/`parseDeliveryStatus` already judge, field-keyed. Re-checking
 * them in the controller would answer the same 400 twice with two different messages depending on
 * whether the value was blank or merely wrong - see `ideas.controller.ts`'s `ideaBodyRules` for the
 * case where the duplication IS wanted, which is a recorded .NET model-binding envelope these
 * routes have no counterpart to.
 *
 * Authorization and org scoping are `IdeaService`'s throughout: who may promote (author or in-scope
 * admin), who may move an Issue's delivery status (author, assignee, or in-scope admin), that
 * returning to Discovery and sprint assignment are admin-only, and that a direct Site Admin is
 * refused every one of these mutations. Nothing here branches on a role.
 */
@Controller()
@UseGuards(AuthGuard)
export class DeliveryController {
  constructor(private readonly ideas: IdeaService) {}

  /**
   * The promotion gate: Discovery -> Delivery, with the effort estimate and the upvote snapshot
   * recorded. Re-promoting an item already in Delivery answers 409.
   *
   * A `sprintId` that names no assignable sprint is a **400 keyed `sprintId`, not a 404**: the
   * route addresses the idea, which exists, and the sprint is a value in the body. Same reasoning
   * as any other body field that must reference an existing row.
   */
  @Post('ideas/:ideaId/promote')
  @HttpCode(204)
  async promote(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Body() body: PromoteIdeaBody,
  ): Promise<void> {
    await this.ideas.promote(ideaId, {
      effort: optional(body.effort) ?? '',
      // `null` is "the delivery backlog"; a present-but-malformed id becomes the empty GUID, which
      // resolves against no sprint and answers the same 400 a stale id does.
      sprintId: optionalGuid(body.sprintId),
      note: optional(body.note),
    })
  }

  /** Recovers a mis-promotion (admin-only). Tasks, `effort` and the promotion snapshot survive. */
  @Post('ideas/:ideaId/return-to-discovery')
  @HttpCode(204)
  async returnToDiscovery(@Param('ideaId', UuidParamPipe) ideaId: string): Promise<void> {
    await this.ideas.returnToDiscovery(ideaId)
  }

  /** One of the five fixed delivery statuses. On a Discovery item this is a 400, not a 409 - the
   * item is in the wrong phase for the operation, where a re-promote conflicts with a state it has
   * already reached. */
  @Put('ideas/:ideaId/delivery-status')
  @HttpCode(204)
  async changeDeliveryStatus(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Body() body: ChangeDeliveryStatusBody,
  ): Promise<void> {
    await this.ideas.changeDeliveryStatus(ideaId, {
      deliveryStatus: optional(body.deliveryStatus) ?? '',
    })
  }

  /** Pulls an Issue into a sprint, or back to the backlog with `null`. Admin-only. */
  @Put('ideas/:ideaId/sprint')
  @HttpCode(204)
  async assignToSprint(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Body() body: AssignIssueToSprintBody,
  ): Promise<void> {
    await this.ideas.assignToSprint(ideaId, { sprintId: optionalGuid(body.sprintId) })
  }

  /**
   * The sprint board and the delivery backlog, readable by every member of the organization.
   *
   * **Omitting `sprintId` reads the BACKLOG, not everything** - Delivery items with no sprint,
   * which is the list an admin pulls from. An unrecognised `deliveryStatus` is ignored rather than
   * refused, which is `IdeaService`'s own reading of the filter.
   */
  @Get('organizations/:organizationId/delivery')
  async listDelivery(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<readonly DeliveryCard[]> {
    return this.ideas.listDelivery(organizationId, {
      // `optionalGuid`, not `optional`: the raw text would reach a `uuid` column and answer 500.
      sprintId: optionalGuid(query.sprintId),
      deliveryStatus: optional(query.deliveryStatus),
    })
  }
}
