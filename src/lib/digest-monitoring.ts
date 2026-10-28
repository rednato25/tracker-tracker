// src/lib/digest-monitoring.ts
//
// P27 monitoring rows for the existing scheduled digest. This is a read-only
// projection of stored tracker stats and the P09/P10/P11 rank summary. No rates,
// gains, promotion dates or cross-tracker bonus totals are inferred.

import { formatBytesNum, formatCount, formatRatio } from "@/lib/formatters"
import { isRedacted } from "@/lib/privacy"
import { buildRankGoalSummaries } from "@/lib/rank-summary"
import type { TrackerSummary } from "@/types/api"

const MONITORING_STALE_MS = 2 * 60 * 60 * 1000

export interface DigestMonitoringTracker {
  trackerId: number
  name: string
  ratio: string
  buffer: string
  uploaded: string
  downloaded: string
  seeding: string
  bonus: string
  rank: string
  target: string | null
  unmet: number
  unknown: number
  freshness: "fresh" | "stale" | "unknown" | "missing"
}

export interface DigestMonitoringSection {
  trackers: DigestMonitoringTracker[]
  total: number
  omitted: number
}

function signedBuffer(raw: string | null): string {
  if (raw === null || raw === "") return "unknown"
  try {
    const value = BigInt(raw)
    const display = formatBytesFromString(raw)
    return value > 0n && !display.startsWith("+") ? `+${display}` : display
  } catch {
    return "unknown"
  }
}

function formatBytesFromString(raw: string): string {
  try {
    return formatBytesNum(Number(BigInt(raw)))
  } catch {
    return "unknown"
  }
}

function formatMetric(raw: string | null, signed = false): string {
  if (raw === null || raw === "") return "unknown"
  return signed ? signedBuffer(raw) : formatBytesFromString(raw)
}

function freshness(tracker: TrackerSummary, now: Date): DigestMonitoringTracker["freshness"] {
  if (!tracker.latestStats) return "missing"
  if (!tracker.lastPolledAt) return "unknown"
  const polled = new Date(tracker.lastPolledAt)
  if (Number.isNaN(polled.getTime())) return "unknown"
  return now.getTime() - polled.getTime() > MONITORING_STALE_MS ? "stale" : "fresh"
}

export function buildDigestMonitoring(
  trackers: TrackerSummary[],
  savedGoals: Record<string, { targetRank: string }>,
  now: Date,
  maxTrackers = 8
): DigestMonitoringSection | null {
  const active = trackers.filter((tracker) => tracker.isActive)
  if (active.length === 0) return null
  const summaries = new Map(
    buildRankGoalSummaries(active, savedGoals, now).map((summary) => [summary.trackerId, summary])
  )
  const rows = active
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((tracker): DigestMonitoringTracker => {
      const stats = tracker.latestStats
      const summary = summaries.get(tracker.id)
      const rawRank = stats?.group ?? null
      const rank = rawRank && isRedacted(rawRank) ? "hidden" : (rawRank ?? "unknown")
      const target = savedGoals[String(tracker.id)]?.targetRank ?? null
      return {
        trackerId: tracker.id,
        name: tracker.name,
        ratio: stats?.ratioIsInfinite ? "infinite" : formatRatio(stats?.ratio ?? null),
        buffer: formatMetric(stats?.bufferBytes ?? null, true),
        uploaded: formatMetric(stats?.uploadedBytes ?? null),
        downloaded: formatMetric(stats?.downloadedBytes ?? null),
        seeding: formatCount(stats?.seedingCount ?? null),
        bonus: formatCount(stats?.seedbonus ?? null),
        rank,
        target,
        unmet: summary?.unmetCount ?? 0,
        unknown: summary?.unknownCount ?? 0,
        freshness: freshness(tracker, now),
      }
    })

  return {
    trackers: rows.slice(0, maxTrackers),
    total: rows.length,
    omitted: Math.max(0, rows.length - maxTrackers),
  }
}
