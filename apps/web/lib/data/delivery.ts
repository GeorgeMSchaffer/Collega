/**
 * Sprints, issues, outcomes and the roadmap.
 *
 * The five delivery statuses are fixed and are NOT the org-configurable ideation statuses in
 * `./boards.ts` — two different sets that both read as "status", which is the confusion this
 * separation exists to prevent.
 */

import * as fixture from '../mock.js'
import { failIfRequested, resolve } from './latency.js'

export type { DeliveryStatus, Effort, Issue, Outcome, Sprint } from '../mock.js'

export async function getDeliveryStatuses(): Promise<fixture.DeliveryStatus[]> {
  failIfRequested('getDeliveryStatuses')
  return resolve(fixture.deliveryStatuses)
}

export async function getDeliveryStatus(id: string): Promise<fixture.DeliveryStatus | null> {
  return resolve(fixture.deliveryStatusById(id) ?? null)
}

export async function getSprints(): Promise<fixture.Sprint[]> {
  failIfRequested('getSprints')
  return resolve(fixture.sprints)
}

export async function getActiveSprint(): Promise<fixture.Sprint | null> {
  failIfRequested('getActiveSprint')
  return resolve(fixture.activeSprint)
}

export async function getSprint(id: string | null): Promise<fixture.Sprint | null> {
  return resolve(fixture.sprintById(id) ?? null)
}

export async function getIssues(): Promise<fixture.Issue[]> {
  failIfRequested('getIssues')
  return resolve(fixture.issues)
}

export async function getIssuesInSprint(sprintId: string): Promise<fixture.Issue[]> {
  failIfRequested('getIssuesInSprint')
  return resolve(fixture.issuesInSprint(sprintId))
}

export async function getBacklogIssues(): Promise<fixture.Issue[]> {
  failIfRequested('getBacklogIssues')
  return resolve(fixture.backlogIssues())
}

export async function getIssueByKey(key: string): Promise<fixture.Issue | null> {
  failIfRequested('getIssueByKey')
  return resolve(fixture.issueByKey(key) ?? null)
}

export async function getOutcomes(): Promise<fixture.Outcome[]> {
  failIfRequested('getOutcomes')
  return resolve(fixture.outcomes)
}

export async function getOutcome(id: string | null): Promise<fixture.Outcome | null> {
  return resolve(fixture.outcomeById(id) ?? null)
}

export async function getIssuesForOutcome(outcomeId: string): Promise<fixture.Issue[]> {
  return resolve(fixture.issuesForOutcome(outcomeId))
}
