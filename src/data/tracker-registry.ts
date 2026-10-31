// src/data/tracker-registry.ts

import type { PlatformType } from "@/data/platform-types"
import type { RankRequirementGroup } from "@/lib/rank-goals"
import type { SatisfactionMode } from "@/lib/satisfaction"
import type { TrackerCredentialFieldDefinition } from "@/lib/tracker-credentials/types"
import type { GazelleAuthStyle, NebulanceAuthParam, Unit3dAuthStyle } from "./platform-types"
import { ALL_TRACKERS } from "./trackers"

export interface ReleaseGroup {
  name: string
  description?: string
}

export type RankPerkType =
  | "download-slots"
  | "upload"
  | "invite"
  | "freeleech"
  | "double-upload"
  | "hnr-immune"
  | "mod-bypass"
  | "custom"

export interface RankPerk {
  type: RankPerkType
  label: string
}

/** One branch of a rank ladder that splits after a shared prefix. */
export interface TrackerRankPath {
  id: string
  label: string
  description?: string
}

export interface TrackerUserClass {
  name: string
  requirements?: string
  /** Structured conditions only where the source states a clear threshold. */
  structured?: RankRequirementGroup
  perks?: RankPerk[]
  icon?: string
  /**
   * Set on classes that are not rungs of the earned progression; the
   * dashboard rank stacks leave them out. "above": granted by staff, donation
   * or invitation, so a member holding one shows a full stack under that
   * name. "below": a ratio demotion or an administrative state such as Banned
   * or Validating, so a member holding one shows an empty stack under that
   * name. Unset means the class is reached by stats. LST's Leech is its entry
   * class, not a demotion, which is why the field is set per entry rather
   * than inferred from the name.
   */
  outsideLadder?: "above" | "below"
  /**
   * Id of the branch this class belongs to when the ladder splits. Unset on
   * the shared prefix; requires the entry to declare `rankPaths`.
   */
  path?: string
}

export type RuleSource = "manual" | "api" | "snapshot" | "profile" | "unknown"

/** What the timestamp beside a value actually describes. */
export type RuleTimestampKind = "metric" | "snapshot" | "unknown"

export type RuleFreshness = "fresh" | "stale" | "unknown"

export interface RuleProvenance {
  source: RuleSource
  /** ISO 8601 instant with an explicit source. Never inferred from a poll. */
  verifiedAt: string | null
  timestampKind: RuleTimestampKind
  freshness: RuleFreshness
  note?: string
}

/**
 * Provenance is tracked only for fields consumed by actions and the
 * calculator. An absent block means "not verified", not "verified just now".
 * A snapshot timestamp describes the snapshot, not independent per-metric
 * checks, which is why `timestampKind` is separate from `freshness`.
 */
export interface TrackerRulesProvenance {
  accountRatio?: RuleProvenance
  torrentRatio?: RuleProvenance
  accountedTransfer?: RuleProvenance
  hitAndRun?: RuleProvenance
  login?: RuleProvenance
  seeding?: RuleProvenance
}

export interface TrackerRules {
  /**
   * Account-wide minimum. 0 = a known "no minimum"; null/undefined = unknown.
   * Read through `resolveTrackerRules`, not directly, so legacy entries keep
   * their historical meaning.
   */
  requiredAccountRatio?: number | null
  /**
   * Per-torrent ratio required for H&R/seed satisfaction. 0 = known "ratio is
   * not a route"; null/undefined = unknown. This is deliberately separate from
   * the account minimum.
   */
  requiredTorrentRatio?: number | null
  /** Legacy account-level field. Kept for read compatibility during P03. */
  minimumRatio: number // 0 = no minimum
  seedTimeHours: number // 0 = no minimum
  /**
   * How the per-torrent requirements above combine. See `@/lib/satisfaction`.
   *
   * Omit it unless the tracker's own rules have been read. Without a mode, seed
   * time alone decides satisfaction and `minimumRatio` is the account-level
   * figure for the ratio-danger alert.
   *
   * Setting `"any"` where the tracker means "and" marks torrents satisfied that
   * are not, which is how hit-and-runs are earned. Only set it from the site's
   * own wording.
   */
  satisfactionMode?: SatisfactionMode
  loginIntervalDays: number // days until prune/disable
  fulfillmentPeriodHours?: number // null = not applicable
  hnrBanLimit?: number // null = not applicable
  fullRulesMarkdown?: string[]
  provenance?: TrackerRulesProvenance
}

export interface TrackerRankRequirementsSource {
  url: string | null
  title: string
  accessedAt: string | null
  sourceLastModified: string | null
  verification: "published" | "unresolved"
  note: string
}

export interface TrackerRegistryEntry {
  slug: string
  name: string
  abbreviation?: string
  url: string
  description: string
  platform: PlatformType
  apiPath: string
  specialty: string
  contentCategories: string[]
  userClasses: TrackerUserClass[]
  /** Source and provenance for structured user-class requirements. */
  rankRequirementsSource?: TrackerRankRequirementsSource
  rankProgression?: "automatic" | "manual" | "mixed" | "unknown"
  rankUnresolved?: string[]
  /** Optional branches for ladders that split after a shared prefix. */
  rankPaths?: TrackerRankPath[]
  releaseGroups: (string | ReleaseGroup)[]
  notableMembers: string[]
  bannedGroups?: string[]
  stats?: {
    userCount?: number
    activeUsers?: number
    torrentCount?: number
    seedSize?: string
    statsUpdatedAt?: string
  }
  rules?: TrackerRules
  language?: string
  color: string
  logo?: string
  trackerHubSlug?: string
  statusPageUrl?: string
  /**
   * The tracker's own name for its bonus points, like TorrentLeech's "TL Points".
   * It replaces "Seedbonus" and "BON". Read it through registryBonusName().
   */
  bonusName?: string
  draft?: boolean
  warning?: boolean
  warningNote?: string
  /**
   * The tracker has permanently shut down. This is registry data, not adapter
   * data: a defunct tracker's API is gone, so nothing about it can be learned at
   * runtime. It has to be recorded here by hand alongside `warning`.
   */
  defunct?: boolean
  /** Short factual line about the shutdown, shown in the defunct banner. */
  defunctMessage?: string
  /** https:// link to the announcement (forum post, reddit thread, staff blog). */
  defunctLink?: string
  /**
   * Shutdown date as "YYYY-MM-DD", typed by hand. Same shape as a tracker
   * row's `joinedAt`, so `formatJoinedDate()` renders it at local midnight
   * with no timezone drift.
   */
  defunctDate?: string
  supportsTransitPapers?: boolean
  profileUrlPattern?: string
  gazelleAuthStyle?: GazelleAuthStyle
  gazelleEnrich?: boolean
  unit3dAuthStyle?: Unit3dAuthStyle
  /** Anthelion spells the key parameter without an underscore. Defaults to api_key. */
  nebulanceAuthParam?: NebulanceAuthParam
  /**
   * Which credential fields this tracker issues, overriding the platform defaults
   * in src/data/tracker-credential-defaults.ts. Resolve via
   * getDefaultCredentialFields(), never read directly.
   *
   * Public, git-committed data: these define which fields exist and must never
   * hold a user's actual values. TrackerCredentialFieldDefinition has no `value`
   * property precisely so a passkey cannot be pasted in here and leaked into git
   * history forever. User values live only in `trackers.encrypted_credentials`.
   */
  credentialFields?: readonly TrackerCredentialFieldDefinition[]
}

export const TRACKER_REGISTRY: TrackerRegistryEntry[] = ALL_TRACKERS.filter((t) => !t.draft)

export function getTrackerBySlug(slug: string): TrackerRegistryEntry | undefined {
  return TRACKER_REGISTRY.find((t) => t.slug === slug)
}

/**
 * The registry entry a tracker row points at. The row names it by slug; the URL
 * it stores is the poll address, never the key. Undefined for a row with no slug
 * (a pre-registry custom site) or a slug the registry no longer carries.
 */
export function registryEntryFor(tracker: {
  registrySlug: string | null
}): TrackerRegistryEntry | undefined {
  return tracker.registrySlug ? getTrackerBySlug(tracker.registrySlug) : undefined
}

/**
 * An entry's own name for its bonus points, or undefined for none. "" is none
 * too: the guide's general rule has entries write "" for a field they do not use.
 */
export function registryBonusName(entry: TrackerRegistryEntry | undefined): string | undefined {
  return entry?.bonusName || undefined
}

/**
 * The key both sides of a hostname lookup are reduced to. A `www.` prefix is
 * dropped because the registry spells MAM and TorrentLeech with one while a
 * stored row usually has not. Undefined for anything `new URL` refuses, which
 * a restored backup can carry because it never passed the create route's
 * validateHttpUrl.
 *
 * The startup backfill is the only caller: it is how a row that predates
 * `registrySlug` is matched to an entry once. Nothing else may reach the
 * registry by URL.
 */
export function registryHostname(url: string): string | undefined {
  try {
    return new URL(url.trim().toLowerCase()).hostname.replace(/^www\./, "")
  } catch {
    return undefined
  }
}
