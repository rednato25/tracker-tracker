// src/lib/rank-manual-values.ts
//
// P47 manual values. A manual value is a user-entered current figure for a
// metric the tracker API does not report. It lives in the existing
// dashboardSettings JSON, so it needs no migration. Observations always win;
// the evaluator only falls back to these values when no observed value exists.

import type { RankMetric } from "@/lib/rank-goals"

export const MANUAL_VALUE_STALE_DAYS = 14

export type RankManualUnit = "GiB" | "TiB" | "days" | "weeks" | "months" | "count"

export interface RankManualValue {
  /** Canonical metric units: bytes, seconds, days, or the raw count/ratio. */
  value: number
  unit: RankManualUnit
  /** Local calendar date the user entered the value, YYYY-MM-DD. */
  enteredAt: string
}

export type RankManualValues = Partial<Record<RankMetric, RankManualValue>>
export type RankManualValuesByTracker = Record<string, RankManualValues>

const BYTE_METRICS = new Set<RankMetric>([
  "uploadedBytes",
  "downloadedBytes",
  "bufferBytes",
  "seedSizeBytes",
])

const DURATION_METRICS = new Set<RankMetric>(["averageSeedTimeSeconds", "accountAgeDays"])

const METRIC_LABELS: Record<RankMetric, string> = {
  accountRatio: "ratio",
  uploadedBytes: "uploaded bytes",
  downloadedBytes: "downloaded bytes",
  bufferBytes: "buffer",
  seedingCount: "seeding count",
  seedbonus: "bonus points",
  seedSizeBytes: "seed size",
  seedingPoints: "seeding points",
  averageSeedTimeSeconds: "average seed time",
  accountAgeDays: "account age",
  uploads: "uploaded torrents",
  snatched: "snatched torrents",
  forumPosts: "forum posts",
  hitAndRuns: "hit and runs",
}

export function manualMetricLabel(metric: RankMetric | null | undefined): string {
  return metric ? (METRIC_LABELS[metric] ?? metric) : "this value"
}

export function isRankMetricName(value: unknown): value is RankMetric {
  return typeof value === "string" && value in METRIC_LABELS
}

/** P47 unknown copy: name the tracker and the missing metric, never blame the user. */
export function apiDoesNotReportMessage(
  trackerName: string,
  metric: RankMetric | null | undefined
): string {
  return `${trackerName}'s API doesn't report ${manualMetricLabel(metric)}.`
}

export function manualUnitsFor(metric: RankMetric | null | undefined): RankManualUnit[] {
  if (!metric) return []
  if (BYTE_METRICS.has(metric)) return ["GiB", "TiB"]
  if (DURATION_METRICS.has(metric)) return ["days", "weeks", "months"]
  return []
}

export function isManualUnit(metric: RankMetric, unit: unknown): unit is RankManualUnit {
  const allowed = manualUnitsFor(metric)
  if (allowed.length === 0) return unit === "count"
  return typeof unit === "string" && (allowed as string[]).includes(unit)
}

export function manualValueToCanonical(
  metric: RankMetric,
  value: number,
  unit: RankManualUnit
): number {
  if (BYTE_METRICS.has(metric)) {
    if (unit === "TiB") return value * 1024 ** 4
    if (unit === "GiB") return value * 1024 ** 3
  }
  if (metric === "averageSeedTimeSeconds") {
    if (unit === "days") return value * 86_400
    if (unit === "weeks") return value * 7 * 86_400
    if (unit === "months") return value * 30 * 86_400
  }
  if (metric === "accountAgeDays") {
    if (unit === "days") return value
    if (unit === "weeks") return value * 7
    if (unit === "months") return value * 30
  }
  return value
}

export function normalizeRankManualValue(
  metric: RankMetric,
  raw: unknown
): RankManualValue | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const candidate = raw as { value?: unknown; unit?: unknown; enteredAt?: unknown }
  if (typeof candidate.value !== "number" || !Number.isFinite(candidate.value)) return null
  if (candidate.value < 0) return null
  const units = manualUnitsFor(metric)
  const unit: RankManualUnit =
    units.length === 0 ? "count" : isManualUnit(metric, candidate.unit) ? candidate.unit : units[0]
  if (typeof candidate.enteredAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(candidate.enteredAt)) {
    return null
  }
  const parsed = new Date(`${candidate.enteredAt}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return { value: candidate.value, unit, enteredAt: candidate.enteredAt }
}

export function normalizeRankManualValues(raw: unknown): RankManualValues {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const parsed: RankManualValues = {}
  for (const [metric, value] of Object.entries(raw)) {
    if (!isRankMetricName(metric)) continue
    const normalized = normalizeRankManualValue(metric, value)
    if (normalized) parsed[metric] = normalized
  }
  return parsed
}

export function normalizeRankManualValuesByTracker(raw: unknown): RankManualValuesByTracker {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const parsed: RankManualValuesByTracker = {}
  for (const [trackerId, values] of Object.entries(raw)) {
    if (!/^[1-9]\d*$/.test(trackerId)) continue
    const normalized = normalizeRankManualValues(values)
    if (Object.keys(normalized).length > 0) parsed[trackerId] = normalized
  }
  return parsed
}

/** Reads the rank manual values out of a stored dashboardSettings JSON string. */
export function parseRankManualValuesFromSettings(
  raw: string | null | undefined
): RankManualValuesByTracker {
  if (!raw) return {}
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object" || Array.isArray(value)) return {}
    return normalizeRankManualValuesByTracker(
      (value as { rankManualValues?: unknown }).rankManualValues
    )
  } catch {
    return {}
  }
}

export function manualAgeDays(enteredAt: string, now: Date): number | null {
  const date = new Date(`${enteredAt}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86_400_000))
}

export function isManualValueStale(enteredAt: string, now: Date): boolean {
  const days = manualAgeDays(enteredAt, now)
  return days !== null && days > MANUAL_VALUE_STALE_DAYS
}

export function formatManualAge(enteredAt: string, now: Date): string {
  const days = manualAgeDays(enteredAt, now)
  if (days === null) return "Entered by you"
  if (days === 0) return "Entered by you · today"
  return `Entered by you · ${days} day${days === 1 ? "" : "s"} ago`
}
