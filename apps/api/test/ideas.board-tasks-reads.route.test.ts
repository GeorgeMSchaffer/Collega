// `GET /ideas/{ideaId}/board-tasks`, `DELETE /ideas/{ideaId}/board-tasks/{taskId}` and the `effort`
// field on the two idea creates (slice 298), at the HTTP boundary. The controller is driven
// directly with a stand-in IdeaService; the rules themselves are the service's.

import type { IdeaService } from '@collega/application/ideas'
import type { UpvoteService } from '@collega/application/upvotes'
import { RequestMethod } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { IdeasController } from '../src/ideas/ideas.controller.js'
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from './route-metadata.js'

const PARENT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const TASK = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const GUID = 'c0000000-0000-4000-8000-000000000001'

const BODY = {
  title: 'An idea',
  problem: 'p',
  proposedSolutions: ['s'],
  impactRationale: 'r',
  priority: 'Medium',
  ideaTypeId: GUID,
  businessImpactId: GUID,
}

function controllerOver(seen: Record<string, unknown[]>): IdeasController {
  const record =
    (name: string) =>
    async (...args: unknown[]) => {
      seen[name] = args
      return []
    }
  const ideas = {
    listBoardTasks: record('list'),
    deleteBoardTask: record('delete'),
    create: record('create'),
    createInPool: record('pool'),
    update: record('update'),
  } as unknown as IdeaService
  return new IdeasController(ideas, {} as UpvoteService)
}

describe('board-tasks read and delete routing', () => {
  it('lists with GET ideas/:ideaId/board-tasks', async () => {
    const seen: Record<string, unknown[]> = {}
    const handler = IdeasController.prototype.listBoardTasks

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('ideas/:ideaId/board-tasks')
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET)
    await controllerOver(seen).listBoardTasks(PARENT)
    expect(seen.list).toEqual([PARENT])
  })

  it('deletes with DELETE ideas/:ideaId/board-tasks/:taskId answering 204', async () => {
    const seen: Record<string, unknown[]> = {}
    const handler = IdeasController.prototype.deleteBoardTask

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('ideas/:ideaId/board-tasks/:taskId')
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.DELETE)
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(204)
    await controllerOver(seen).deleteBoardTask(PARENT, TASK)
    expect(seen.delete).toEqual([PARENT, TASK])
  })
})

describe('effort on the idea creates and update', () => {
  it('hands effort to the board create and the pool create, absent when not sent', async () => {
    const seen: Record<string, unknown[]> = {}
    const controller = controllerOver(seen)

    await controller.create(GUID, { ...BODY, effort: 'High' })
    expect(commandOf(seen, 'create').effort).toBe('High')

    await controller.createInPool(GUID, BODY)
    expect(commandOf(seen, 'pool').effort).toBeUndefined()
  })

  it('passes a non-string effort on as text so the service refuses it', async () => {
    const seen: Record<string, unknown[]> = {}

    await controllerOver(seen).create(GUID, { ...BODY, effort: 5 })

    expect(commandOf(seen, 'create').effort).toBe('5')
  })
})

function commandOf(seen: Record<string, unknown[]>, name: string): { effort: unknown } {
  return (seen[name] ?? [])[1] as { effort: unknown }
}
