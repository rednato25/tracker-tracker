// src/lib/rank-summary.ts
//
// P26 dashboard summary. This is a projection of the existing P09 evaluator,
// P10 definitions and P11 saved target; it does not create a second rank model.

import { registryEntryFor } from "@/data/tracker-registry"
import {
  formatBytesNum,
  formatCount,
  formatRatio,
  formatSeedSize,
  formatSeedTime,
} from "@/lib/formatters"
import { isRedacted } from "@/lib/privacy"
import { 
  evaluateRankGoal,
  evaluateRequirementGroup,
  type RankComparison,
  type RankConditionResult,
  type RankGoalInput,
  type RankGoalStatus,
  type RankGroupResult,
  type RankMetric,
  rankDefinitionForSlug,
  type TrackerRankDefinition,
} from "@/lib/rank-goals"
import { hasAutomaticClassAbove, ladderPosition } from "@/lib/rank-ladder"
import type { RankManualValues, RankManualValuesByTracker } from "@/lib/rank-manual-values"
import { buildRankObservations } from "@/lib/rank-observations"
import type { TrackerSummary } from "@/types/api"

export interface RankSummaryCondition {
  label: string
  remaining: string | null
  reason: string | null
}

export interface RankSummaryBar {
  id: string
  label: string
  current: string
  required: string
  currentValue: number | null
  requiredValue: number
  comparison: RankComparison
  status: RankGoalStatus
  metric: RankMetric
}

/**
 * Why a card does or does not name a next class. Only "top" may say the highest
 * automatic class is reached; every other no-next state says what is missing.
 */
export type RankLadderState =
  | "next"
  | "top"
  | "branch"
  | "appointed"
  | "off-ladder"
  | "no-rank"
  | "no-ladder"

export interface RankGoalSummary {
  trackerId: number
  trackerName: string
  color: string
  currentRank: string | null
  currentRankHidden: boolean
  targetRank: string | null
  targetInvalid: boolean
  targetReached: boolean
  automaticNextRank: string | null
  nextRankName: string | null
  nextIsTextOnly: boolean
  highestAutomatic: boolean
  ladderState: RankLadderState
  status: "goal" | "no-target" | "unsupported"
  metCount: number
  unmetCount: number
  unknownCount: number
  unmet: RankSummaryCondition[]
  unknown: RankSummaryCondition[]
  bars: RankSummaryBar[]
  totalChecks: number
  distanceText: string | null
  nextRankRequirements: string | null
  linkLabel: string
  linkHref: string
}

function formatValue(metric: RankMetric | undefined, value: number | null): string {
  if (value === null || metric === undefined) return "Unknown"
  if (metric === "uploadedBytes" || metric === "downloadedBytes" || metric === "bufferBytes") {
    return formatBytesNum(value)
  }
  if (metric === "seedSizeBytes") return formatSeedSize(value)
  if (metric === "averageSeedTimeSeconds") return formatSeedTime(value)
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

function summarizeBars(result: RankGroupResult | null): RankSummaryBar[] {
  return flattenConditions(result)
    .filter(
      (condition) =>
        condition.kind === "numeric" &&
        condition.requiredValue !== null &&
        condition.metric !== undefined
    )
    .map((condition) => ({
      id: condition.id,
      label: condition.label,
      current: formatValue(condition.metric, condition.observedValue),
      required: formatValue(condition.metric, condition.requiredValue),
      currentValue: condition.observedValue,
      requiredValue: condition.requiredValue as number,
      comparison: condition.comparison ?? "gte",
      status: condition.status,
      metric: condition.metric as RankMetric,
    }))
}

function shortMetricLabel(bar: RankSummaryBar): string {
  switch (bar.metric) {
    case "uploadedBytes":
      return "upload"
    case "downloadedBytes":
      return "download"
    case "bufferBytes":
      return "buffer"
    case "accountAgeDays":
      return "account age"
    case "accountRatio":
      return "ratio"
    case "seedbonus":
      return "bonus"
    case "seedSizeBytes":
      return "seed size"
    case "seedingPoints":
      return "seeding points"
    case "averageSeedTimeSeconds":
      return "average seed time"
    default:
      return bar.label.toLowerCase()
  }
}

function distanceTextFor(target: string | null, bars: RankSummaryBar[]): string | null {
  if (!target) return null
  const remaining = bars.filter((bar) => bar.status !== "met").slice(0, 3)
  if (remaining.length === 0) return `${target}: all tracked checks met`
  const parts = remaining.map((bar) => {
    const label = shortMetricLabel(bar)
    if (bar.currentValue === null) return `${label} unknown`
    const left = bar.requiredValue - bar.currentValue
    if (left <= 0 && (bar.comparison === "gt" || bar.comparison === "lt")) {
      return `${label} above ${bar.required}`
    }
    return `${formatValue(bar.metric, Math.max(0, left))} ${label}`
  })
  const hasUnknown = remaining.some((bar) => bar.currentValue === null)
  const hasRemaining = remaining.some(
    (bar) => bar.currentValue !== null && bar.requiredValue - bar.currentValue > 0
  )
  return `${target}: ${parts.join(", ")}${!hasUnknown && hasRemaining ? " left" : ""}`
}

export function rankLadderStateFor(
  entry: ReturnType<typeof registryEntryFor>,
  currentRank: string | null,
  currentRankHidden: boolean,
  now: Date
): RankLadderState {
  const classes = entry?.userClasses ?? []
  if (classes.length === 0) return "no-ladder"
  if (currentRankHidden || !currentRank) return "no-rank"
  const next = evaluateRankGoal({
    userClasses: classes,
    rankPaths: entry?.rankPaths,
    currentRank,
    observations: {},
    now,
    joinedAt: null,
    structuredGoals: {},
  })
  if (next.nextRank) return "next"
  if (next.status === "appointed") return "appointed"
  if (next.status !== "no-next-rank") return "off-ladder"
  return hasAutomaticClassAbove(classes, entry?.rankPaths, currentRank) ? "branch" : "top"
}

/** Short register text for a tracker with no saved or automatic next class. */
export function rankLadderStateLabel(state: RankLadderState): string {
  switch (state) {
    case "top":
      return "Highest automatic class"
    case "branch":
      return "Ladder branches, choose a target"
    case "appointed":
      return "Appointed class, no earned next class"
    case "off-ladder":
      return "Class not in the saved ladder"
    case "no-rank":
      return "Current class unknown"
    case "no-ladder":
      return "No class ladder for this tracker"
    default:
      return "Next class"
  }
}

function nextMetaFor(
  entry: ReturnType<typeof registryEntryFor>,
  currentRank: string | null,
  now: Date
): {
  name: string | null
  requirements: string | null
  textOnly: boolean
  highest: boolean
} {
  if (!entry) return { name: null, requirements: null, textOnly: false, highest: false }
  const next = evaluateRankGoal({
    userClasses: entry.userClasses ?? [],
    rankPaths: entry.rankPaths,
    currentRank,
    observations: {},
    now,
    joinedAt: null,
    structuredGoals: {},
  })
  return {
    name: next.nextRank,
    requirements: next.freeTextRequirement,
    textOnly: next.status === "no-structured-goal",
    highest:
      (next.status === "no-next-rank" || next.status === "appointed") &&
      !hasAutomaticClassAbove(entry.userClasses ?? [], entry.rankPaths, currentRank),
  }
}

function summarizeConditions(result: RankGroupResult | null): {
  met: number
  unmet: RankSummaryCondition[]
  unknown: RankSummaryCondition[]
  bars: RankSummaryBar[]
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
    bars: summarizeBars(result),
  }
}

function buildSummary(
  tracker: TrackerSummary,
  pilot: TrackerRankDefinition,
  savedTarget: string | null,
  now: Date,
  manualValues: RankManualValues = {}
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
    manualValues,
    now,
    joinedAt: tracker.joinedAt,
    structuredGoals: pilot.goals,
  }

  const next = evaluateRankGoal(input)
  const nextMeta = nextMetaFor(entry, currentRank, now)
  const ladderState = rankLadderStateFor(entry, currentRank, currentRankHidden, now)

  if (Object.keys(pilot.goals).length === 0) {
    return {
      trackerId: tracker.id,
      trackerName: tracker.name,
      color: tracker.color,
      currentRank,
      currentRankHidden,
      targetRank: null,
      targetInvalid: false,
      targetReached: false,
      automaticNextRank: nextMeta.name,
      nextRankName: nextMeta.name,
      nextIsTextOnly: nextMeta.textOnly,
      highestAutomatic: nextMeta.highest,
      ladderState,
      status: "unsupported",
      metCount: 0,
      unmetCount: 0,
      unknownCount: 0,
      unmet: [],
      unknown: [],
      bars: [],
      totalChecks: 0,
      distanceText: null,
      nextRankRequirements: nextMeta.requirements,
      linkLabel: "Open tracker",
      linkHref: `/trackers/${tracker.id}#rank-goal`,
    }
  }

  const currentPosition = ladderPosition(entry?.userClasses ?? [], currentRank)
  const targetPosition = target ? ladderPosition(entry?.userClasses ?? [], target) : null
  const targetReached = Boolean(
    target &&
      currentPosition !== null &&
      targetPosition !== null &&
      targetPosition <= currentPosition
  )

  let result: RankGroupResult | null = null
  let automaticNextRank: string | null = null
  if (target && !targetReached) {
    result = evaluateRequirementGroup(pilot.goals[target], input)
    automaticNextRank = next.nextRank
  } else {
    automaticNextRank = next.nextRank
    result = next.structuredRequirement
  }

  const counts = summarizeConditions(result)
  const progress = result?.progress ?? { met: 0, unmet: 0, unknown: 0, total: 0 }
  const nextIsTextOnly = next.status === "no-structured-goal"
  return {
    trackerId: tracker.id,
    trackerName: tracker.name,
    color: tracker.color,
    currentRank,
    currentRankHidden,
    targetRank: target,
    targetInvalid,
    targetReached,
    automaticNextRank,
    nextRankName: next.nextRank,
    nextIsTextOnly,
    highestAutomatic:
      (next.status === "no-next-rank" || next.status === "appointed") &&
      !hasAutomaticClassAbove(entry?.userClasses ?? [], entry?.rankPaths, currentRank),
    ladderState,
    status: target ? "goal" : "no-target",
    metCount: progress.met,
    unmetCount: progress.unmet,
    unknownCount: progress.unknown,
    unmet: counts.unmet,
    unknown: counts.unknown,
    bars: counts.bars,
    totalChecks: progress.total,
    distanceText: distanceTextFor(
      targetReached ? automaticNextRank : (target ?? automaticNextRank),
      counts.bars
    ),
    nextRankRequirements: nextIsTextOnly ? next.freeTextRequirement : null,
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
  now: Date,
  manualValuesByTracker: RankManualValuesByTracker = {}
): RankGoalSummary[] {
  return trackers.flatMap((tracker) => {
    if (!tracker.isActive) return []
    const savedTarget = savedGoals[String(tracker.id)]?.targetRank ?? null
    const pilot = rankDefinitionForSlug(tracker.registrySlug)
    // A tracker without structured rules still gets a summary: its ladder and
    // rule text name the next class, and its ladder state keeps the card from
    // claiming the top of a ladder it never evaluated.
    if (!pilot) {
      const entry = registryEntryFor(tracker)
      const raw = tracker.latestStats?.group ?? null
      const hidden = Boolean(raw && isRedacted(raw))
      const nextMeta = nextMetaFor(entry, hidden ? null : raw, now)
      return [
        {
          trackerId: tracker.id,
          trackerName: tracker.name,
          color: tracker.color,
          currentRank: hidden ? null : raw,
          currentRankHidden: hidden,
          targetRank: null,
          targetInvalid: Boolean(savedTarget),
          targetReached: false,
          automaticNextRank: nextMeta.name,
          nextRankName: nextMeta.name,
          nextIsTextOnly: nextMeta.textOnly,
          highestAutomatic: nextMeta.highest,
          ladderState: rankLadderStateFor(entry, hidden ? null : raw, hidden, now),
          status: "unsupported" as const,
          metCount: 0,
          unmetCount: 0,
          unknownCount: 0,
          unmet: [],
          unknown: [],
          bars: [],
          totalChecks: 0,
          distanceText: null,
          nextRankRequirements: nextMeta.requirements,
          linkLabel: "Open tracker",
          linkHref: `/trackers/${tracker.id}#rank-goal`,
        },
      ]
    }
    return [
      buildSummary(
        tracker,
        pilot,
        savedTarget,
        now,
        manualValuesByTracker[String(tracker.id)] ?? {}
      ),
    ]
  })
}
