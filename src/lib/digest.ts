// src/lib/digest.ts
//
// P08 digest evaluation and delivery. Scheduling is a task on the existing
// master scheduler; this module owns only the pure due check, rendering and
// per-target state transitions.

import { eq } from "drizzle-orm"
import { computeTrackerActions, type TrackerAction } from "@/lib/actions"
import { db, getDbClient } from "@/lib/db"
import { appSettings, notificationTargets } from "@/lib/db/schema"
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
import { getTrackerListForDashboard } from "@/lib/server-data"

export interface DigestConfig {
  enabled: boolean
  time: string
  timezone: string
  emptyBehavior: "skip" | "send"
  targetIds: number[] | null
}

export interface DigestTargetState {
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  lastDigestKey: string | null
  nextAttemptAt: string | null
  failureCount: number
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
    maxChars?: number
    dashboardUrl?: string | null
  }
): string | null {
  const maxChars = options.maxChars ?? MAX_DIGEST_CHARS
  const groups = new Map<string, DigestGroup>()
  for (const action of actions) {
    const key = action.trackerId === null ? `client:${action.trackerName}` : `tracker:${action.trackerId}`
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
  if (total === 0) {
    if (options.emptyBehavior === "skip") return null
    return `Tracker Tracker digest — ${options.dateKey} (${options.timezone})\n\nNo active actions or verification items.`
  }

  const lines: string[] = [
    `Tracker Tracker digest — ${options.dateKey} (${options.timezone})`,
    `${total} item${total === 1 ? "" : "s"} need attention`,
    "",
  ]
  let shown = 0
  for (const group of groups.values()) {
    if (group.confirmed.length > 0) {
      lines.push(`ACTION REQUIRED — ${group.name}`)
      for (const action of group.confirmed) {
        if (shown >= total) break
        lines.push(`• ${action.reason} Next: ${action.nextAction}`)
        shown += 1
      }
    }
    if (group.verification.length > 0) {
      lines.push(`NEEDS VERIFICATION — ${group.name}`)
      for (const action of group.verification) {
        if (shown >= total) break
        lines.push(`• ${action.reason} Next: ${action.nextAction}`)
        shown += 1
      }
    }
    if (lines.join("\n").length > maxChars - 160) break
  }

  if (shown < total) {
    lines.push(``, `… ${total - shown} more item${total - shown === 1 ? "" : "s"} not shown.`)
  }
  if (options.dashboardUrl) {
    lines.push(``, `Dashboard: ${options.dashboardUrl}`)
  }
  let text = lines.join("\n")
  if (text.length > maxChars) text = `${text.slice(0, maxChars - 1)}…`
  return text
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
    return deliverNtfyMessage(target.id, config, "Tracker Tracker digest", text)
  }
  return { success: false, status: "failed", error: "Invalid notification config" }
}

/** Run one scheduler tick. Returns true when a digest was attempted. */
export async function runDigestIfDue(
  encryptionKey: Buffer,
  now = new Date()
): Promise<boolean> {
  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings) return false
  const config = digestConfigFromSettings(settings)
  if (!config.enabled) return false

  const conn = await getDbClient().reserve()
  try {
    const [lock] = await conn<{ acquired: boolean }[]>`
      select pg_try_advisory_lock(hashtext(${DIGEST_LOCK_KEY}), ${DIGEST_LOCK_NAMESPACE}) as acquired
    `
    if (!lock?.acquired) return false

    try {
      const state = parseState(settings.digestState)
      const dueTargets = (
        await db.select().from(notificationTargets).orderBy(notificationTargets.id)
      ).filter((target) => {
        if (!target.enabled) return false
        if (config.targetIds && !config.targetIds.includes(target.id)) return false
        return isDigestDue(config, state[String(target.id)], now).due
      })
      if (dueTargets.length === 0) return false

      const trackers = await getTrackerListForDashboard()
      const actions = computeTrackerActions({ trackers, now })
      const { key } = isDigestDue(config, undefined, now)
      const baseUrl = process.env.BASE_URL
      const dashboardUrl =
        baseUrl?.toLowerCase().startsWith("https://") ? `${baseUrl.replace(/\/$/, "")}/` : null
      const text = buildDigest(actions, {
        dateKey: key,
        timezone: config.timezone,
        emptyBehavior: config.emptyBehavior,
        dashboardUrl,
      })

      let attempted = false
      for (const target of dueTargets) {
        const current = state[String(target.id)] ?? {
          lastAttemptAt: null,
          lastSuccessAt: null,
          lastDigestKey: null,
          nextAttemptAt: null,
          failureCount: 0,
        }
        const due = isDigestDue(config, current, now)
        if (!due.due) continue
        attempted = true
        if (text === null) {
          // Explicit skip still records the local date so an empty digest is not
          // re-evaluated every minute. This is not a successful delivery.
          state[String(target.id)] = { ...current, lastDigestKey: due.key }
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
