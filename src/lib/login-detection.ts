// src/lib/login-detection.ts
//
// Which platform adapters can tell us when the account last logged in. The
// adapters not listed here never set `lastAccessDate`, so the app has no
// evidence and the dashboard must ask the operator to mark a login by hand.

import type { PlatformType } from "@/data/platform-types"

const LOGIN_DETECTING_PLATFORMS: ReadonlySet<PlatformType> = new Set([
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
])

/** True when the tracker's adapter reports a last-access date. */
export function canDetectLogin(platformType: string): boolean {
  return LOGIN_DETECTING_PLATFORMS.has(platformType as PlatformType)
}
