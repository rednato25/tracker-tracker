// src/lib/profile-reading/hint.ts
//
// When a rank value is unknown but the tracker's profile page could supply it,
// say what the user can do about it instead of only "the API doesn't report it".
// Client-safe: it reads the stored record, never the cookie.

import { sanitizeNetworkError } from "@/lib/error-utils"
import { profileReadAgeHours } from "@/lib/profile-reading/labels"
import { supportsProfileReading } from "@/lib/profile-reading/support"
import { isProfileReadFresh, readProfileReadRecord } from "@/lib/profile-reading/types"
import type { RankMetric } from "@/lib/rank-goals"

/** Rank metrics the daily profile read can fill in. */
const PROFILE_METRICS: ReadonlySet<RankMetric> = new Set<RankMetric>([
  "seedSizeBytes",
  "averageSeedTimeSeconds",
  "uploads",
])

export interface ProfileHintTracker {
  registrySlug?: string | null
  profileReadingEnabled?: boolean
  hasProfileCookie?: boolean
  platformMeta?: unknown
}

export const PROFILE_HINT_TURN_ON =
  "Turn on “Read profile page daily” in this tracker's settings to read these values from your profile page."
export const PROFILE_HINT_ADD_COOKIE =
  "Profile reading is on but has no session cookie. Add one in this tracker's settings."
export const PROFILE_HINT_EXPIRED =
  "Profile reading stopped because the session cookie expired. Save a new one in this tracker's settings."
export const PROFILE_HINT_PAGE_CHANGED =
  "Profile reading stopped because the profile page layout changed."
export const PROFILE_HINT_WAITING = "Waiting for the first daily profile read."

/** Whether any structured class condition needs a value only the profile page supplies. */
export function ladderUsesProfileMetrics(
  classes: readonly { structured?: { conditions: readonly unknown[] } }[]
): boolean {
  const visit = (conditions: readonly unknown[]): boolean =>
    conditions.some((condition) => {
      if (typeof condition !== "object" || condition === null) return false
      if ("conditions" in condition) {
        return visit((condition as { conditions: readonly unknown[] }).conditions)
      }
      const metric = (condition as { metric?: RankMetric }).metric
      return Boolean(metric && PROFILE_METRICS.has(metric))
    })
  return classes.some((userClass) =>
    Boolean(userClass.structured && visit(userClass.structured.conditions))
  )
}

/**
 * The next step for an unknown metric, or null when profile reading cannot
 * supply it for this tracker. A completed read that simply lacks the value
 * also returns null: there is nothing the user can switch on.
 */
export function profileReadingHint(
  tracker: ProfileHintTracker,
  metric: RankMetric | null | undefined
): string | null {
  if (!metric || !PROFILE_METRICS.has(metric)) return null
  if (!supportsProfileReading(tracker)) return null
  if (!tracker.profileReadingEnabled) return PROFILE_HINT_TURN_ON
  if (tracker.hasProfileCookie === false) return PROFILE_HINT_ADD_COOKIE

  const record = readProfileReadRecord(tracker.platformMeta)
  if (record?.status === "session_expired") return PROFILE_HINT_EXPIRED
  if (record?.status === "page_changed") return PROFILE_HINT_PAGE_CHANGED
  if (!record?.fetchedAt) return PROFILE_HINT_WAITING
  return null
}

/** "15 days ago", "3 hours ago", "less than an hour ago". */
export function profileReadAgeText(fetchedAt: string, now: Date): string {
  const hours = profileReadAgeHours(fetchedAt, now)
  if (hours === null) return "an unknown time ago"
  if (hours < 1) return "less than an hour ago"
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

/**
 * The sentence shown when a finished profile read is older than the 24-hour
 * freshness window and no stop notice already covers it. The stored failure
 * message is mapped through the same plain wording the poll cards use, so the
 * panel names the cause without printing raw network errors.
 */
export function profileReadingStaleNotice(tracker: ProfileHintTracker, now: Date): string | null {
  // The turn-on and add-cookie hints already explain these states.
  if (tracker.profileReadingEnabled === false) return null
  if (tracker.hasProfileCookie === false) return null

  const record = readProfileReadRecord(tracker.platformMeta)
  if (!record?.fetchedAt || record.status) return null
  if (isProfileReadFresh(record, now)) return null

  const age = profileReadAgeText(record.fetchedAt, now)
  if (!record.message) {
    return `The last profile read was ${age}, so the values below may be out of date. Save this tracker's settings to try again.`
  }
  const cause = sanitizeNetworkError(record.message, "The site did not answer").replace(/\.+$/, "")
  return `The last profile read failed. ${cause}. The values below are from ${age}. Save a new session cookie in this tracker's settings to try again.`
}
