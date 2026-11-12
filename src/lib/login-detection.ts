// src/lib/login-detection.ts
//
// Which platform adapters can tell us when the account last logged in. That
// list still answers "can this platform ever report a login?", but the card
// asks a stricter question: did this tracker's latest successful poll actually
// return a value? Only the stored source can answer that, so a platform that
// sometimes reports a date no longer turns every old row into a detected one.

import type { PlatformType } from "@/data/platform-types"
import { platformTypeLabel } from "@/data/platform-types"
import { supportsProfileReading } from "@/lib/profile-reading/support"

export const LOGIN_DETECTING_PLATFORMS = [
  "apime",
  "avistaz",
  "carpt",
  "czteam",
  "digitalcore",
  "filelist",
  "gazelle",
  "ggn",
  "iptorrents",
  "luminance",
  "mteam",
  "nebulance",
  "portugas",
  "retrotoon",
  "teamhd",
  "tr4ker",
] as const satisfies readonly PlatformType[]

const LOGIN_DETECTING_PLATFORM_SET: ReadonlySet<PlatformType> = new Set(
  LOGIN_DETECTING_PLATFORMS
)

export type LoginSource = "detected" | "manual" | "none"

/** True when the tracker's adapter is able to report a last-access date. */
export function canDetectLogin(platformType: string): boolean {
  return LOGIN_DETECTING_PLATFORM_SET.has(platformType as PlatformType)
}

/**
 * Where the recorded last login came from. The stored source is the only
 * evidence: a date persists after the API stops returning it, and the poll that
 * saw the gap writes "manual" so the card offers the button again. Rows written
 * before the source column existed are treated as manual too, because nothing
 * proves their latest poll returned the value.
 */
export function loginSourceFor(tracker: {
  lastAccessAt: string | null
  lastAccessSource?: "detected" | "manual" | null
}): LoginSource {
  if (!tracker.lastAccessAt) return "none"
  return tracker.lastAccessSource === "detected" ? "detected" : "manual"
}

/**
 * One sentence for the settings sheet about this tracker only. Stock UNIT3D's
 * API has no login date; the opt-in profile read supplies it where supported.
 */
export function loginDetectionNote(tracker: {
  platformType: string
  registrySlug?: string | null
  profileReadingEnabled?: boolean
}): string {
  if (canDetectLogin(tracker.platformType)) {
    return `${platformTypeLabel(tracker.platformType)} reports the last login, so it updates on its own.`
  }
  if (tracker.platformType === "unit3d" && supportsProfileReading(tracker)) {
    return tracker.profileReadingEnabled
      ? "Read from your profile page each day."
      : "Turn on “Read profile page daily” below to update it on its own."
  }
  return "This tracker doesn't report logins, so mark them here."
}
