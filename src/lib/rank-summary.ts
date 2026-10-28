// src/lib/rank-summary.ts
//
// P26 dashboard summary. This is a projection of the existing P09 evaluator,
// P10 definitions and P11 saved target; it does not create a second rank model.

import { registryEntryFor } from "@/data/tracker-registry"
import { formatBytesNum, formatCount, formatRatio } from "@/lib/formatters"
import { isRedacted } from "@/lib/privacy"
import { 
  evaluateRankGoal,
  evaluateRequirementGroup,
  type RankConditionResult,
  type RankGoalInput,
  type RankGroupResult,
  type RankMetric,
  type RankObservationMap,rankDefinitionForSlug, type TrackerRankDefinition, } from "@/lib/rank-goals"
import { buildRankObservations } from "@/lib/rank-observations"
import type { TrackerSummary } from "@/types/api"

export interface RankSummaryCondition {
  label: string
  remaining: string | null
  reason: string | null
}

export interface RankGoalSummary {
  trackerId: number
  trackerName: string
  color: string
  currentRank: string | null
  currentRankHidden: boolean
  targetRank: string | null
  targetInvalid: boolean
  automaticNextRank: string | null
  status: "goal" | "no-target" | "unsupported"
  metCount: number
  unmetCount: number
  unknownCount: number
  unmet: RankSummaryCondition[]
  unknown: RankSummaryCondition[]
  linkLabel: string
  linkHref: string
}

function formatValue(metric: RankMetric | undefined, value: number | null): string {
  if (value === null || metric === undefined) return "Unknown"
  if (metric === "uploadedBytes" || metric === "downloadedBytes" || metric === "bufferBytes") {
    return formatBytesNum(value)
  }
  if (metric === "accountRatio") return formatRatio(value)
  if (metric === "accountAgeDays") return `${formatCount(value)} day${value === 1 ? "" : "s"}`
  return formatCount(value)
}

function flattenConditions(result: RankGroupResult | null): RankConditionResult[] {
  if (!result) return []
  return result.conditions.flatMap((condition) =>
    "conditions" in condition ? flattenConditions(condition) : [condition]
  )
}

function summarizeConditions(result: RankGroupResult | null): {
  met: number
  unmet: RankSummaryCondition[]
  unknown: RankSummaryCondition[]
} {
  const conditions = flattenConditions(result)
  return {
    met: conditions.filter((condition) => condition.status === "met").length,
    unmet: conditions
      .filter((condition) => condition.status === "unmet")
      .map((condition) => ({
        label: condition.label,
        remaining:
          condition.remaining === null
            ? null
            : formatValue(condition.metric, condition.remaining),
        reason: condition.reason || null,
      })),
    unknown: conditions
      .filter((condition) => condition.status === "unknown")
      .map((condition) => ({
        label: condition.label,
        remaining: null,
        reason: condition.reason || null,
      })),
  }
}

function buildSummary(
  tracker: TrackerSummary,
  pilot: TrackerRankDefinition,
  savedTarget: string | null,
  now: Date
): RankGoalSummary {
  const entry = registryEntryFor(tracker)
  const rawRank = tracker.latestStats?.group ?? null
  const currentRankHidden = Boolean(rawRank && isRedacted(rawRank))
  const currentRank = currentRankHidden ? null : rawRank
  const targetInvalid = Boolean(savedTarget && !pilot.goals[savedTarget])
  const target = savedTarget && !targetInvalid ? savedTarget : null
  const observation = buildRankObservations({ latestStats: tracker.latestStats, lastPolledAt: tracker.lastPolledAt, platformType: tracker.platformType, platformMeta: tracker.platformMeta, now })
  const input: RankGoalInput = {
    userClasses: entry?.userClasses ?? [],
    rankPaths: entry?.rankPaths,
    currentRank,
    observations: observation,
    now,
    joinedAt: tracker.joinedAt,
    structuredGoals: pilot.goals,
  }

  if (Object.keys(pilot.goals).length === 0) {
    return {
      trackerId: tracker.id,
      trackerName: tracker.name,
      color: tracker.color,
      currentRank,
      currentRankHidden,
      targetRank: null,
      targetInvalid: false,
      automaticNextRank: null,
      status: "unsupported",
      metCount: 0,
      unmetCount: 0,
      unknownCount: 0,
      unmet: [],
      unknown: [],
      linkLabel: "Open tracker",
      linkHref: `/trackers/${tracker.id}#rank-goal`,
    }
  }

  let result: RankGroupResult | null = null
  let automaticNextRank: string | null = null
  if (target) {
    result = evaluateRequirementGroup(pilot.goals[target], input)
  } else {
    const next = evaluateRankGoal(input)
    automaticNextRank = next.nextRank
    result = next.structuredRequirement
  }

  const counts = summarizeConditions(result)
  const progress = result?.progress ?? { met: 0, unmet: 0, unknown: 0, total: 0 }
  return {
    trackerId: tracker.id,
    trackerName: tracker.name,
    color: tracker.color,
    currentRank,
    currentRankHidden,
    targetRank: target,
    targetInvalid,
    automaticNextRank,
    status: target ? "goal" : "no-target",
    metCount: progress.met,
    unmetCount: progress.unmet,
    unknownCount: progress.unknown,
    unmet: counts.unmet,
    unknown: counts.unknown,
    linkLabel: target ? "Open rank goal" : "Choose a target",
    linkHref: `/trackers/${tracker.id}#rank-goal`,
  }
}

export function parseSavedRankGoals(
  raw: string | null | undefined
): Record<string, { targetRank: string }> {
  if (!raw) return {}
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
    const parsed: Record<string, { targetRank: string }> = {}
    for (const [trackerId, goal] of Object.entries(value)) {
      if (!/^[1-9]\d*$/.test(trackerId)) continue
      if (typeof goal !== "object" || goal === null || Array.isArray(goal)) continue
      const targetRank = (goal as { targetRank?: unknown }).targetRank
      if (typeof targetRank === "string" && targetRank.trim()) {
        parsed[trackerId] = { targetRank: targetRank.trim() }
      }
    }
    return parsed
  } catch {
    return {}
  }
}

export function buildRankGoalSummaries(
  trackers: TrackerSummary[],
  savedGoals: Record<string, { targetRank: string }>,
  now: Date
): RankGoalSummary[] {
  return trackers.flatMap((tracker) => {
    if (!tracker.isActive) return []
    const savedTarget = savedGoals[String(tracker.id)]?.targetRank ?? null
    const pilot = rankDefinitionForSlug(tracker.registrySlug)
    if (!pilot && !savedTarget) return []
    if (!pilot) {
      const raw = tracker.latestStats?.group ?? null
      const hidden = Boolean(raw && isRedacted(raw))
      return [
        {
          trackerId: tracker.id,
          trackerName: tracker.name,
          color: tracker.color,
          currentRank: hidden ? null : raw,
          currentRankHidden: hidden,
          targetRank: null,
          targetInvalid: Boolean(savedTarget),
          automaticNextRank: null,
          status: "unsupported" as const,
          metCount: 0,
          unmetCount: 0,
          unknownCount: 0,
          unmet: [],
          unknown: [],
          linkLabel: "Open tracker",
          linkHref: `/trackers/${tracker.id}#rank-goal`,
        },
      ]
    }
    return [buildSummary(tracker, pilot, savedTarget, now)]
  })
}
