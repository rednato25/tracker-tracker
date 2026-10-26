// src/lib/rank-goals.ts
//
// P09: deterministic rank-goal evaluator. It knows nothing about the browser,
// database or tracker requests. Free-text class requirements stay readable;
// only explicitly structured definitions are evaluated.

import type {
  RuleFreshness,
  RuleSource,
  TrackerRankPath,
  TrackerUserClass,
} from "@/data/tracker-registry"
import { buildRankForest, buildRankLadder } from "@/lib/rank-ladder"

export type RankMetric =
  | "accountRatio"
  | "uploadedBytes"
  | "downloadedBytes"
  | "bufferBytes"
  | "seedingCount"
  | "seedbonus"
  | "accountAgeDays"
  | "uploads"
  | "snatched"
  | "forumPosts"
  | "hitAndRuns"

export type RankComparison = "gte" | "lte" | "gt" | "lt" | "eq"
export type RankGoalStatus = "met" | "unmet" | "unknown"

export interface RankNumericCondition {
  kind: "numeric"
  id?: string
  metric: RankMetric
  comparison: RankComparison
  requiredValue: number
  /** Rank conditions are account-level; per-torrent rules stay separate. */
  scope?: "account" | "per-torrent"
  label?: string
  /** "unresolved" keeps the value visible but prevents a met/unmet claim. */
  verification?: "verified" | "unresolved"
  note?: string
}

export interface RankManualCondition {
  kind: "manual" | "non-numeric"
  id?: string
  label: string
  description?: string
}

export type RankConditionNode =
  | RankNumericCondition
  | RankManualCondition
  | RankRequirementGroup

export interface RankRequirementGroup {
  mode: "all" | "any"
  conditions: RankConditionNode[]
}

export interface RankObservation {
  value: number | null
  freshness: RuleFreshness
  source: RuleSource
  observedAt?: string | null
  note?: string
}

export type RankObservationMap = Partial<Record<RankMetric, RankObservation>>

export interface RankConditionResult {
  id: string
  kind: "numeric" | "manual" | "non-numeric"
  metric?: RankMetric
  label: string
  requiredValue: number | null
  observedValue: number | null
  status: RankGoalStatus
  freshness: RuleFreshness | "unknown"
  source: RuleSource | "unknown"
  /** Meaningful for gte/lte only; null for equality/ordering ambiguity. */
  remaining: number | null
  reason: string
}

export interface RankGroupResult {
  mode: "all" | "any"
  status: RankGoalStatus
  conditions: (RankConditionResult | RankGroupResult)[]
  progress: { met: number; unmet: number; unknown: number; total: number }
}

export interface RankGoalEvaluation {
  currentRank: string | null
  nextRank: string | null
  nextRankReason: string | null
  freeTextRequirement: string | null
  status: RankGoalStatus | "no-next-rank" | "appointed" | "no-structured-goal"
  structuredRequirement: RankGroupResult | null
  progress: { met: number; unmet: number; unknown: number; total: number }
  /** Informational only. Promotion always remains an external/manual decision. */
  eligible: boolean
  /** Explicit guard against treating eligibility as an observed rank change. */
  promotionApplied: false
}

export interface RankGoalInput {
  userClasses: TrackerUserClass[]
  rankPaths?: TrackerRankPath[]
  currentRank: string | null
  observations: RankObservationMap
  now: Date
  joinedAt?: string | null
  structuredGoals?: Record<string, RankRequirementGroup>
}

const EMPTY_PROGRESS = { met: 0, unmet: 0, unknown: 0, total: 0 }

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function observationFor(
  metric: RankMetric,
  input: RankGoalInput
): RankObservation | null {
  const provided = input.observations[metric]
  if (provided) return provided
  if (metric !== "accountAgeDays") return null
  if (!input.joinedAt) return null
  const joined = new Date(input.joinedAt)
  if (Number.isNaN(joined.getTime())) return null
  const age = Math.max(0, Math.floor((input.now.getTime() - joined.getTime()) / 86_400_000))
  return {
    value: age,
    freshness: "fresh",
    source: "snapshot",
    observedAt: input.joinedAt,
    note: "Derived from the stored join date and the injected clock.",
  }
}

function compare(value: number, comparison: RankComparison, required: number): boolean {
  switch (comparison) {
    case "gte":
      return value >= required
    case "lte":
      return value <= required
    case "gt":
      return value > required
    case "lt":
      return value < required
    case "eq":
      return value === required
  }
}

function remainingFor(
  value: number,
  comparison: RankComparison,
  required: number
): number | null {
  if (comparison === "gte") return Math.max(0, required - value)
  if (comparison === "lte") return Math.max(0, value - required)
  return null
}

function evaluateCondition(
  condition: RankNumericCondition | RankManualCondition,
  input: RankGoalInput,
  path: string
): RankConditionResult {
  const id = condition.id ?? path
  const label = condition.label ?? ("metric" in condition ? condition.metric : "Manual requirement")

  if (condition.kind !== "numeric") {
    return {
      id,
      kind: condition.kind,
      label,
      requiredValue: null,
      observedValue: null,
      status: "unknown",
      freshness: "unknown",
      source: "unknown",
      remaining: null,
      reason: "Manual or non-numeric condition cannot be evaluated from collected data.",
    }
  }

  if (condition.verification === "unresolved") {
    return {
      id,
      kind: "numeric",
      metric: condition.metric,
      label,
      requiredValue: condition.requiredValue,
      observedValue: observationFor(condition.metric, input)?.value ?? null,
      status: "unknown",
      freshness: observationFor(condition.metric, input)?.freshness ?? "unknown",
      source: observationFor(condition.metric, input)?.source ?? "unknown",
      remaining: null,
      reason:
        condition.note ??
        "The threshold or its unit is unresolved; this condition cannot establish eligibility.",
    }
  }

  if (condition.scope === "per-torrent") {
    return {
      id,
      kind: "numeric",
      metric: condition.metric,
      label,
      requiredValue: condition.requiredValue,
      observedValue: null,
      status: "unknown",
      freshness: "unknown",
      source: "unknown",
      remaining: null,
      reason: "Per-torrent requirement is separate from account rank data.",
    }
  }

  const observation = observationFor(condition.metric, input)
  if (!observation || !finite(observation.value)) {
    return {
      id,
      kind: "numeric",
      metric: condition.metric,
      label,
      requiredValue: condition.requiredValue,
      observedValue: null,
      status: "unknown",
      freshness: observation?.freshness ?? "unknown",
      source: observation?.source ?? "unknown",
      remaining: null,
      reason: "No observed value; missing data is not zero.",
    }
  }

  if (observation.freshness === "stale") {
    return {
      id,
      kind: "numeric",
      metric: condition.metric,
      label,
      requiredValue: condition.requiredValue,
      observedValue: observation.value,
      status: "unknown",
      freshness: "stale",
      source: observation.source,
      remaining: remainingFor(observation.value, condition.comparison, condition.requiredValue),
      reason: "Observation is stale; re-check before treating this condition as met.",
    }
  }

  const met = compare(observation.value, condition.comparison, condition.requiredValue)
  return {
    id,
    kind: "numeric",
    metric: condition.metric,
    label,
    requiredValue: condition.requiredValue,
    observedValue: observation.value,
    status: met ? "met" : "unmet",
    freshness: observation.freshness,
    source: observation.source,
    remaining: remainingFor(observation.value, condition.comparison, condition.requiredValue),
    reason: met
      ? "Observed value meets the structured requirement."
      : "Observed value does not meet the structured requirement.",
  }
}

export function evaluateRequirementGroup(
  group: RankRequirementGroup,
  input: RankGoalInput,
  path = "root"
): RankGroupResult {
  const results = group.conditions.map((condition, index) => {
    const childPath = `${path}.${index}`
    return "conditions" in condition
      ? evaluateRequirementGroup(condition, input, childPath)
      : evaluateCondition(condition, input, childPath)
  })

  const leafProgress = results.reduce(
    (progress, result) => {
      if ("conditions" in result) {
        progress.met += result.progress.met
        progress.unmet += result.progress.unmet
        progress.unknown += result.progress.unknown
        progress.total += result.progress.total
      } else {
        progress[result.status] += 1
        progress.total += 1
      }
      return progress
    },
    { ...EMPTY_PROGRESS }
  )

  let status: RankGoalStatus
  if (results.length === 0) {
    status = "unknown"
  } else if (group.mode === "all") {
    status = results.some((result) => result.status === "unmet")
      ? "unmet"
      : results.some((result) => result.status === "unknown")
        ? "unknown"
        : "met"
  } else {
    status = results.some((result) => result.status === "met")
      ? "met"
      : results.some((result) => result.status === "unknown")
        ? "unknown"
        : "unmet"
  }

  return { mode: group.mode, status, conditions: results, progress: leafProgress }
}

function nextRankFor(input: RankGoalInput): {
  nextRank: string | null
  reason: string | null
  status: RankGoalEvaluation["status"]
} {
  const forest = input.rankPaths?.length
    ? buildRankForest(input.userClasses, input.rankPaths, input.currentRank)
    : null
  const ladder = forest ? null : buildRankLadder(input.userClasses, input.currentRank)

  if (forest?.appointedClass || ladder?.appointedClass) {
    return {
      nextRank: null,
      reason: "Staff, donation or invitation class; not an earned next rank.",
      status: "appointed",
    }
  }
  if (forest?.unknownClass || ladder?.unknownClass) {
    return {
      nextRank: null,
      reason: "Reported class is not in the known ladder; no next rank is inferred.",
      status: "unknown",
    }
  }

  if (forest) {
    if (forest.activePathId) {
      const path = forest.paths.find((candidate) => candidate.id === forest.activePathId)
      const index = path?.currentIndex ?? -1
      if (path && index >= 0 && index < path.rungs.length - 1) {
        return { nextRank: path.rungs[index + 1].name, reason: null, status: "met" }
      }
      return {
        nextRank: null,
        reason: path ? "Top of the active rank branch." : "Active rank branch is unknown.",
        status: "no-next-rank",
      }
    }
    if (forest.sharedCurrentIndex >= 0 && forest.sharedCurrentIndex < forest.shared.length - 1) {
      return {
        nextRank: forest.shared[forest.sharedCurrentIndex + 1].name,
        reason: null,
        status: "met",
      }
    }
    if (forest.sharedCurrentIndex === forest.shared.length - 1) {
      return {
        nextRank: null,
        reason: "Ladder branches here; a branch is not selected automatically.",
        status: "no-next-rank",
      }
    }
    return {
      nextRank: null,
      reason: "Current rank is not on the shared ladder.",
      status: "unknown",
    }
  }

  if (!ladder) {
    return { nextRank: null, reason: "No rank ladder is defined.", status: "unknown" }
  }
  if (ladder.currentIndex < 0) {
    return {
      nextRank: null,
      reason: "Current rank is not an earned rung; no next rank is inferred.",
      status: "unknown",
    }
  }
  const next = ladder.rungs[ladder.currentIndex + 1]
  if (!next) {
    return { nextRank: null, reason: "Top of the known ladder.", status: "no-next-rank" }
  }
  return { nextRank: next.name, reason: null, status: "met" }
}

/**
 * Evaluate the next rank and personal goals. The observed current rank is never
 * changed: `eligible` is informational and promotion remains manual.
 */
export function evaluateRankGoal(input: RankGoalInput): RankGoalEvaluation {
  const next = nextRankFor(input)
  const freeTextRequirement =
    input.userClasses.find((userClass) => userClass.name === next.nextRank)?.requirements ?? null
  const structured = next.nextRank ? input.structuredGoals?.[next.nextRank] : undefined

  if (!next.nextRank) {
    return {
      currentRank: input.currentRank,
      nextRank: null,
      nextRankReason: next.reason,
      freeTextRequirement: null,
      status: next.status,
      structuredRequirement: null,
      progress: { ...EMPTY_PROGRESS },
      eligible: false,
      promotionApplied: false,
    }
  }

  if (!structured) {
    return {
      currentRank: input.currentRank,
      nextRank: next.nextRank,
      nextRankReason: next.reason,
      freeTextRequirement,
      status: "no-structured-goal",
      structuredRequirement: null,
      progress: { ...EMPTY_PROGRESS },
      eligible: false,
      promotionApplied: false,
    }
  }

  const result = evaluateRequirementGroup(structured, input)
  return {
    currentRank: input.currentRank,
    nextRank: next.nextRank,
    nextRankReason: next.reason,
    freeTextRequirement,
    status: result.status,
    structuredRequirement: result,
    progress: result.progress,
    eligible: result.status === "met",
    promotionApplied: false,
  }
}

export interface PersonalGoalResult {
  id: string
  result: RankGroupResult
}

export function evaluatePersonalGoals(
  goals: Record<string, RankRequirementGroup>,
  input: Omit<RankGoalInput, "structuredGoals">
): PersonalGoalResult[] {
  return Object.entries(goals).map(([id, group]) => ({
    id,
    result: evaluateRequirementGroup(group, { ...input, structuredGoals: undefined }, id),
  }))
}
