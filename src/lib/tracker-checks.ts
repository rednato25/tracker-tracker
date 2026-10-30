// src/lib/tracker-checks.ts
//
// The four viability checks at the end of a register row. Grid cards and the
// register both read this module, so "3/4 checks" means the same four checks in
// both dashboard views.

import { registryEntryFor } from "@/data/tracker-registry"
import { formatBytesFromString } from "@/lib/formatters"
import { resolveAccountRatio } from "@/lib/tracker-rules"
import { getTrackerHealth } from "@/lib/tracker-status"
import type { TrackerSummary } from "@/types/api"

type TrackerCheckTone = "ok" | "warn" | "crit" | "muted"

interface LoginWindow {
  days: number | null
  label: string
  tone: TrackerCheckTone
  reason: string
}

interface TrackerChecks {
  segments: TrackerCheckTone[]
  passed: number
  known: boolean
}

function readLoginWindow(tracker: TrackerSummary): LoginWindow {
  const interval = registryEntryFor(tracker)?.rules?.loginIntervalDays
  if (interval === undefined) {
    return {
      days: null,
      label: "\u2014",
      tone: "muted",
      reason: "No login interval is defined for this tracker.",
    }
  }
  if (interval === 0) {
    return {
      days: null,
      label: "\u2014",
      tone: "muted",
      reason: "This tracker has no mandatory login interval.",
    }
  }
  if (!tracker.lastAccessAt) {
    return {
      days: null,
      label: "\u2014",
      tone: "muted",
      reason: "The adapter has not captured a last-access date for this tracker.",
    }
  }
  const last = new Date(tracker.lastAccessAt).getTime()
  if (Number.isNaN(last)) {
    return {
      days: null,
      label: "\u2014",
      tone: "muted",
      reason: "The captured last-access date could not be parsed.",
    }
  }
  const remaining = interval * 86_400_000 - (Date.now() - last)
  const days = Math.max(0, Math.floor(remaining / 86_400_000))
  const tone: TrackerCheckTone = days <= 2 ? "crit" : days <= 7 ? "warn" : "ok"
  if (remaining <= 0) {
    return { days: 0, label: "due", tone: "crit", reason: "The login window is overdue." }
  }
  if (days < 1) {
    return {
      days,
      label: `${Math.max(1, Math.floor(remaining / 3_600_000))}h`,
      tone,
      reason: `Next login is due in ${Math.max(1, Math.floor(remaining / 3_600_000))} hours.`,
    }
  }
  return { days, label: `${days}d`, tone, reason: `Next login is due in ${days} days.` }
}

function readBuffer(tracker: TrackerSummary): { display: string; tone: TrackerCheckTone } {
  const raw = tracker.latestStats?.bufferBytes
  if (!raw) return { display: "\u2014", tone: "muted" }
  try {
    const value = BigInt(raw)
    const display = formatBytesFromString(raw)
    return {
      display: value > 0n && !display.startsWith("+") ? `+${display}` : display,
      tone: value > 0n ? "ok" : value < 0n ? "crit" : "warn",
    }
  } catch {
    return { display: formatBytesFromString(raw), tone: "muted" }
  }
}

function getTrackerChecks(tracker: TrackerSummary, login = readLoginWindow(tracker)): TrackerChecks {
  const health = getTrackerHealth(tracker)
  const stats = tracker.latestStats
  if (!stats || health === "paused" || health === "error" || health === "offline") {
    return { segments: ["muted", "muted", "muted", "muted"], passed: 0, known: false }
  }

  const requirement =
    resolveAccountRatio(stats.requiredRatio, registryEntryFor(tracker)?.rules) ?? 1
  const ratioTone: TrackerCheckTone = stats.ratioIsInfinite
    ? "ok"
    : stats.ratio === null
      ? "muted"
      : stats.ratio >= 2 * requirement
        ? "ok"
        : stats.ratio >= requirement
          ? "warn"
          : "crit"

  const seedTone: TrackerCheckTone =
    stats.seedingCount === null ? "muted" : stats.seedingCount > 0 ? "ok" : "crit"

  const segments: TrackerCheckTone[] = [
    ratioTone,
    readBuffer(tracker).tone,
    seedTone,
    login.tone,
  ]
  return {
    segments,
    passed: segments.filter((segment) => segment === "ok").length,
    known: segments.some((segment) => segment !== "muted"),
  }
}

export type { LoginWindow, TrackerChecks, TrackerCheckTone }
export { getTrackerChecks, readBuffer, readLoginWindow }
