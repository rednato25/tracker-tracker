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
import {
  getTrackerBySlug,
  type TrackerRankRequirementsSource,
  type TrackerRegistryEntry,
} from "@/data/tracker-registry"
import { buildRankForest, buildRankLadder } from "@/lib/rank-ladder"
import {
  isManualValueStale,
  manualMetricLabel,
  type RankManualValues,
} from "@/lib/rank-manual-values"

export const RANK_METRICS = [
  "accountRatio",
  "uploadedBytes",
  "downloadedBytes",
  "bufferBytes",
  "seedingCount",
  "seedbonus",
  "seedSizeBytes",
  "seedingPoints",
  "averageSeedTimeSeconds",
  "accountAgeDays",
  "uploads",
  "snatched",
  "forumPosts",
  "hitAndRuns",
] as const

export type RankMetric = (typeof RANK_METRICS)[number]

export function isRankMetric(value: unknown): value is RankMetric {
  return typeof value === "string" && (RANK_METRICS as readonly string[]).includes(value)
}

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
  /** GB/TB text without a unit basis was read as the larger binary unit. */
  unitReading?: "conservative"
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
  comparison?: RankComparison
  scope?: "account" | "per-torrent"
  verification?: "verified" | "unresolved"
  label: string
  requiredValue: number | null
  observedValue: number | null
  status: RankGoalStatus
  freshness: RuleFreshness | "unknown"
  source: RuleSource | "unknown"
  /** When the observed value itself was read; null when not applicable. */
  observedAt?: string | null
  unitReading?: "conservative"
  /** True when the current value came from a user-entered manual value. */
  manual?: boolean
  manualEnteredAt?: string | null
  /** A manual value older than 14 days is still used, but marked. */
  manualStale?: boolean
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
  /** Used only when a metric has no observed value. */
  manualValues?: RankManualValues
  now: Date
  joinedAt?: string | null
  structuredGoals?: Record<string, RankRequirementGroup>
}

export interface TrackerRankDefinition {
  trackerSlug: string
  trackerName: string
  progression: "automatic" | "manual" | "mixed" | "unknown"
  source: TrackerRankRequirementsSource
  goals: Record<string, RankRequirementGroup>
  unresolved: string[]
}

/** Build a rank definition from the registry entry itself. */
export function rankDefinitionFor(
  entry: TrackerRegistryEntry | undefined
): TrackerRankDefinition | null {
  if (!entry?.rankRequirementsSource) return null
  const goals: Record<string, RankRequirementGroup> = {}
  for (const userClass of entry.userClasses) {
    if (userClass.structured) goals[userClass.name] = userClass.structured
  }
  return {
    trackerSlug: entry.slug,
    trackerName: entry.name,
    progression: entry.rankProgression ?? "unknown",
    source: entry.rankRequirementsSource,
    goals,
    unresolved: entry.rankUnresolved ?? [],
  }
}

export function rankDefinitionForSlug(
  slug: string | null | undefined
): TrackerRankDefinition | null {
  return rankDefinitionFor(slug ? getTrackerBySlug(slug) : undefined)
}
const EMPTY_PROGRESS = { met: 0, unmet: 0, unknown: 0, total: 0 }

function knownNumber(value: unknown): value is number {
  // Infinity is a real observation for an account ratio with zero download.
  // It is not missing data, and compare() handles it like any other number.
  return typeof value === "number" && !Number.isNaN(value)
}

function manualObservationFor(
  metric: RankMetric,
  input: RankGoalInput
): RankObservation | null {
  const manual = input.manualValues?.[metric]
  if (!manual) return null
  const stale = isManualValueStale(manual.enteredAt, input.now)
  return {
    value: manual.value,
    freshness: stale ? "stale" : "fresh",
    source: "manual",
    observedAt: manual.enteredAt,
    note: `Entered by you on ${manual.enteredAt}; the API does not report ${manualMetricLabel(metric)}.`,
  }
}

function observationFor(
  metric: RankMetric,
  input: RankGoalInput
): RankObservation | null {
  const provided = input.observations[metric]
  // A manual value is a fallback, never an override. An observed number wins,
  // including a stale one, because the policy is "observed values always win".
  if (provided && knownNumber(provided.value)) return provided

  if (metric === "accountAgeDays" && input.joinedAt) {
    const joined = new Date(input.joinedAt)
    if (!Number.isNaN(joined.getTime())) {
      const age = Math.max(0, Math.floor((input.now.getTime() - joined.getTime()) / 86_400_000))
      return {
        value: age,
        freshness: "fresh",
        source: "snapshot",
        observedAt: input.joinedAt,
        note: "Derived from the stored join date and the injected clock.",
      }
    }
  }

  return manualObservationFor(metric, input) ?? provided ?? null
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
      comparison: condition.comparison,
      scope: condition.scope,
      verification: condition.verification,
      unitReading: condition.unitReading,
      label,
      requiredValue: condition.requiredValue,
      observedValue: observationFor(condition.metric, input)?.value ?? null,
      status: "unknown",
      freshness: observationFor(condition.metric, input)?.freshness ?? "unknown",
      source: observationFor(condition.metric, input)?.source ?? "unknown",
      observedAt: observationFor(condition.metric, input)?.observedAt ?? null,
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
      comparison: condition.comparison,
      scope: condition.scope,
      verification: condition.verification,
      unitReading: condition.unitReading,
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
  if (!observation || !knownNumber(observation.value)) {
    return {
      id,
      kind: "numeric",
      metric: condition.metric,
      comparison: condition.comparison,
      scope: condition.scope,
      verification: condition.verification,
      unitReading: condition.unitReading,
      label,
      requiredValue: condition.requiredValue,
      observedValue: null,
      status: "unknown",
      freshness: observation?.freshness ?? "unknown",
      source: observation?.source ?? "unknown",
      observedAt: observation?.observedAt ?? null,
      remaining: null,
      reason: "No observed value is available.",
    }
  }

  const manual = observation.source === "manual"
  if (observation.freshness === "stale" && !manual) {
    return {
      id,
      kind: "numeric",
      metric: condition.metric,
      comparison: condition.comparison,
      scope: condition.scope,
      verification: condition.verification,
      unitReading: condition.unitReading,
      label,
      requiredValue: condition.requiredValue,
      observedValue: observation.value,
      status: "unknown",
      freshness: "stale",
      source: observation.source,
      observedAt: observation.observedAt ?? null,
      remaining: remainingFor(observation.value, condition.comparison, condition.requiredValue),
      reason: "Observation is stale; re-check before treating this condition as met.",
    }
  }

  const met = compare(observation.value, condition.comparison, condition.requiredValue)
  return {
    id,
    kind: "numeric",
    metric: condition.metric,
    comparison: condition.comparison,
    unitReading: condition.unitReading,
    label,
    requiredValue: condition.requiredValue,
    observedValue: observation.value,
    status: met ? "met" : "unmet",
    freshness: observation.freshness,
    source: observation.source,
    observedAt: observation.observedAt ?? null,
    manual,
    manualEnteredAt: manual ? (observation.observedAt ?? null) : undefined,
    manualStale: manual ? observation.freshness === "stale" : undefined,
    remaining: remainingFor(observation.value, condition.comparison, condition.requiredValue),
    reason: manual
      ? observation.freshness === "stale"
        ? "Manual value is older than 14 days and needs checking; no observed value is available."
        : "Manual value entered by you is used because no observed value is available."
      : met
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
