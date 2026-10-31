// src/lib/tracker-checks.ts
//
// The four viability checks at the end of a register row. Grid cards and the
// register both read this module, so "3/4 checks" means the same four checks in
// both dashboard views.

import { registryEntryFor } from "@/data/tracker-registry"
import { formatBytesFromString, formatRatio } from "@/lib/formatters"
import { readLoginDeadline } from "@/lib/login-deadline"
import { resolveAccountRatio } from "@/lib/tracker-rules"
import { formatRequirement, getTrackerHealth } from "@/lib/tracker-status"
import type { TrackerSummary } from "@/types/api"

type TrackerCheckTone = "ok" | "warn" | "crit" | "muted"

const STATE_LABEL: Record<Exclude<TrackerCheckTone, "muted">, string> = {
  ok: "OK",
  warn: "Warning",
  crit: "Critical",
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`
}

interface LoginWindow {
  days: number | null
  label: string
  tone: TrackerCheckTone
  reason: string
  detail: string
}

interface TrackerCheckSegment {
  tone: TrackerCheckTone
  detail: string
}

interface TrackerChecks {
  segments: TrackerCheckSegment[]
  passed: number
  known: boolean
}

function readLoginWindow(tracker: TrackerSummary, now: Date = new Date()): LoginWindow {
  const registryInterval = registryEntryFor(tracker)?.rules?.loginIntervalDays
  const deadline = readLoginDeadline({
    lastAccessAt: tracker.lastAccessAt,
    intervalDays: registryInterval,
    now,
  })
  if (!deadline.hasRule) {
    return {
      days: null,
      label: "\u2014",
      tone: "muted",
      reason:
        registryInterval === 0
          ? "This tracker has no mandatory login interval."
          : "No login interval is defined for this tracker.",
      detail: "No login rule",
    }
  }
  if (deadline.lastLoginDays === null) {
    return {
      days: null,
      label: "\u2014",
      tone: "muted",
      reason: "No last-access date is recorded for this tracker.",
      detail: "No login recorded",
    }
  }
  if (deadline.overdueDays !== null) {
    return {
      days: 0,
      label: "due",
      tone: "crit",
      reason: `The login window is overdue by ${deadline.overdueDays} day${deadline.overdueDays === 1 ? "" : "s"}.`,
      detail: `Login overdue by ${plural(deadline.overdueDays, "day")}`,
    }
  }
  const days = deadline.dueInDays ?? 0
  return {
    days,
    label: days === 0 ? "today" : `${days}d`,
    tone: deadline.tone,
    reason: days === 0 ? "The login window closes today." : `Next login is due in ${days} days.`,
    detail: days === 0 ? "Login due today" : `Login due in ${plural(days, "day")}`,
  }
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
    const reason = !stats
      ? "No stats yet"
      : health === "paused"
        ? "No checks while paused"
        : health === "error"
          ? "Last poll failed"
          : "Tracker is offline"
    return {
      segments: [
        { tone: "muted", detail: reason },
        { tone: "muted", detail: reason },
        { tone: "muted", detail: reason },
        { tone: "muted", detail: reason },
      ],
      passed: 0,
      known: false,
    }
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
  const ratioDetail =
    ratioTone === "muted"
      ? "No ratio data"
      : `Ratio ${stats.ratioIsInfinite ? "\u221e" : formatRatio(stats.ratio)} (minimum ${formatRequirement(requirement)}) \u00b7 ${STATE_LABEL[ratioTone]}`

  const buffer = readBuffer(tracker)
  const bufferDetail =
    buffer.tone === "muted"
      ? "No buffer data"
      : `Buffer ${buffer.display} \u00b7 ${STATE_LABEL[buffer.tone]}`

  const seedTone: TrackerCheckTone =
    stats.seedingCount === null ? "muted" : stats.seedingCount > 0 ? "ok" : "crit"
  const seedDetail =
    seedTone === "muted"
      ? "No seeding data"
      : `Seeding ${plural(stats.seedingCount ?? 0, "torrent")} \u00b7 ${STATE_LABEL[seedTone]}`

  const loginDetail =
    login.tone === "muted"
      ? login.detail
      : `${login.detail} \u00b7 ${STATE_LABEL[login.tone]}`

  const segments: TrackerCheckSegment[] = [
    { tone: ratioTone, detail: ratioDetail },
    { tone: buffer.tone, detail: bufferDetail },
    { tone: seedTone, detail: seedDetail },
    { tone: login.tone, detail: loginDetail },
  ]
  return {
    segments,
    passed: segments.filter((segment) => segment.tone === "ok").length,
    known: segments.some((segment) => segment.tone !== "muted"),
  }
}

export type { LoginWindow, TrackerCheckSegment, TrackerChecks, TrackerCheckTone }
export { getTrackerChecks, readBuffer, readLoginWindow }
