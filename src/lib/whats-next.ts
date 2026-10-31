// src/lib/whats-next.ts
//
// P52 dashboard "What's next" projection. Every row is derived from existing
// rank goals, login rules and ratio thresholds. It never estimates an upload
// ETA: the only time-based promotion row is an account-age-only wait, where the
// join date and registry threshold make the date exact.

import { registryEntryFor } from "@/data/tracker-registry"
import { formatRatio } from "@/lib/formatters"
import { readLoginDeadline } from "@/lib/login-deadline"
import type { RankManualValuesByTracker } from "@/lib/rank-manual-values"
import { buildRankGoalSummaries } from "@/lib/rank-summary"
import { resolveAccountRatio } from "@/lib/tracker-rules"
import type { TrackerSummary } from "@/types/api"

export type WhatsNextKind = "promotion-time" | "promotion-waiting" | "login" | "ratio"

export interface WhatsNextItem {
  id: string
  kind: WhatsNextKind
  trackerId: number
  trackerName: string
  color: string
  title: string
  detail: string
  href: string
  /** Days until the dated event; null for a ratio threshold with no date. */
  dueInDays: number | null
  /** Tie-breaker for ratio rows with no date. */
  margin: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const FRESH_MS = 24 * 60 * 60 * 1000
const LOGIN_WINDOW_DAYS = 14
const RATIO_NEAR_DANGER = 0.1

function isFresh(lastPolledAt: string | null, now: Date): boolean {
  if (!lastPolledAt) return false
  const polled = new Date(lastPolledAt)
  if (Number.isNaN(polled.getTime())) return false
  return now.getTime() - polled.getTime() <= FRESH_MS
}

function daysText(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`
}

function promotionRows(
  trackers: TrackerSummary[],
  savedGoals: Record<string, { targetRank: string }>,
  manualValues: RankManualValuesByTracker,
  now: Date
): WhatsNextItem[] {
  const rows: WhatsNextItem[] = []

  for (const summary of buildRankGoalSummaries(trackers, savedGoals, now, manualValues)) {
    if (summary.currentRankHidden) continue
    const rank = summary.targetRank ?? summary.automaticNextRank
    if (!rank || summary.targetReached || summary.highestAutomatic) continue
    if (summary.totalChecks === 0) continue

    const age = summary.bars.find((bar) => bar.metric === "accountAgeDays")
    const nonAgeUnmet = summary.bars.filter(
      (bar) => bar.status !== "met" && bar.metric !== "accountAgeDays"
    )
    const onlyNeedsTime =
      summary.unknownCount === 0 &&
      summary.unmetCount > 0 &&
      summary.metCount + summary.unmetCount === summary.totalChecks &&
      age?.status === "unmet" &&
      age.currentValue !== null &&
      nonAgeUnmet.length === 0

    if (onlyNeedsTime && age.currentValue !== null && age.requiredValue !== null) {
      const days = Math.max(1, Math.ceil(age.requiredValue - age.currentValue))
      rows.push({
        id: `promotion-time:${summary.trackerId}`,
        kind: "promotion-time",
        trackerId: summary.trackerId,
        trackerName: summary.trackerName,
        color: summary.color,
        title: `${summary.trackerName} \u2192 ${rank}`,
        detail: `in ${daysText(days)} of account age`,
        href: summary.linkHref,
        dueInDays: days,
        margin: 0,
      })
      continue
    }

    const allMet =
      summary.metCount === summary.totalChecks &&
      summary.unmetCount === 0 &&
      summary.unknownCount === 0
    if (allMet) {
      rows.push({
        id: `promotion-waiting:${summary.trackerId}`,
        kind: "promotion-waiting",
        trackerId: summary.trackerId,
        trackerName: summary.trackerName,
        color: summary.color,
        title: `${summary.trackerName} \u2192 ${rank}`,
        detail: "All checks met \u00b7 waiting for the site",
        href: summary.linkHref,
        dueInDays: 0,
        margin: 0,
      })
    }
  }

  return rows
}

function loginRows(trackers: TrackerSummary[], now: Date): WhatsNextItem[] {
  const rows: WhatsNextItem[] = []
  for (const tracker of trackers) {
    if (!tracker.isActive) continue
    const deadline = readLoginDeadline({
      lastAccessAt: tracker.lastAccessAt,
      intervalDays: registryEntryFor(tracker)?.rules?.loginIntervalDays,
      now,
    })
    if (deadline.dueInDays === null || deadline.dueInDays > LOGIN_WINDOW_DAYS) continue
    rows.push({
      id: `login:${tracker.id}`,
      kind: "login",
      trackerId: tracker.id,
      trackerName: tracker.name,
      color: tracker.color,
      title: `${tracker.name} login`,
      detail:
        deadline.dueInDays === 0 ? "due today" : `due in ${daysText(deadline.dueInDays)}`,
      href: `/trackers/${tracker.id}`,
      dueInDays: deadline.dueInDays,
      margin: 0,
    })
  }
  return rows
}

function ratioRows(trackers: TrackerSummary[], now: Date): WhatsNextItem[] {
  const rows: WhatsNextItem[] = []
  for (const tracker of trackers) {
    if (!tracker.isActive) continue
    if (!isFresh(tracker.lastPolledAt, now)) continue
    const stats = tracker.latestStats
    if (!stats || stats.ratio === null || stats.ratioIsInfinite) continue
    const threshold = resolveAccountRatio(stats.requiredRatio, registryEntryFor(tracker)?.rules)
    if (threshold === null || !Number.isFinite(threshold) || threshold <= 0) continue
    const margin = stats.ratio - threshold
    if (margin <= 0 || margin > threshold * RATIO_NEAR_DANGER) continue

    rows.push({
      id: `ratio:${tracker.id}`,
      kind: "ratio",
      trackerId: tracker.id,
      trackerName: tracker.name,
      color: tracker.color,
      title: `${tracker.name} ratio`,
      detail: `${formatRatio(stats.ratio)} \u00b7 minimum ${formatRatio(threshold)} (within 10%)`,
      href: `/trackers/${tracker.id}`,
      dueInDays: null,
      margin,
    })
  }
  return rows
}

export function buildWhatsNext(input: {
  trackers: TrackerSummary[]
  savedRankGoals: Record<string, { targetRank: string }>
  manualValues?: RankManualValuesByTracker
  now: Date
  limit?: number
}): WhatsNextItem[] {
  const items = [
    ...promotionRows(input.trackers, input.savedRankGoals, input.manualValues ?? {}, input.now),
    ...loginRows(input.trackers, input.now),
    ...ratioRows(input.trackers, input.now),
  ]

  items.sort((a, b) => {
    const aDated = a.dueInDays !== null
    const bDated = b.dueInDays !== null
    if (aDated && bDated) return (a.dueInDays as number) - (b.dueInDays as number)
    if (aDated !== bDated) return aDated ? -1 : 1
    return a.margin - b.margin
  })

  return items.slice(0, input.limit ?? 5)
}

export const WHATS_NEXT_LIMIT = 5
export const WHATS_NEXT_LOGIN_WINDOW_DAYS = LOGIN_WINDOW_DAYS
export const WHATS_NEXT_RATIO_NEAR_DANGER = RATIO_NEAR_DANGER
export { DAY_MS as WHATS_NEXT_DAY_MS }
