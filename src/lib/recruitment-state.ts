// src/lib/recruitment-state.ts
//
// Persisted P18 wishlist state. Tracker references are registry slugs, never
// database ids, so backups/restores cannot point at a remapped row. Route and
// dataset references may become stale after a catalog update; the UI resolves
// them defensively and drops unknown links instead of crashing.

import { TRACKER_REGISTRY } from "@/data/tracker-registry"
import type { RankComparison, RankMetric } from "@/lib/rank-goals"

export const RECRUITMENT_STATE_VERSION = 1
export const RECRUITMENT_HIDDEN_PATHS_MAX = 200
export const RECRUITMENT_GOAL_LINKS_MAX = 100

const PATH_KEY_MAX = 512
const ROUTE_ID_MAX = 200
const CONDITION_ID_MAX = 120
const TARGET_RANK_MAX = 120

const METRICS: readonly RankMetric[] = [
  "accountRatio",
  "uploadedBytes",
  "downloadedBytes",
  "bufferBytes",
  "seedingCount",
  "seedbonus",
  "accountAgeDays",
  "uploads",
  "snatched",
  "forumPosts",
  "hitAndRuns",
]

const COMPARISONS: readonly RankComparison[] = ["gte", "lte", "gt", "lt", "eq"]

const registrySlugs = new Set(TRACKER_REGISTRY.map((tracker) => tracker.slug))

export interface RecruitmentGoalLink {
  routeId: string
  conditionId: string
  sourceTrackerSlug: string
  goalTrackerSlug: string
  targetRank: string
  metric: RankMetric
  comparison: RankComparison
  requiredValue: number
}

export interface RecruitmentState {
  version: typeof RECRUITMENT_STATE_VERSION
  desiredTrackerSlug: string | null
  hiddenPathKeys: string[]
  goalLinks: RecruitmentGoalLink[]
}

export function emptyRecruitmentState(): RecruitmentState {
  return {
    version: RECRUITMENT_STATE_VERSION,
    desiredTrackerSlug: null,
    hiddenPathKeys: [],
    goalLinks: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function boundedString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null
}

export function isRegistryTrackerSlug(value: unknown): value is string {
  return typeof value === "string" && registrySlugs.has(value)
}

export function isRankMetric(value: unknown): value is RankMetric {
  return typeof value === "string" && (METRICS as readonly string[]).includes(value)
}

export function isRankComparison(value: unknown): value is RankComparison {
  return typeof value === "string" && (COMPARISONS as readonly string[]).includes(value)
}

export function normalizeRecruitmentState(raw: unknown): RecruitmentState {
  let value: unknown = raw
  if (typeof raw === "string") {
    if (!raw.trim()) return emptyRecruitmentState()
    try {
      value = JSON.parse(raw)
    } catch {
      return emptyRecruitmentState()
    }
  }
  if (!isRecord(value)) return emptyRecruitmentState()

  const desiredTrackerSlug = isRegistryTrackerSlug(value.desiredTrackerSlug)
    ? value.desiredTrackerSlug
    : null

  const hiddenPathKeys: string[] = []
  if (Array.isArray(value.hiddenPathKeys)) {
    for (const entry of value.hiddenPathKeys) {
      const key = boundedString(entry, PATH_KEY_MAX)
      if (key && !hiddenPathKeys.includes(key)) hiddenPathKeys.push(key)
      if (hiddenPathKeys.length >= RECRUITMENT_HIDDEN_PATHS_MAX) break
    }
  }

  const goalLinks: RecruitmentGoalLink[] = []
  if (Array.isArray(value.goalLinks)) {
    for (const entry of value.goalLinks) {
      if (goalLinks.length >= RECRUITMENT_GOAL_LINKS_MAX) break
      if (!isRecord(entry)) continue
      const routeId = boundedString(entry.routeId, ROUTE_ID_MAX)
      const conditionId = boundedString(entry.conditionId, CONDITION_ID_MAX)
      const sourceTrackerSlug = isRegistryTrackerSlug(entry.sourceTrackerSlug)
        ? entry.sourceTrackerSlug
        : null
      const goalTrackerSlug = isRegistryTrackerSlug(entry.goalTrackerSlug)
        ? entry.goalTrackerSlug
        : null
      const targetRank = boundedString(entry.targetRank, TARGET_RANK_MAX)
      if (
        !routeId ||
        !conditionId ||
        !sourceTrackerSlug ||
        !goalTrackerSlug ||
        !targetRank ||
        !isRankMetric(entry.metric) ||
        !isRankComparison(entry.comparison) ||
        typeof entry.requiredValue !== "number" ||
        !Number.isFinite(entry.requiredValue)
      ) {
        continue
      }
      if (goalLinks.some((link) => link.routeId === routeId && link.conditionId === conditionId)) {
        continue
      }
      goalLinks.push({
        routeId,
        conditionId,
        sourceTrackerSlug,
        goalTrackerSlug,
        targetRank,
        metric: entry.metric,
        comparison: entry.comparison,
        requiredValue: entry.requiredValue,
      })
    }
  }

  return {
    version: RECRUITMENT_STATE_VERSION,
    desiredTrackerSlug,
    hiddenPathKeys,
    goalLinks,
  }
}

export function serializeRecruitmentState(state: RecruitmentState): string {
  return JSON.stringify(normalizeRecruitmentState(state))
}

export function recruitmentPathKey(routeIds: readonly string[]): string {
  return routeIds.join(">")
}

export function parseSavedRankGoals(raw: string | null): Record<string, { targetRank: string }> {
  if (!raw) return {}
  try {
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value)) return {}
    const parsed: Record<string, { targetRank: string }> = {}
    for (const [trackerId, goal] of Object.entries(value)) {
      if (!/^[1-9]\d*$/.test(trackerId) || !isRecord(goal)) continue
      const targetRank = boundedString(goal.targetRank, TARGET_RANK_MAX)
      if (targetRank) parsed[trackerId] = { targetRank }
    }
    return parsed
  } catch {
    return {}
  }
}
