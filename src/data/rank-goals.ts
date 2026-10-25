// src/data/rank-goals.ts
//
// P10 pilot definitions. These are intentionally separate from the registry's
// free-text userClasses: only conditions backed by a published source become
// structured goals. Unresolved trackers stay visible without invented values.

import type { RankRequirementGroup } from "@/lib/rank-goals"

const GiB = 1024 ** 3
const TiB = 1024 ** 4

export interface PilotRankSource {
  url: string | null
  title: string
  /** When the page was consulted, not when the tracker last edited it. */
  accessedAt: string | null
  /** The page's own modification date, kept separate from verification. */
  sourceLastModified: string | null
  verification: "published" | "unresolved"
  note: string
}

export interface PilotRankDefinition {
  trackerSlug: string
  trackerName: string
  progression: "automatic" | "manual" | "mixed" | "unknown"
  source: PilotRankSource
  goals: Record<string, RankRequirementGroup>
  unresolved: string[]
}

const torrentLeech: PilotRankDefinition = {
  trackerSlug: "torrentleech",
  trackerName: "TorrentLeech",
  progression: "automatic",
  source: {
    url: "https://wiki.torrentleech.org/doku.php/user_classes",
    title: "TorrentLeech Wiki — User Classes",
    accessedAt: "2026-10-25",
    sourceLastModified: "2021-09-03",
    verification: "published",
    note:
      "Official public wiki consulted 2026-10-25. Its own last-modified date is 2021-09-03 and is not treated as a fresh rule verification. The page calls promotion automatic; this app still only reports eligibility.",
  },
  goals: {
    "Power User": {
      mode: "all",
      conditions: [
        {
          kind: "numeric",
          id: "tl-power-age",
          metric: "accountAgeDays",
          comparison: "gte",
          requiredValue: 14,
          scope: "account",
          label: "At least 2 weeks registered",
        },
        {
          kind: "numeric",
          id: "tl-power-upload",
          metric: "uploadedBytes",
          comparison: "gt",
          requiredValue: 200 * GiB,
          scope: "account",
          verification: "unresolved",
          note:
            "The official page says GB/TB without establishing binary or decimal units; the upload condition is not used for eligibility until confirmed.",
          label: "More than 200 GiB uploaded",
        },
        {
          kind: "numeric",
          id: "tl-power-ratio",
          metric: "accountRatio",
          comparison: "gt",
          requiredValue: 1.1,
          scope: "account",
          label: "Ratio above 1.1",
        },
      ],
    },
    "Super User": {
      mode: "all",
      conditions: [
        {
          kind: "numeric",
          id: "tl-super-age",
          metric: "accountAgeDays",
          comparison: "gte",
          requiredValue: 84,
          scope: "account",
          label: "At least 12 weeks registered",
        },
        {
          kind: "numeric",
          id: "tl-super-upload",
          metric: "uploadedBytes",
          comparison: "gt",
          requiredValue: 1 * TiB,
          scope: "account",
          verification: "unresolved",
          note:
            "The official page says GB/TB without establishing binary or decimal units; the upload condition is not used for eligibility until confirmed.",
          label: "More than 1 TiB uploaded",
        },
        {
          kind: "numeric",
          id: "tl-super-ratio",
          metric: "accountRatio",
          comparison: "gt",
          requiredValue: 2.0,
          scope: "account",
          label: "Ratio above 2.0",
        },
      ],
    },
    "Extreme User": {
      mode: "all",
      conditions: [
        {
          kind: "numeric",
          id: "tl-extreme-age",
          metric: "accountAgeDays",
          comparison: "gte",
          requiredValue: 168,
          scope: "account",
          label: "At least 24 weeks registered",
        },
        {
          kind: "numeric",
          id: "tl-extreme-upload",
          metric: "uploadedBytes",
          comparison: "gt",
          requiredValue: 10 * TiB,
          scope: "account",
          verification: "unresolved",
          note:
            "The official page says GB/TB without establishing binary or decimal units; the upload condition is not used for eligibility until confirmed.",
          label: "More than 10 TiB uploaded",
        },
        {
          kind: "numeric",
          id: "tl-extreme-ratio",
          metric: "accountRatio",
          comparison: "gt",
          requiredValue: 5.0,
          scope: "account",
          label: "Ratio above 5.0",
        },
      ],
    },
    "TL GOD": {
      mode: "all",
      conditions: [
        {
          kind: "numeric",
          id: "tl-god-age",
          metric: "accountAgeDays",
          comparison: "gte",
          requiredValue: 364,
          scope: "account",
          label: "At least 52 weeks registered",
        },
        {
          kind: "numeric",
          id: "tl-god-upload",
          metric: "uploadedBytes",
          comparison: "gt",
          requiredValue: 50 * TiB,
          scope: "account",
          verification: "unresolved",
          note:
            "The official page says GB/TB without establishing binary or decimal units; the upload condition is not used for eligibility until confirmed.",
          label: "More than 50 TiB uploaded",
        },
        {
          kind: "numeric",
          id: "tl-god-ratio",
          metric: "accountRatio",
          comparison: "gt",
          requiredValue: 8.0,
          scope: "account",
          label: "Ratio above 8.0",
        },
      ],
    },
  },
  unresolved: [
    "The wiki expresses transfer thresholds in GB/TB; this pilot uses binary GiB/TiB to match the app's byte display. The tracker's exact display convention is not stated.",
    "Seeding-time, points bonuses and VIP/staff appointment are not promotion thresholds for the structured next-rank goal.",
  ],
}

const myAnonaMouse: PilotRankDefinition = {
  trackerSlug: "myanonamouse",
  trackerName: "MyAnonaMouse",
  progression: "mixed",
  source: {
    url: null,
    title: "Existing registry free text; official wiki not publicly readable",
    accessedAt: null,
    sourceLastModified: null,
    verification: "unresolved",
    note:
      "The official wiki returned 403 to an unauthenticated request. No threshold was encoded from the registry prose.",
  },
  goals: {},
  unresolved: [
    "Need the exact official MyAnonaMouse Power User/Elite promotion excerpt, including account-age unit and upload threshold.",
    "Need confirmation whether any promotion path is manual or automatic.",
  ],
}

const redacted: PilotRankDefinition = {
  trackerSlug: "redacted",
  trackerName: "REDacted",
  progression: "mixed",
  source: {
    url: null,
    title: "Existing registry free text; official wiki requires a login",
    accessedAt: null,
    sourceLastModified: null,
    verification: "unresolved",
    note:
      "The official wiki is login-gated. Registry text was not promoted into structured thresholds.",
  },
  goals: {},
  unresolved: [
    "Need the official classes article excerpts for Member/Power User/Elite, including upload counts, account age and ratio boundary semantics.",
    "Need confirmation of branch/manual classes and demotion thresholds.",
  ],
}

export const PILOT_RANK_DEFINITIONS: Record<string, PilotRankDefinition> = {
  torrentleech: torrentLeech,
  myanonamouse: myAnonaMouse,
  redacted,
}

export function pilotRankDefinition(slug: string | null | undefined): PilotRankDefinition | null {
  if (!slug) return null
  return PILOT_RANK_DEFINITIONS[slug] ?? null
}
