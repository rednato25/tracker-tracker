//
// P57 proof-account view models for a target's profile. These helpers read the
// accounts the user already owns, build the public profile URL from the
// registry's pattern, and answer a single question: could I use this account as
// proof in an application today?
//
// Nothing here reads credentials, cookies, IP addresses or email addresses.

import { getTrackerBySlug } from "@/data/tracker-registry"
import { formatRatioDisplay } from "@/lib/formatters"
import { isRedacted } from "@/lib/privacy"
import type { TrackerSummary } from "@/types/api"

const DAY_MS = 24 * 60 * 60 * 1000
/** Average Gregorian month, so "6 months" is not silently 180 or 183 days. */
const DAYS_PER_MONTH = 30.4375

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

export type ProofBlockReason = "age" | "ratio"

export interface ProofAccountRow {
  account: ProofAccountView
  qualifies: boolean
  /** Whole days until the age filter is met; null when it cannot be computed. */
  daysUntilQualifies: number | null
  /** Local date-only value for the day the age filter is met. */
  qualifiesOn: string | null
  blockedBy: ProofBlockReason | null
}

export interface ProofFilter {
  minAgeMonths: number
  minRatio: number
}

export interface ProofRequirement {
  count: number
  ageMonths: number
  sourceText: string
}

function joinedDate(joinedAt: string | null): Date | null {
  if (!joinedAt) return null
  const bare = /^\d{4}-\d{2}-\d{2}$/.test(joinedAt)
  const joined = new Date(bare ? `${joinedAt}T00:00:00` : joinedAt)
  return Number.isNaN(joined.getTime()) ? null : joined
}

function dateOnly(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function proofAccountAgeDays(joinedAt: string | null, now: Date): number | null {
  const joined = joinedDate(joinedAt)
  if (!joined) return null
  return Math.max(0, Math.floor((now.getTime() - joined.getTime()) / DAY_MS))
}

export function proofAgeRequirementDays(minAgeMonths: number): number {
  return Math.max(0, Math.round(Math.max(0, minAgeMonths) * DAYS_PER_MONTH))
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

function ratioMeetsFilter(account: ProofAccountView, minRatio: number): boolean {
  if (minRatio <= 0) return true
  if (account.ratioIsInfinite) return true
  if (account.ratio === null || !Number.isFinite(account.ratio)) return false
  return account.ratio >= minRatio
}

/**
 * Applies the two filters and dates the moment each account becomes old enough.
 * Ratio is a snapshot, so a ratio below the filter has no projected date; the
 * account can still qualify by age but cannot be promised a future date.
 */
export function evaluateProofAccounts(
  accounts: ProofAccountView[],
  filter: ProofFilter,
  now: Date
): ProofAccountRow[] {
  const requiredDays = proofAgeRequirementDays(filter.minAgeMonths)
  const rows = accounts.map<ProofAccountRow>((account) => {
    const ageMeets =
      account.accountAgeDays === null
        ? filter.minAgeMonths <= 0
        : account.accountAgeDays >= requiredDays
    const ratioMeets = ratioMeetsFilter(account, filter.minRatio)

    let daysUntilQualifies: number | null = null
    let qualifiesOn: string | null = null
    let blockedBy: ProofBlockReason | null = null

    if (!ratioMeets) {
      blockedBy = "ratio"
    } else if (!ageMeets) {
      blockedBy = "age"
      const joined = joinedDate(account.joinedAt)
      if (joined) {
        const qualifiesAt = joined.getTime() + requiredDays * DAY_MS
        daysUntilQualifies = Math.max(1, Math.ceil((qualifiesAt - now.getTime()) / DAY_MS))
        qualifiesOn = dateOnly(new Date(now.getTime() + daysUntilQualifies * DAY_MS))
      }
    }

    return {
      account,
      qualifies: blockedBy === null,
      daysUntilQualifies,
      qualifiesOn,
      blockedBy,
    }
  })

  return rows.sort((a, b) => {
    const aRank = a.qualifies ? 0 : a.daysUntilQualifies !== null ? 1 : 2
    const bRank = b.qualifies ? 0 : b.daysUntilQualifies !== null ? 1 : 2
    if (aRank !== bRank) return aRank - bRank
    const aDays = a.daysUntilQualifies ?? Number.POSITIVE_INFINITY
    const bDays = b.daysUntilQualifies ?? Number.POSITIVE_INFINITY
    if (aDays !== bDays) return aDays - bDays
    return a.account.trackerName.localeCompare(b.account.trackerName)
  })
}

/**
 * Parses only requirement text that both names proof links (or uses the
 * "3x 6 months" shorthand) and states an age. Everything else stays prose.
 */
export function parseProofRequirement(text: string | null | undefined): ProofRequirement | null {
  const sourceText = text?.trim()
  if (!sourceText) return null

  const ageUnitMonths = (amount: number, unit: string): number =>
    /^y/i.test(unit) ? amount * 12 : amount

  const shorthand = /(\d{1,3})\s*[x×]\s*(\d{1,3})\s*(?:-\s*)?(months?|mo|years?|yrs?)\b/i.exec(
    sourceText
  )
  if (shorthand) {
    const count = Number.parseInt(shorthand[1] ?? "", 10)
    const amount = Number.parseInt(shorthand[2] ?? "", 10)
    const ageMonths = ageUnitMonths(amount, shorthand[3] ?? "")
    if (count > 0 && ageMonths > 0) return { count, ageMonths, sourceText }
  }

  const proofCount =
    /(\d{1,3})\s+(?:extra\s+)?(?:tracker\s+proofs?|profile\s+links?|proof\s+links?)\b/i.exec(
      sourceText
    )
  if (!proofCount) return null
  const age = /(\d{1,3})\s*(?:-\s*)?(months?|mo|years?|yrs?)\b/i.exec(sourceText)
  if (!age) return null

  const count = Number.parseInt(proofCount[1] ?? "", 10)
  const amount = Number.parseInt(age[1] ?? "", 10)
  const ageMonths = ageUnitMonths(amount, age[2] ?? "")
  if (count <= 0 || ageMonths <= 0) return null
  return { count, ageMonths, sourceText }
}

export function findProofRequirement(texts: (string | null | undefined)[]): ProofRequirement | null {
  for (const text of texts) {
    const parsed = parseProofRequirement(text)
    if (parsed) return parsed
  }
  return null
}

export interface ProofNextQualification {
  accountName: string
  days: number
  date: string
}

/** The soonest account that becomes old enough and already meets the ratio. */
export function nextProofQualification(rows: ProofAccountRow[]): ProofNextQualification | null {
  let next: ProofNextQualification | null = null
  for (const row of rows) {
    if (row.qualifies || row.blockedBy !== "age") continue
    if (row.daysUntilQualifies === null || row.qualifiesOn === null) continue
    if (next === null || row.daysUntilQualifies < next.days) {
      next = {
        accountName: row.account.trackerName,
        days: row.daysUntilQualifies,
        date: row.qualifiesOn,
      }
    }
  }
  return next
}
