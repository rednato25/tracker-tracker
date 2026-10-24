// src/lib/quiet-hours.ts
//
// P08 quiet-hours window. The window is evaluated in an explicit IANA timezone
// and can cross midnight. Nothing is dropped: routine immediate events are
// coalesced into the next summary, and the caller must persist that pending
// state. Critical bypass is opt-in and limited to the documented event types.

import type { NotificationEventType } from "@/lib/notifications/types"

export interface QuietHoursConfig {
  enabled: boolean
  start: string
  end: string
  timezone: string
  criticalBypass: boolean
}

export const CRITICAL_QUIET_EVENTS: readonly NotificationEventType[] = [
  "hit_and_run",
  "tracker_down",
]

function parseMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

function localMinutes(now: Date, timezone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now)
    const values: Record<string, string> = {}
    for (const part of parts) if (part.type !== "literal") values[part.type] = part.value
    return Number(values.hour) * 60 + Number(values.minute)
  } catch {
    return null
  }
}

export function quietHoursConfigFromSettings(settings: {
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  quietHoursTimezone: string
  quietHoursCriticalBypass: boolean
}): QuietHoursConfig {
  return {
    enabled: settings.quietHoursEnabled,
    start: settings.quietHoursStart,
    end: settings.quietHoursEnd,
    timezone: settings.quietHoursTimezone,
    criticalBypass: settings.quietHoursCriticalBypass,
  }
}

/** Returns true inside the window, including both sides correctly. */
export function isQuietHours(config: QuietHoursConfig, now: Date): boolean {
  if (!config.enabled) return false
  const start = parseMinutes(config.start)
  const end = parseMinutes(config.end)
  const current = localMinutes(now, config.timezone)
  if (start === null || end === null || current === null) return false
  if (start === end) return false
  if (start < end) return current >= start && current < end
  // Crosses midnight: [start, 24:00) or [00:00, end).
  return current >= start || current < end
}

export function isCriticalQuietEvent(event: NotificationEventType): boolean {
  return CRITICAL_QUIET_EVENTS.includes(event)
}
