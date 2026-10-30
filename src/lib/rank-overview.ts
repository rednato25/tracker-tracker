// src/lib/rank-overview.ts
//
// P41 dashboard rank overview. One projection per active tracker: the saved or
// next automatic class, every condition with its observed and required value,
// honest unknown reasons, source provenance and the ladder classes. No new rank
// model is introduced; this reads the registry and the P09 evaluator.

import { registryEntryFor, type TrackerRegistryEntry } from "@/data/tracker-registry"
import { formatBytesNum, formatCount, formatRatio } from "@/lib/formatters"
import { isRedacted } from "@/lib/privacy"
import {
  evaluateRankGoal,
  evaluateRequirementGroup,
  type RankConditionResult,
  type RankGoalInput,
  type RankGoalStatus,
  type RankGroupResult,
  type RankMetric,
  type RankObservationMap,
  type RankRequirementGroup,
} from "@/lib/rank-goals"
import { hasAutomaticClassAbove, ladderPosition } from "@/lib/rank-ladder"
import { buildRankObservations } from "@/lib/rank-observations"
import type { TrackerSummary } from "@/types/api"

export const UNKNOWN_COLLECTED = "Not collected for this tracker"
export const UNKNOWN_UNSUPPORTED = "Not a supported metric"

export type RankUnknownReason = typeof UNKNOWN_COLLECTED | typeof UNKNOWN_UNSUPPORTED

/** Metrics the observation builder can ever supply for an account. */
const SUPPORTED_METRICS = new Set<RankMetric>([
  "accountRatio",
  "uploadedBytes",
  "downloadedBytes",
  "bufferBytes",
  "seedingCount",
  "seedbonus",
  "accountAgeDays",
  "uploads",
  "hitAndRuns",
])

export interface RankOverviewCondition {
  id: string
  requirement: string
  current: string
  required: string
  status: RankGoalStatus
  unknownReason: RankUnknownReason | null
  reason: string | null
  metric: RankMetric | null
}

export interface RankOverviewClass {
  name: string
  requirements: string | null
  outsideLadder: "above" | "below" | null
  isCurrent: boolean
  isTarget: boolean
}

export interface RankOverviewSource {
  title: string | null
  url: string | null
  verification: "published" | "unresolved" | "missing"
  accessedAt: string | null
  note: string | null
}

export interface RankOverview {
  trackerId: number
  trackerName: string
  color: string
  siteUrl: string
  currentClass: string | null
  currentClassHidden: boolean
  targetClass: string | null
  targetKind: "saved" | "automatic" | null
  targetReached: boolean
  reachedTarget: string | null
  highestAutomatic: boolean
  hasStructuredRules: boolean
  ruleText: string | null
  conditions: RankOverviewCondition[]
  classes: RankOverviewClass[]
  source: RankOverviewSource
}

function caseInsensitiveClass(
  entry: TrackerRegistryEntry | undefined,
  name: string | null | undefined
): { name: string; requirements?: string; structured?: RankRequirementGroup } | null {
  if (!entry || !name || isRedacted(name)) return null
  const wanted = name.toLowerCase()
  return entry.userClasses.find((userClass) => userClass.name.toLowerCase() === wanted) ?? null
}

function formatValue(metric: RankMetric | null, value: number | null): string {
  if (value === null || metric === null) return "\u2014"
  if (metric === "uploadedBytes" || metric === "downloadedBytes" || metric === "bufferBytes") {
    return formatBytesNum(value)
  }
  if (metric === "accountRatio") return formatRatio(value)
  if (metric === "accountAgeDays") return `${formatCount(value)} day${value === 1 ? "" : "s"}`
  return formatCount(value)
}

function flattenConditions(result: RankGroupResult): RankConditionResult[] {
  return result.conditions.flatMap((condition) =>
    "conditions" in condition ? flattenConditions(condition) : [condition]
  )
}

function unknownReasonFor(condition: RankConditionResult): RankUnknownReason | null {
  if (condition.status !== "unknown" || condition.freshness === "stale") return null
  if (condition.kind !== "numeric") return UNKNOWN_UNSUPPORTED
  if (condition.scope === "per-torrent" || condition.verification === "unresolved") {
    return UNKNOWN_UNSUPPORTED
  }
  if (!condition.metric || !SUPPORTED_METRICS.has(condition.metric)) return UNKNOWN_UNSUPPORTED
  return UNKNOWN_COLLECTED
}

function toCondition(condition: RankConditionResult): RankOverviewCondition {
  const metric = condition.metric ?? null
  return {
    id: condition.id,
    requirement: condition.label,
    current: formatValue(metric, condition.observedValue),
    required: formatValue(metric, condition.requiredValue),
    status: condition.status,
    unknownReason: unknownReasonFor(condition),
    reason: condition.reason || null,
    metric,
  }
}

function siteUrlFor(tracker: TrackerSummary, entry: TrackerRegistryEntry | undefined): string {
  const raw = entry?.url || tracker.baseUrl
  return raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`
}

function sourceFor(entry: TrackerRegistryEntry | undefined): RankOverviewSource {
  const source = entry?.rankRequirementsSource
  if (!source) {
    return {
      title: null,
      url: null,
      verification: "missing",
      accessedAt: null,
      note: null,
    }
  }
  return {
    title: source.title,
    url: source.url,
    verification: source.verification,
    accessedAt: source.accessedAt,
    note: source.note,
  }
}

function buildOne(
  tracker: TrackerSummary,
  savedTargetRank: string | null,
  now: Date
): RankOverview {
  const entry = registryEntryFor(tracker)
  const rawRank = tracker.latestStats?.group ?? null
  const currentClassHidden = Boolean(rawRank && isRedacted(rawRank))
  const currentClass = currentClassHidden ? null : rawRank
  const observations: RankObservationMap = buildRankObservations({
    latestStats: tracker.latestStats,
    lastPolledAt: tracker.lastPolledAt,
    platformType: tracker.platformType,
    platformMeta: tracker.platformMeta,
    now,
  })
  const structuredGoals: Record<string, RankRequirementGroup> = {}
  for (const userClass of entry?.userClasses ?? []) {
    if (userClass.structured) structuredGoals[userClass.name] = userClass.structured
  }
  const input: RankGoalInput = {
    userClasses: entry?.userClasses ?? [],
    rankPaths: entry?.rankPaths,
    currentRank: currentClass,
    observations,
    now,
    joinedAt: tracker.joinedAt,
    structuredGoals,
  }
  const evaluation = evaluateRankGoal(input)
  const automaticNextClass = evaluation.nextRank

  const savedClass = caseInsensitiveClass(entry, savedTargetRank)
  const currentPosition = ladderPosition(entry?.userClasses ?? [], currentClass)
  const savedPosition = savedClass ? ladderPosition(entry?.userClasses ?? [], savedClass.name) : null
  const savedTargetReached = Boolean(
    savedClass &&
      currentPosition !== null &&
      savedPosition !== null &&
      savedPosition <= currentPosition
  )
  const targetClass = savedTargetReached
    ? (automaticNextClass ?? savedClass?.name ?? null)
    : (savedClass?.name ?? automaticNextClass)
  const targetKind =
    targetClass === null
      ? null
      : savedClass && targetClass === savedClass.name && !savedTargetReached
        ? "saved"
        : targetClass === automaticNextClass
          ? "automatic"
          : "saved"
  const focusClass = caseInsensitiveClass(entry, targetClass)
  const result = focusClass?.structured
    ? evaluateRequirementGroup(focusClass.structured, input)
    : null
  const conditions = result
    ? flattenConditions(result).map((condition) => toCondition(condition))
    : []

  return {
    trackerId: tracker.id,
    trackerName: tracker.name,
    color: tracker.color,
    siteUrl: siteUrlFor(tracker, entry),
    currentClass,
    currentClassHidden,
    targetClass,
    targetKind,
    targetReached: savedTargetReached,
    reachedTarget: savedTargetReached ? (savedClass?.name ?? null) : null,
    highestAutomatic:
      (evaluation.status === "no-next-rank" || evaluation.status === "appointed") &&
      !hasAutomaticClassAbove(entry?.userClasses ?? [], entry?.rankPaths, currentClass),
    hasStructuredRules: Boolean(focusClass?.structured),
    ruleText: focusClass?.requirements ?? null,
    conditions,
    classes: (entry?.userClasses ?? []).map((userClass) => ({
      name: userClass.name,
      requirements: userClass.requirements ?? null,
      outsideLadder: userClass.outsideLadder ?? null,
      isCurrent:
        !currentClassHidden &&
        currentClass !== null &&
        userClass.name.toLowerCase() === currentClass.toLowerCase(),
      isTarget: targetClass !== null && userClass.name.toLowerCase() === targetClass.toLowerCase(),
    })),
    source: sourceFor(entry),
  }
}

export function buildRankOverviews(
  trackers: TrackerSummary[],
  savedGoals: Record<string, { targetRank: string }>,
  now: Date
): RankOverview[] {
  return trackers.flatMap((tracker) => {
    if (!tracker.isActive) return []
    return [buildOne(tracker, savedGoals[String(tracker.id)]?.targetRank ?? null, now)]
  })
}
