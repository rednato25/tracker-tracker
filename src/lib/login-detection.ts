// src/lib/login-detection.ts
//
// Which platform adapters can tell us when the account last logged in. The
// adapters not listed here never set `lastAccessDate`, so the app has no
// evidence and the dashboard must ask the operator to mark a login by hand.

import type { PlatformType } from "@/data/platform-types"
import { platformTypeLabel } from "@/data/platform-types"

export const LOGIN_DETECTING_PLATFORMS = [
  "avistaz",
  "carpt",
  "digitalcore",
  "filelist",
  "gazelle",
  "ggn",
  "mteam",
  "nebulance",
  "portugas",
  "retrotoon",
  "tr4ker",
  "unit3d",
] as const satisfies readonly PlatformType[]

const LOGIN_DETECTING_PLATFORM_SET: ReadonlySet<PlatformType> = new Set(
  LOGIN_DETECTING_PLATFORMS
)

export type LoginSource = "detected" | "manual" | "none"

/** True when the tracker's adapter reports a last-access date. */
export function canDetectLogin(platformType: string): boolean {
  return LOGIN_DETECTING_PLATFORM_SET.has(platformType as PlatformType)
}

/**
 * Where the recorded last login came from. A stored source wins. Rows written
 * before the source column existed fall back to the adapter capability, which
 * is right for the poll-written dates those rows normally carry.
 */
export function loginSourceFor(tracker: {
  lastAccessAt: string | null
  lastAccessSource?: "detected" | "manual" | null
  platformType: string
}): LoginSource {
  if (!tracker.lastAccessAt) return "none"
  if (tracker.lastAccessSource === "detected" || tracker.lastAccessSource === "manual") {
    return tracker.lastAccessSource
  }
  return canDetectLogin(tracker.platformType) ? "detected" : "manual"
}

/** Human names for the adapters that report a last-access value. */
export function loginDetectingPlatformLabels(): string[] {
  return LOGIN_DETECTING_PLATFORMS.map((platform) => platformTypeLabel(platform))
}
