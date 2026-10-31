//
// P57 proof-account view models for a target's profile. These helpers read the
// accounts the user already owns and build the public profile URL from the
// registry's pattern.
//
// Nothing here reads credentials, cookies, IP addresses or email addresses.

import { getTrackerBySlug } from "@/data/tracker-registry"
import { formatRatioDisplay } from "@/lib/formatters"
import { isRedacted } from "@/lib/privacy"
import type { TrackerSummary } from "@/types/api"

const DAY_MS = 24 * 60 * 60 * 1000

export interface ProofAccountView {
  trackerId: number
  trackerName: string
  registrySlug: string | null
  className: string | null
  joinedAt: string | null
  accountAgeDays: number | null
  ratio: number | null
  ratioIsInfinite: boolean
  /** Null when the registry has no pattern or the username/id is unknown. */
  profileUrl: string | null
}

function joinedDate(joinedAt: string | null): Date | null {
  if (!joinedAt) return null
  const bare = /^\d{4}-\d{2}-\d{2}$/.test(joinedAt)
  const joined = new Date(bare ? `${joinedAt}T00:00:00` : joinedAt)
  return Number.isNaN(joined.getTime()) ? null : joined
}

export function proofAccountAgeDays(joinedAt: string | null, now: Date): number | null {
  const joined = joinedDate(joinedAt)
  if (!joined) return null
  return Math.max(0, Math.floor((now.getTime() - joined.getTime()) / DAY_MS))
}

/**
 * Fills the registry's profile URL pattern with the account's own username or
 * numeric id. A redacted username is not a username, so the link is omitted
 * rather than pointing at a marker string. Any unresolved placeholder also
 * omits the link: a wrong profile is worse than no profile.
 */
export function buildProofProfileUrl(input: {
  baseUrl: string
  pattern: string | null | undefined
  username: string | null
  userId: number | null
}): string | null {
  const pattern = input.pattern?.trim()
  if (!pattern) return null

  let path = pattern
  if (path.includes("{username}")) {
    if (!input.username || isRedacted(input.username)) return null
    path = path.replaceAll("{username}", encodeURIComponent(input.username))
  }
  if (path.includes("{id}")) {
    if (input.userId === null || !Number.isInteger(input.userId)) return null
    path = path.replaceAll("{id}", String(input.userId))
  }
  if (path.includes("{username}") || path.includes("{id}")) return null

  try {
    return new URL(path, input.baseUrl).toString()
  } catch {
    return null
  }
}

export function buildProofAccounts(trackers: TrackerSummary[], now: Date): ProofAccountView[] {
  return trackers.map((tracker) => {
    const entry = tracker.registrySlug ? getTrackerBySlug(tracker.registrySlug) : undefined
    return {
      trackerId: tracker.id,
      trackerName: tracker.name,
      registrySlug: tracker.registrySlug,
      className: tracker.latestStats?.group ?? null,
      joinedAt: tracker.joinedAt,
      accountAgeDays: proofAccountAgeDays(tracker.joinedAt, now),
      ratio: tracker.latestStats?.ratio ?? null,
      ratioIsInfinite: tracker.latestStats?.ratioIsInfinite ?? false,
      profileUrl: buildProofProfileUrl({
        baseUrl: tracker.baseUrl,
        pattern: entry?.profileUrlPattern,
        username: tracker.latestStats?.username ?? null,
        userId: tracker.remoteUserId,
      }),
    }
  })
}

export function proofRatioLabel(account: ProofAccountView): string {
  if (account.ratioIsInfinite) return "∞x"
  return formatRatioDisplay(account.ratio)
}
