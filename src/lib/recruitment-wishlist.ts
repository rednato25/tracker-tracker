// src/lib/recruitment-wishlist.ts
//
// P18 view-model builder. It reuses the P17 catalog and evaluator; it does not
// duplicate requirement logic. Actual observations are used only for source
// accounts the user already owns. Every other step is an explicit scenario.

import { pathwaysTrackerIdForRegistrySlug, pathwaysTrackerName } from "@/data/pathways/catalog"
import type {
  RankComparison,
  RankConditionNode,
  RankConditionResult,
  RankGroupResult,
  RankMetric,
  RankNumericCondition,
  RankObservationMap,
  RankRequirementGroup,
} from "@/lib/rank-goals"
import { rankDefinitionForSlug } from "@/lib/rank-goals"
import {
  evaluateRecruitmentRoute,
  findRecruitmentPaths,
  type RecruitmentCatalog,
  type RecruitmentRouteEvaluation,
  type RecruitmentRouteRecord,
} from "@/lib/recruitment-routes"
import {
  type RecruitmentGoalLink,
  type RecruitmentState,
  recruitmentPathKey,
} from "@/lib/recruitment-state"
import type { TrackerSummary } from "@/types/api"

const OBSERVATION_STALE_MS = 24 * 60 * 60 * 1000

export interface GoalLinkCandidate {
  routeId: string
  conditionId: string
  sourceTrackerSlug: string
  goalTrackerSlug: string
  targetRank: string
  metric: RankMetric
  comparison: RankComparison
  requiredValue: number
}

export interface WishlistStepView {
  routeId: string
  sourceTrackerId: string
  destinationTrackerId: string
  sourceName: string
  destinationName: string
  ownedTrackerId: number | null
  scenario: boolean
  observationNote: string
  evaluation: RecruitmentRouteEvaluation
  goalCandidates: GoalLinkCandidate[]
}

export type WishlistPathStatus = "known-met" | "needs-verification" | "unmet" | "closed"

export interface WishlistPathView {
  key: string
  routeIds: string[]
  steps: WishlistStepView[]
  status: WishlistPathStatus
  statusDetail: string
  minimumDays: number | null
  /** Known wait for this path: remaining days on the owned first hop plus full later waits. */
  totalDaysRemaining: number | null
  hidden: boolean
}

export interface WishlistPathsInput {
  catalog: RecruitmentCatalog
  desiredTrackerSlug: string | null
  trackers: TrackerSummary[]
  savedRankGoals: Record<string, { targetRank: string }>
  state: RecruitmentState
  now: Date
  maxHops?: number
  /** Applied after the global fastest-first ranking, never during search. */
  maxPathsPerSource?: number
  /** Applied after the global fastest-first ranking, never during search. */
  maxTotal?: number
}

export interface WishlistPathsResult {
  paths: WishlistPathView[]
  truncated: boolean
  catalogHasDesired: boolean
  desiredOwned: boolean
  ownedSlugs: string[]
  unsupportedOwnedTrackers: TrackerSummary[]
}

export interface DirectDestinationView {
  destinationTrackerId: string
  destinationName: string
  sourceTrackerId: string
  sourceName: string
  requirementText: string | null
  waitLabel: string
  ready: boolean
  daysRemaining: number | null
  evaluation: RecruitmentRouteEvaluation
}

function trackerName(slug: string): string {
  return pathwaysTrackerName(slug)
}

function numericDefinitions(group: RankRequirementGroup | null): RankNumericCondition[] {
  if (!group) return []
  const out: RankNumericCondition[] = []
  const walk = (node: RankConditionNode) => {
    if ("conditions" in node) {
      for (const child of node.conditions) walk(child)
    } else if (node.kind === "numeric" && node.id) {
      out.push(node)
    }
  }
  walk(group)
  return out
}

function effectiveRequirements(
  catalog: RecruitmentCatalog,
  route: RecruitmentRouteRecord
): RankRequirementGroup | null {
  const override = catalog.overrides.find((candidate) => candidate.routeId === route.id)
  return override && "requirements" in override ? (override.requirements ?? null) : route.requirements
}

export function flattenRequirementResults(group: RankGroupResult | null): RankConditionResult[] {
  if (!group) return []
  const out: RankConditionResult[] = []
  const walk = (node: RankConditionResult | RankGroupResult) => {
    if ("conditions" in node) {
      for (const child of node.conditions) walk(child)
    } else {
      out.push(node)
    }
  }
  walk(group)
  return out
}

const NO_REQUIREMENT = /^(none|no requirements?|removed)$/i

/**
 * The readable requirement for a step. Route prose wins; when the route has no
 * prose, the source invite class is the only requirement text left. A source
 * gate belongs to the tracker being left, never the destination.
 */
export function stepRequirementText(step: WishlistStepView): string | null {
  const notes = step.evaluation.eligibility.requirementNotes
    .map((note) => note.trim())
    .filter((note) => note && !NO_REQUIREMENT.test(note))
  if (notes.length > 0) return notes.join(" · ")

  const gate = step.evaluation.eligibility.sourceRequirements.inviteGate
  if (!gate) return null
  return gate.text.split(":")[0]?.trim() || gate.text
}

export function stepHasUncheckedRequirements(step: WishlistStepView): boolean {
  if (stepRequirementText(step)) return true
  if (step.evaluation.eligibility.sourceRequirements.inviteGate) return true
  const structured = step.evaluation.eligibility.structured
  return structured !== null && structured.status !== "met"
}

export type StepWaitState = "ready" | "wait-done" | "waiting" | "unknown"

export function stepWaitState(step: WishlistStepView): StepWaitState {
  const gate = step.evaluation.timeGate
  if (gate.status === "open") {
    return stepHasUncheckedRequirements(step) ? "wait-done" : "ready"
  }
  return gate.status === "waiting" ? "waiting" : "unknown"
}

export function stepWaitStatus(step: WishlistStepView): string {
  const state = stepWaitState(step)
  if (state === "ready") return "Ready now"
  if (state === "wait-done") return "Wait done"
  if (state === "waiting") {
    const days = step.evaluation.timeGate.daysRemaining
    return days === null ? "Wait unknown" : `${days} day${days === 1 ? "" : "s"} left`
  }
  return "Wait unknown"
}

/**
 * "Ready now" needs both an elapsed wait and no other requirement text. A
 * completed wait with an unresolved requirement reads as "Wait done, needs …"
 * so the wait and the requirement cannot contradict each other.
 */
export function stepWaitLabel(step: WishlistStepView): string {
  const state = stepWaitState(step)
  const requirement = stepRequirementText(step)
  if (state === "ready") return "Ready now"
  if (state === "wait-done") {
    return requirement ? `Wait done, needs ${requirement}` : "Wait done, needs checking"
  }

  const status = stepWaitStatus(step)
  if (state === "unknown") {
    return requirement ? `Wait unknown · needs ${requirement}` : "Wait unknown"
  }
  if (requirement) return `${status} · needs ${requirement}`
  return stepHasUncheckedRequirements(step) ? `${status} · needs checking` : status
}

export function pathHasUncheckedRequirements(path: WishlistPathView): boolean {
  return path.steps.some(stepHasUncheckedRequirements)
}

export function pathWaitLabel(path: WishlistPathView): string {
  const days = path.totalDaysRemaining
  const unchecked = pathHasUncheckedRequirements(path)
  if (days === null) return unchecked ? "Wait unknown · needs checking" : "Wait unknown"
  if (days === 0) {
    if (!unchecked) return "Ready now"
    if (path.steps.length === 1) return stepWaitLabel(path.steps[0])
    return "Wait done · needs checking"
  }
  const left = `${days} day${days === 1 ? "" : "s"} left`
  return unchecked ? `${left} · needs checking` : left
}

function observationMap(tracker: TrackerSummary, now: Date): RankObservationMap {
  const stats = tracker.latestStats
  if (!stats) return {}
  const polled = tracker.lastPolledAt ? new Date(tracker.lastPolledAt) : null
  const freshness =
    polled && !Number.isNaN(polled.getTime()) && now.getTime() - polled.getTime() <= OBSERVATION_STALE_MS
      ? "fresh"
      : "stale"
  const source = "api" as const
  const observedAt = tracker.lastPolledAt
  return {
    accountRatio: {
      // Zero download with upload is the maximum possible ratio, not missing data.
      value: stats.ratioIsInfinite ? Number.POSITIVE_INFINITY : stats.ratio,
      freshness,
      source,
      observedAt,
    },
    uploadedBytes: {
      value: stats.uploadedBytes === null ? null : Number(stats.uploadedBytes),
      freshness,
      source,
      observedAt,
    },
    downloadedBytes: {
      value: stats.downloadedBytes === null ? null : Number(stats.downloadedBytes),
      freshness,
      source,
      observedAt,
    },
    bufferBytes: {
      value: stats.bufferBytes === null ? null : Number(stats.bufferBytes),
      freshness,
      source,
      observedAt,
    },
    seedingCount: { value: stats.seedingCount, freshness, source, observedAt },
    seedbonus: { value: stats.seedbonus, freshness, source, observedAt },
    hitAndRuns: { value: stats.hitAndRuns, freshness, source, observedAt },
  }
}

function goalCandidatesForStep(input: {
  catalog: RecruitmentCatalog
  route: RecruitmentRouteRecord
  evaluation: RecruitmentRouteEvaluation
  sourceTracker: TrackerSummary | null
  savedRankGoals: Record<string, { targetRank: string }>
}): GoalLinkCandidate[] {
  const sourceTracker = input.sourceTracker
  if (!sourceTracker?.registrySlug) return []
  const saved = input.savedRankGoals[String(sourceTracker.id)]?.targetRank
  if (!saved) return []
  const pilot = rankDefinitionForSlug(sourceTracker.registrySlug)
  const goal = pilot?.goals[saved]
  if (!goal) return []

  const routeDefinitions = new Map(
    numericDefinitions(effectiveRequirements(input.catalog, input.route)).map((condition) => [
      condition.id,
      condition,
    ])
  )
  const candidates: GoalLinkCandidate[] = []
  for (const result of flattenRequirementResults(input.evaluation.eligibility.structured)) {
    if (result.kind !== "numeric" || !result.metric || !result.id) continue
    const definition = routeDefinitions.get(result.id)
    if (
      !definition ||
      definition.verification === "unresolved" ||
      definition.scope === "per-torrent"
    ) {
      continue
    }
    const match = numericDefinitions(goal).find(
      (condition) =>
        condition.verification !== "unresolved" &&
        condition.scope !== "per-torrent" &&
        condition.metric === definition.metric &&
        condition.comparison === definition.comparison &&
        condition.requiredValue === definition.requiredValue
    )
    if (!match) continue
    candidates.push({
      routeId: input.route.id,
      conditionId: definition.id ?? result.id,
      sourceTrackerSlug: sourceTracker.registrySlug,
      goalTrackerSlug: sourceTracker.registrySlug,
      targetRank: saved,
      metric: definition.metric,
      comparison: definition.comparison,
      requiredValue: definition.requiredValue,
    })
  }
  return candidates
}

function summarizePath(steps: WishlistStepView[]): {
  status: WishlistPathStatus
  detail: string
} {
  const closedIndex = steps.findIndex((step) => step.evaluation.availability.status === "closed")
  if (closedIndex >= 0) {
    const step = steps[closedIndex]
    return {
      status: "closed",
      detail: `Closed at step ${closedIndex + 1}: ${step.sourceName} → ${step.destinationName}.`,
    }
  }

  const unmetIndex = steps.findIndex(
    (step) => !step.scenario && step.evaluation.eligibility.status === "unmet"
  )
  if (unmetIndex >= 0) {
    return {
      status: "unmet",
      detail: `A known requirement is unmet at step ${unmetIndex + 1}: ${steps[unmetIndex].sourceName} → ${steps[unmetIndex].destinationName}.`,
    }
  }

  if (steps.some((step) => step.evaluation.timeGate.status === "waiting")) {
    return {
      status: "needs-verification",
      detail: "The minimum time on a source tracker has not elapsed yet.",
    }
  }

  if (steps.some((step) => step.scenario)) {
    return {
      status: "needs-verification",
      detail: "One or more steps are scenarios because you do not own that source account.",
    }
  }

  if (
    steps.some(
      (step) =>
        step.evaluation.eligibility.status !== "met" ||
        step.evaluation.availability.status !== "open"
    )
  ) {
    return {
      status: "needs-verification",
      detail: "Some requirements or recruitment availability still need checking.",
    }
  }

  return {
    status: "known-met",
    detail: "All known requirements are satisfied; recruitment is still not guaranteed.",
  }
}

function totalDaysRemainingFor(steps: WishlistStepView[]): number | null {
  let total = 0
  for (const [index, step] of steps.entries()) {
    const gate = step.evaluation.timeGate
    const days =
      index === 0
        ? gate.status === "unknown"
          ? null
          : (gate.daysRemaining ?? 0)
        : gate.effectiveDays
    if (days === null) return null
    total += days
  }
  return total
}

function compareWishlistPaths(a: WishlistPathView, b: WishlistPathView): number {
  if ((a.totalDaysRemaining === null) !== (b.totalDaysRemaining === null)) {
    return a.totalDaysRemaining === null ? 1 : -1
  }
  if (
    a.totalDaysRemaining !== null &&
    b.totalDaysRemaining !== null &&
    a.totalDaysRemaining !== b.totalDaysRemaining
  ) {
    return a.totalDaysRemaining - b.totalDaysRemaining
  }
  return a.steps.length - b.steps.length || a.key.localeCompare(b.key)
}

function groupOwnedTrackers(trackers: TrackerSummary[]): {
  ownedBySlug: Map<string, TrackerSummary>
  unsupportedOwnedTrackers: TrackerSummary[]
} {
  const ownedBySlug = new Map<string, TrackerSummary>()
  const unsupportedOwnedTrackers: TrackerSummary[] = []
  for (const tracker of trackers) {
    const trackerId = pathwaysTrackerIdForRegistrySlug(tracker.registrySlug)
    if (!trackerId) {
      unsupportedOwnedTrackers.push(tracker)
      continue
    }
    if (!ownedBySlug.has(trackerId)) ownedBySlug.set(trackerId, tracker)
  }
  return { ownedBySlug, unsupportedOwnedTrackers }
}

function buildStepView(input: {
  catalog: RecruitmentCatalog
  route: RecruitmentRouteRecord
  owner: TrackerSummary | null
  savedRankGoals: Record<string, { targetRank: string }>
  now: Date
}): WishlistStepView | null {
  const { route, owner, now } = input
  const evaluation = evaluateRecruitmentRoute(input.catalog, route.id, {
    observations: owner ? observationMap(owner, now) : {},
    joinedAt: owner?.joinedAt ?? null,
    now,
  })
  if (!evaluation) return null

  return {
    routeId: route.id,
    sourceTrackerId: route.sourceTrackerId,
    destinationTrackerId: route.destinationTrackerId,
    sourceName: trackerName(route.sourceTrackerId),
    destinationName: trackerName(route.destinationTrackerId),
    ownedTrackerId: owner?.id ?? null,
    scenario: owner === null,
    observationNote: owner
      ? owner.latestStats
        ? `Evaluated from stored stats for your account (last poll ${owner.lastPolledAt ?? "unknown"}).`
        : "No stored stats for your account on this source; the requirement cannot be checked yet."
      : "Scenario only: you do not own an account on this source, so no personal observations are used.",
    evaluation,
    goalCandidates: goalCandidatesForStep({
      catalog: input.catalog,
      route,
      evaluation,
      sourceTracker: owner,
      savedRankGoals: input.savedRankGoals,
    }),
  }
}

function compareDirectDestinations(
  a: DirectDestinationView,
  b: DirectDestinationView
): number {
  if (a.ready !== b.ready) return a.ready ? -1 : 1
  const aDays = a.daysRemaining ?? Number.POSITIVE_INFINITY
  const bDays = b.daysRemaining ?? Number.POSITIVE_INFINITY
  if (aDays !== bDays) return aDays - bDays
  return (
    a.destinationName.localeCompare(b.destinationName) ||
    a.sourceName.localeCompare(b.sourceName)
  )
}

/**
 * One row per tracker reachable in one step from an owned account. The same
 * destination from two owned sources keeps the best row: ready first, then the
 * smaller wait, then source name. Closed routes and already-owned destinations
 * are not entry points.
 */
export function buildDirectDestinations(input: {
  catalog: RecruitmentCatalog
  trackers: TrackerSummary[]
  now: Date
}): {
  rows: DirectDestinationView[]
  unsupportedOwnedTrackers: TrackerSummary[]
} {
  const { ownedBySlug, unsupportedOwnedTrackers } = groupOwnedTrackers(input.trackers)
  const ownedIds = new Set(ownedBySlug.keys())
  const best = new Map<string, DirectDestinationView>()

  for (const [sourceTrackerId, owner] of ownedBySlug) {
    for (const route of input.catalog.routes) {
      if (route.sourceTrackerId !== sourceTrackerId) continue
      if (route.availability === "closed") continue
      if (ownedIds.has(route.destinationTrackerId)) continue
      const step = buildStepView({
        catalog: input.catalog,
        route,
        owner,
        savedRankGoals: {},
        now: input.now,
      })
      if (!step) continue

      const row: DirectDestinationView = {
        destinationTrackerId: route.destinationTrackerId,
        destinationName: step.destinationName,
        sourceTrackerId,
        sourceName: step.sourceName,
        requirementText: stepRequirementText(step),
        waitLabel: stepWaitStatus(step),
        ready: stepWaitState(step) === "ready",
        daysRemaining: step.evaluation.timeGate.daysRemaining,
        evaluation: step.evaluation,
      }
      const existing = best.get(row.destinationTrackerId)
      if (!existing || compareDirectDestinations(row, existing) < 0) {
        best.set(row.destinationTrackerId, row)
      }
    }
  }

  return {
    rows: [...best.values()].sort(compareDirectDestinations),
    unsupportedOwnedTrackers,
  }
}

export function buildWishlistPaths(input: WishlistPathsInput): WishlistPathsResult {
  const {
    catalog,
    desiredTrackerSlug,
    trackers,
    savedRankGoals,
    state,
    now,
    maxHops = 4,
    maxPathsPerSource = 5,
    maxTotal = 20,
  } = input

  const { ownedBySlug, unsupportedOwnedTrackers } = groupOwnedTrackers(trackers)
  const ownedSlugs = [...ownedBySlug.keys()]
  const desiredOwned = desiredTrackerSlug ? ownedBySlug.has(desiredTrackerSlug) : false
  const catalogHasDesired = desiredTrackerSlug
    ? catalog.routes.some(
        (route) =>
          route.sourceTrackerId === desiredTrackerSlug ||
          route.destinationTrackerId === desiredTrackerSlug
      )
    : false

  const hidden = new Set(state.hiddenPathKeys)
  const candidates: WishlistPathView[] = []
  let truncated = false

  if (!desiredTrackerSlug || desiredOwned) {
    return {
      paths: candidates,
      truncated,
      catalogHasDesired,
      desiredOwned,
      ownedSlugs,
      unsupportedOwnedTrackers,
    }
  }

  for (const sourceSlug of [...ownedBySlug.keys()].sort()) {
    const sourcePaths = findRecruitmentPaths(
      catalog.routes,
      sourceSlug,
      desiredTrackerSlug,
      maxHops,
      Number.POSITIVE_INFINITY
    )
    for (const path of sourcePaths) {
      const key = recruitmentPathKey(path.routeIds)
      const steps: WishlistStepView[] = []
      for (const routeId of path.routeIds) {
        const route = catalog.routes.find((candidate) => candidate.id === routeId)
        if (!route) continue
        const step = buildStepView({
          catalog,
          route,
          owner: ownedBySlug.get(route.sourceTrackerId) ?? null,
          savedRankGoals,
          now,
        })
        if (!step) continue
        steps.push(step)
      }
      if (steps.length !== path.routeIds.length) continue
      const summary = summarizePath(steps)
      let minimumDays: number | null = 0
      for (const step of steps) {
        const days = step.evaluation.timeGate.effectiveDays
        if (days === null) {
          minimumDays = null
          break
        }
        minimumDays += days
      }
      candidates.push({
        key,
        routeIds: path.routeIds,
        steps,
        status: summary.status,
        statusDetail: summary.detail,
        minimumDays,
        totalDaysRemaining: totalDaysRemainingFor(steps),
        hidden: hidden.has(key),
      })
    }
  }

  candidates.sort(compareWishlistPaths)

  const paths: WishlistPathView[] = []
  const pathsPerSource = new Map<string, number>()
  for (const path of candidates) {
    if (paths.length >= maxTotal) {
      truncated = true
      break
    }
    const source = path.steps[0]?.sourceTrackerId ?? ""
    const sourceCount = pathsPerSource.get(source) ?? 0
    if (sourceCount >= maxPathsPerSource) {
      truncated = true
      continue
    }
    paths.push(path)
    pathsPerSource.set(source, sourceCount + 1)
  }

  return {
    paths,
    truncated,
    catalogHasDesired,
    desiredOwned,
    ownedSlugs,
    unsupportedOwnedTrackers,
  }
}

export function goalLinkIsCurrent(
  link: RecruitmentGoalLink,
  candidate: GoalLinkCandidate
): boolean {
  return (
    link.routeId === candidate.routeId &&
    link.conditionId === candidate.conditionId &&
    link.sourceTrackerSlug === candidate.sourceTrackerSlug &&
    link.goalTrackerSlug === candidate.goalTrackerSlug &&
    link.targetRank === candidate.targetRank &&
    link.metric === candidate.metric &&
    link.comparison === candidate.comparison &&
    link.requiredValue === candidate.requiredValue
  )
}

export function upsertGoalLink(
  links: RecruitmentGoalLink[],
  candidate: GoalLinkCandidate
): RecruitmentGoalLink[] {
  const withoutOld = links.filter(
    (link) =>
      !(link.routeId === candidate.routeId && link.conditionId === candidate.conditionId)
  )
  return [...withoutOld, candidate]
}
