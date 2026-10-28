// src/lib/recruitment-wishlist.ts
//
// P18 view-model builder. It reuses the P17 catalog and evaluator; it does not
// duplicate requirement logic. Actual observations are used only for source
// accounts the user already owns. Every other step is an explicit scenario.

import { getTrackerBySlug } from "@/data/tracker-registry"
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
  maxPathsPerSource?: number
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

function trackerName(slug: string): string {
  return getTrackerBySlug(slug)?.name ?? slug
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
      value: stats.ratioIsInfinite ? null : stats.ratio,
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

  const ownedBySlug = new Map<string, TrackerSummary>()
  const unsupportedOwnedTrackers: TrackerSummary[] = []
  for (const tracker of trackers) {
    if (!tracker.registrySlug) {
      unsupportedOwnedTrackers.push(tracker)
      continue
    }
    if (!ownedBySlug.has(tracker.registrySlug)) ownedBySlug.set(tracker.registrySlug, tracker)
  }
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
  const paths: WishlistPathView[] = []
  let truncated = false

  if (!desiredTrackerSlug || desiredOwned) {
    return {
      paths,
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
      maxPathsPerSource
    )
    for (const path of sourcePaths) {
      if (paths.length >= maxTotal) {
        truncated = true
        break
      }
      const key = recruitmentPathKey(path.routeIds)
      const steps: WishlistStepView[] = []
      for (const routeId of path.routeIds) {
        const route = catalog.routes.find((candidate) => candidate.id === routeId)
        if (!route) continue
        const owner = ownedBySlug.get(route.sourceTrackerId) ?? null
        const evaluation = evaluateRecruitmentRoute(catalog, routeId, {
          observations: owner ? observationMap(owner, now) : {},
          joinedAt: owner?.joinedAt ?? null,
          now,
        })
        if (!evaluation) continue
        steps.push({
          routeId,
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
            catalog,
            route,
            evaluation,
            sourceTracker: owner,
            savedRankGoals,
          }),
        })
      }
      if (steps.length !== path.routeIds.length) continue
      const summary = summarizePath(steps)
      paths.push({
        key,
        routeIds: path.routeIds,
        steps,
        status: summary.status,
        statusDetail: summary.detail,
        hidden: hidden.has(key),
      })
    }
    if (truncated) break
  }

  paths.sort((a, b) => a.steps.length - b.steps.length || a.key.localeCompare(b.key))

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
