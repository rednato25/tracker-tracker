// src/lib/digest.ts
//
// P08 digest evaluation and delivery. Scheduling is a task on the existing
// master scheduler; this module owns only the pure due check, rendering and
// per-target state transitions.

import { eq } from "drizzle-orm"
import { computeTrackerActions, type TrackerAction } from "@/lib/actions"
import { db, getDbClient } from "@/lib/db"
import { appSettings, notificationTargets } from "@/lib/db/schema"
import type { DigestMonitoringSection } from "@/lib/digest-monitoring"
import { buildDigestMonitoring } from "@/lib/digest-monitoring"
import { log } from "@/lib/logger"
import { decryptNotificationConfig } from "@/lib/notifications/decrypt"
import {
  type DeliveryResult,
  deliverDiscordWebhook,
  deliverNtfyMessage,
  deliverTelegramMessage,
} from "@/lib/notifications/deliver"
import {
  isDiscordConfig,
  isNtfyConfig,
  isTelegramConfig,
} from "@/lib/notifications/types"
import { isQuietHours, quietHoursConfigFromSettings } from "@/lib/quiet-hours"
import { parseSavedRankGoals } from "@/lib/rank-summary"
import { getTrackerListForDashboard } from "@/lib/server-data"
import { truncateUtf8 } from "@/lib/utf8"

export interface DigestConfig {
  enabled: boolean
  time: string
  timezone: string
  emptyBehavior: "skip" | "send"
  includeMonitoring: boolean
  targetIds: number[] | null
}

export interface DigestTargetState {
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  lastDigestKey: string | null
  nextAttemptAt: string | null
  failureCount: number
  quietPending?: boolean
}

export type DigestState = Record<string, DigestTargetState>

const DIGEST_LOCK_KEY = "tracker-tracker:digest-v1"
const DIGEST_LOCK_NAMESPACE = 1
const MAX_DIGEST_CHARS = 4096
const RETRY_BASE_MS = 15 * 60 * 1000
const RETRY_MAX_MS = 6 * 60 * 60 * 1000

function parseState(raw: string | null): DigestState {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, DigestTargetState>
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function timeToMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

function zonedNow(now: Date, timezone: string): { key: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const values: Record<string, string> = {}
  for (const part of parts) if (part.type !== "literal") values[part.type] = part.value
  return {
    key: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  }
}

/** Pure due check, no clock read. A missed day collapses to at most today. */
export function isDigestDue(
  config: DigestConfig,
  state: DigestTargetState | undefined,
  now: Date
): { due: boolean; key: string } {
  const key = zonedNow(now, config.timezone).key
  if (!config.enabled) return { due: false, key }
  const scheduled = timeToMinutes(config.time)
  if (scheduled === null) return { due: false, key }
  if (zonedNow(now, config.timezone).minutes < scheduled) return { due: false, key }
  if (state?.lastDigestKey === key) return { due: false, key }
  if (state?.nextAttemptAt && new Date(state.nextAttemptAt).getTime() > now.getTime()) {
    return { due: false, key }
  }
  return { due: true, key }
}

export function digestConfigFromSettings(settings: {
  digestEnabled: boolean
  digestTime: string
  digestTimezone: string
  digestEmptyBehavior: string
  digestIncludeMonitoring?: boolean
  digestTargetIds: string | null
}): DigestConfig {
  let targetIds: number[] | null = null
  if (settings.digestTargetIds) {
    try {
      const parsed = JSON.parse(settings.digestTargetIds) as unknown
      if (Array.isArray(parsed)) targetIds = parsed.filter((id): id is number => Number.isInteger(id))
    } catch {
      targetIds = null
    }
  }
  return {
    enabled: settings.digestEnabled,
    time: settings.digestTime,
    timezone: settings.digestTimezone,
    emptyBehavior: settings.digestEmptyBehavior === "send" ? "send" : "skip",
    includeMonitoring: settings.digestIncludeMonitoring === true,
    targetIds,
  }
}

interface DigestGroup {
  name: string
  confirmed: TrackerAction[]
  verification: TrackerAction[]
}

export function buildDigest(
  actions: TrackerAction[],
  options: {
    dateKey: string
    timezone: string
    emptyBehavior: "skip" | "send"
    monitoring?: DigestMonitoringSection | null
    maxChars?: number
    dashboardUrl?: string | null
  }
): string | null {
  const maxChars = options.maxChars ?? MAX_DIGEST_CHARS
  const monitoring = options.monitoring?.trackers.length ? options.monitoring : null
  const groups = new Map<string, DigestGroup>()
  for (const action of actions) {
    const key =
      action.trackerId === null ? `client:${action.trackerName}` : `tracker:${action.trackerId}`
    const group = groups.get(key) ?? {
      name: action.trackerName,
      confirmed: [],
      verification: [],
    }
    if (action.status === "action-required") group.confirmed.push(action)
    else group.verification.push(action)
    groups.set(key, group)
  }

  const total = actions.length
  if (total === 0 && !monitoring) {
    if (options.emptyBehavior === "skip") return null
    return `Tracker Tracker digest - ${options.dateKey} (${options.timezone})\n\nNo active actions or verification items.`
  }

  const lines: string[] = [
    `Tracker Tracker digest - ${options.dateKey} (${options.timezone})`,
  ]
  if (total > 0) lines.push(`${total} item${total === 1 ? "" : "s"} need attention`, "")
  else lines.push("No active actions or verification items.", "")

  let shown = 0
  for (const group of groups.values()) {
    if (group.confirmed.length > 0) {
      lines.push(`ACTION REQUIRED \u2014 ${group.name}`)
      for (const action of group.confirmed) {
        if (shown >= total) break
        lines.push(`- ${action.reason} Next: ${action.nextAction}`)
        shown += 1
      }
    }
    if (group.verification.length > 0) {
      lines.push(`NEEDS VERIFICATION \u2014 ${group.name}`)
      for (const action of group.verification) {
        if (shown >= total) break
        lines.push(`- ${action.reason} Next: ${action.nextAction}`)
        shown += 1
      }
    }
    if (lines.join("\n").length > maxChars - 160) break
  }

  if (shown < total) {
    lines.push(``, `... ${total - shown} more item${total - shown === 1 ? "" : "s"} not shown.`)
  }

  if (monitoring) {
    if (shown < total) {
      lines.push("Monitoring omitted to preserve action items.")
    } else {
      lines.push("", "MONITORING")
      let monitoringShown = 0
      for (const tracker of monitoring.trackers) {
        const rankBits = [
          `rank ${tracker.rank}`,
          tracker.target ? `target ${tracker.target}` : "no target",
          tracker.unmet > 0 ? `${tracker.unmet} unmet` : null,
          tracker.unknown > 0 ? `${tracker.unknown} unknown` : null,
        ]
          .filter(Boolean)
          .join(" | ")
        const flag =
          tracker.freshness === "stale"
            ? " [stale]"
            : tracker.freshness === "unknown"
              ? " [age unknown]"
              : tracker.freshness === "missing"
                ? " [no snapshot]"
                : ""
        const line = `- ${tracker.name}: ratio ${tracker.ratio} | buffer ${tracker.buffer} | up ${tracker.uploaded} | down ${tracker.downloaded} | seeding ${tracker.seeding} | bonus ${tracker.bonus} | ${rankBits}${flag}`
        if (lines.join("\n").length + line.length + 80 > maxChars) break
        lines.push(line)
        monitoringShown += 1
      }
      if (monitoringShown < monitoring.total) {
        lines.push(`... ${monitoring.total - monitoringShown} tracker${monitoring.total - monitoringShown === 1 ? "" : "s"} not shown.`)
      }
      lines.push(
        "Monitoring uses stored snapshots. Markers: [stale] >2h, [age unknown], [no snapshot]. Bonus points are tracker-specific and not summed."
      )
    }
  }

  if (options.dashboardUrl) {
    lines.push("", `Dashboard: ${options.dashboardUrl}`)
  }
  let text = lines.join("\n")
  if (text.length > maxChars) text = `${text.slice(0, maxChars - 1)}...`
  return text
}

function emptyTargetState(): DigestTargetState {
  return {
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastDigestKey: null,
    nextAttemptAt: null,
    failureCount: 0,
    quietPending: false,
  }
}

/** Persist that routine immediate events were coalesced during quiet hours. */
export async function markQuietPending(targetIds: number[], _now: Date): Promise<void> {
  if (targetIds.length === 0) return
  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings) return
  const state = parseState(settings.digestState)
  for (const targetId of targetIds) {
    state[String(targetId)] = {
      ...emptyTargetState(),
      ...state[String(targetId)],
      quietPending: true,
    }
  }
  await db
    .update(appSettings)
    .set({ digestState: JSON.stringify(state) })
    .where(eq(appSettings.id, settings.id))
}

function nextRetry(failureCount: number, now: Date): string {
  const delay = Math.min(RETRY_BASE_MS * 2 ** Math.min(failureCount, 6), RETRY_MAX_MS)
  return new Date(now.getTime() + delay).toISOString()
}

async function deliverDigestToTarget(
  target: typeof notificationTargets.$inferSelect,
  text: string,
  encryptionKey: Buffer
): Promise<DeliveryResult> {
  const config = decryptNotificationConfig(target, encryptionKey)
  if (target.type === "discord" && isDiscordConfig(config)) {
    return deliverDiscordWebhook(target.id, config.webhookUrl, [
      {
        title: "Tracker Tracker digest",
        description: text,
        color: 0x00d4ff,
        timestamp: new Date().toISOString(),
      },
    ])
  }
  if (target.type === "telegram" && isTelegramConfig(config)) {
    return deliverTelegramMessage(target.id, config.botToken, config.chatId, text)
  }
  if (target.type === "ntfy" && isNtfyConfig(config)) {
    return deliverNtfyMessage(
      target.id,
      config,
      "Tracker Tracker digest",
      truncateUtf8(text, 4096)
    )
  }
  return { success: false, status: "failed", error: "Invalid notification config" }
}

export function buildDigestForData(
  settings: {
    digestEnabled: boolean
    digestTime: string
    digestTimezone: string
    digestEmptyBehavior: string
    digestIncludeMonitoring?: boolean
    digestTargetIds: string | null
    rankGoals: string | null
  },
  trackers: Parameters<typeof buildDigestMonitoring>[0],
  actions: TrackerAction[],
  now: Date,
  dateKey: string,
  dashboardUrl: string | null
): string | null {
  const config = digestConfigFromSettings(settings)
  const monitoring = config.includeMonitoring
    ? buildDigestMonitoring(trackers, parseSavedRankGoals(settings.rankGoals), now)
    : null
  return buildDigest(actions, {
    dateKey,
    timezone: config.timezone,
    emptyBehavior: config.emptyBehavior,
    monitoring,
    dashboardUrl,
  })
}
/** Run one scheduler tick. Returns true when a digest was attempted. */
export async function runDigestIfDue(
  encryptionKey: Buffer,
  now = new Date()
): Promise<boolean> {
  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings) return false
  const config = digestConfigFromSettings(settings)
  const quietConfig = quietHoursConfigFromSettings(settings)
  const initialQuiet = isQuietHours(quietConfig, now)
  const initialState = parseState(settings.digestState)
  const hasPending = Object.values(initialState).some((entry) => entry.quietPending)
  if (!config.enabled && !hasPending) return false

  const conn = await getDbClient().reserve()
  try {
    const [lock] = await conn<{ acquired: boolean }[]>`
      select pg_try_advisory_lock(hashtext(${DIGEST_LOCK_KEY}), ${DIGEST_LOCK_NAMESPACE}) as acquired
    `
    if (!lock?.acquired) return false

    try {
      const state = initialState
      const selectedTargets = (
        await db.select().from(notificationTargets).orderBy(notificationTargets.id)
      ).filter((target) => {
        if (!target.enabled) return false
        if (config.targetIds && !config.targetIds.includes(target.id)) return false
        return true
      })

      if (initialQuiet) {
        let changed = false
        for (const target of selectedTargets) {
          const current = state[String(target.id)] ?? emptyTargetState()
          const digestDue = config.enabled && isDigestDue(config, current, now).due
          if (digestDue || current.quietPending) {
            state[String(target.id)] = { ...current, quietPending: true }
            changed = true
          }
        }
        if (changed) {
          await db
            .update(appSettings)
            .set({ digestState: JSON.stringify(state) })
            .where(eq(appSettings.id, settings.id))
        }
        return false
      }

      const dueTargets = selectedTargets.filter((target) => {
        const current = state[String(target.id)]
        return current?.quietPending === true || (config.enabled && isDigestDue(config, current, now).due)
      })
      if (dueTargets.length === 0) return false

      const trackers = await getTrackerListForDashboard()
      const actions = computeTrackerActions({ trackers, now })
      const { key } = isDigestDue(config, undefined, now)
      const baseUrl = process.env.BASE_URL
      const dashboardUrl =
        baseUrl?.toLowerCase().startsWith("https://") ? `${baseUrl.replace(/\/$/, "")}/` : null
      const text = buildDigestForData(
        settings,
        trackers,
        actions,
        now,
        key,
        dashboardUrl
      )

      let attempted = false
      for (const target of dueTargets) {
        const current = state[String(target.id)] ?? emptyTargetState()
        const due = isDigestDue(config, current, now)
        if (!due.due && !current.quietPending) continue
        attempted = true
        if (text === null) {
          // Explicit skip still records the local date so an empty digest is not
          // re-evaluated every minute. This is not a successful delivery.
          state[String(target.id)] = {
            ...current,
            lastDigestKey: due.key,
            quietPending: false,
          }
          continue
        }
        let result: DeliveryResult
        try {
          result = await deliverDigestToTarget(target, text, encryptionKey)
        } catch (err) {
          log.warn({ targetId: target.id, error: err instanceof Error ? err.name : "unknown" }, "Digest delivery threw")
          result = { success: false, status: "failed", error: "Digest delivery failed" }
        }
        if (result.success) {
          state[String(target.id)] = {
            lastAttemptAt: now.toISOString(),
            lastSuccessAt: now.toISOString(),
            lastDigestKey: due.key,
            nextAttemptAt: null,
            failureCount: 0,
            quietPending: false,
          }
        } else {
          const failures = current.failureCount + 1
          state[String(target.id)] = {
            ...current,
            lastAttemptAt: now.toISOString(),
            nextAttemptAt: nextRetry(failures, now),
            failureCount: failures,
          }
        }
        await db
          .update(appSettings)
          .set({ digestState: JSON.stringify(state) })
          .where(eq(appSettings.id, settings.id))
      }
      if (text === null) {
        await db
          .update(appSettings)
          .set({ digestState: JSON.stringify(state) })
          .where(eq(appSettings.id, settings.id))
      }
      return attempted
    } finally {
      await conn`select pg_advisory_unlock(hashtext(${DIGEST_LOCK_KEY}), ${DIGEST_LOCK_NAMESPACE})`
    }
  } finally {
    conn.release()
  }
}
