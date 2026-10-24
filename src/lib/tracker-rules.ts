// src/lib/tracker-rules.ts
//
// P03: one read model for tracker requirements.
//
// `minimumRatio` historically meant "account minimum" in the registry but was
// also read as a per-torrent ratio when `satisfactionMode` was present. New
// code should use `requiredAccountRatio` and `requiredTorrentRatio`; this
// resolver keeps every legacy entry working without rewriting its values.
//
// Functions: resolveTrackerRules, resolveAccountRatio

import type {
  RuleFreshness,
  RuleProvenance,
  RuleTimestampKind,
  TrackerRules,
} from "@/data/tracker-registry"

export interface TrackerRuleContext {
  /** Latest poll figure. `0` is a real requirement, `null` is unknown. */
  liveRequiredAccountRatio?: number | null
  /** Timestamp of the snapshot that supplied live figures, not a metric check. */
  snapshotAt?: string | Date | null
  now?: Date
  /** Defaults to 24 hours. Snapshot age only; not a verification claim. */
  staleAfterMs?: number
  /** Manually marked login date. An API poll never supplies this. */
  loginLastAccessAt?: string | null
}

export interface ResolvedTrackerRules {
  requiredAccountRatio: number | null
  requiredTorrentRatio: number | null
  seedTimeHours: number | null
  satisfactionMode: "any" | "all" | null
  loginIntervalDays: number | null
  loginEvidence: "manual" | "none"
  hnrBanLimit: number | null
  fulfillmentPeriodHours: number | null
  provenance: {
    accountRatio: RuleProvenance
    torrentRatio: RuleProvenance
    accountedTransfer: RuleProvenance
    hitAndRun: RuleProvenance
    login: RuleProvenance
    seeding: RuleProvenance
  }
}

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_STALE_AFTER_MS = DAY_MS

const UNKNOWN_PROVENANCE: RuleProvenance = {
  source: "unknown",
  verifiedAt: null,
  timestampKind: "unknown",
  freshness: "unknown",
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function timestamp(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function freshnessFor(
  snapshotAt: string | Date | null | undefined,
  now: Date,
  staleAfterMs: number
): { freshness: RuleFreshness; timestampKind: RuleTimestampKind; verifiedAt: string | null } {
  const at = timestamp(snapshotAt)
  if (!at) {
    return { freshness: "unknown", timestampKind: "unknown", verifiedAt: null }
  }
  const age = now.getTime() - at.getTime()
  return {
    freshness: age <= staleAfterMs ? "fresh" : "stale",
    // The timestamp describes the snapshot, not an independent per-metric
    // verification. `verifiedAt` stays null so callers cannot mistake it.
    timestampKind: "snapshot",
    verifiedAt: null,
  }
}

function supplied(
  rules: TrackerRules | undefined,
  field: keyof NonNullable<TrackerRules["provenance"]>,
  fallback: RuleProvenance
): RuleProvenance {
  return rules?.provenance?.[field] ?? fallback
}

function defaultProvenance(rules: TrackerRules | undefined): RuleProvenance {
  if (!rules) return UNKNOWN_PROVENANCE
  // A registry value is curated, but without an explicit confirmation record it
  // is still unverified. Do not turn the absence of a date into a manual claim.
  return {
    source: "unknown",
    verifiedAt: null,
    timestampKind: "unknown",
    freshness: "unknown",
    note: "Registry value has no confirmation metadata",
  }
}

function withNote(
  provenance: RuleProvenance,
  note: string
): RuleProvenance {
  return { ...provenance, note }
}

function liveProvenance(
  context: TrackerRuleContext,
  now: Date,
  staleAfterMs: number
): RuleProvenance {
  const { freshness, timestampKind, verifiedAt } = freshnessFor(
    context.snapshotAt,
    now,
    staleAfterMs
  )
  return {
    source: "api",
    verifiedAt,
    timestampKind,
    freshness,
    note:
      timestampKind === "snapshot"
        ? "Value came from the poll; the timestamp is snapshot age, not an independent metric check."
        : "Value came from the poll, but no snapshot timestamp is available.",
  }
}

/**
 * Resolve account-level and per-torrent requirements without letting one leak
 * into the other. Legacy `minimumRatio` is read as the account requirement,
 * and as the torrent requirement only for entries that already declared a
 * `satisfactionMode` (the old behavior).
 */
export function resolveTrackerRules(
  rules?: TrackerRules,
  context: TrackerRuleContext = {}
): ResolvedTrackerRules {
  const now = context.now ?? new Date()
  const staleAfterMs = context.staleAfterMs ?? DEFAULT_STALE_AFTER_MS
  const baseManual = defaultProvenance(rules)

  let requiredAccountRatio: number | null = null
  let accountProvenance = supplied(rules, "accountRatio", baseManual)

  if (finiteNonNegative(context.liveRequiredAccountRatio)) {
    requiredAccountRatio = context.liveRequiredAccountRatio
    accountProvenance = liveProvenance(context, now, staleAfterMs)
  } else if (rules?.requiredAccountRatio !== undefined) {
    // An explicit null means "unknown", not a zero requirement.
    requiredAccountRatio =
      rules.requiredAccountRatio !== null && finiteNonNegative(rules.requiredAccountRatio)
        ? rules.requiredAccountRatio
        : null
    accountProvenance =
      requiredAccountRatio === null
        ? withNote(accountProvenance, "Explicitly unknown in the registry")
        : accountProvenance
  } else if (rules?.minimumRatio !== undefined && finiteNonNegative(rules.minimumRatio)) {
    requiredAccountRatio = rules.minimumRatio
    accountProvenance = withNote(
      accountProvenance,
      "Derived from the legacy minimumRatio field"
    )
  }

  let requiredTorrentRatio: number | null = null
  let torrentProvenance = supplied(rules, "torrentRatio", baseManual)

  if (rules?.requiredTorrentRatio !== undefined) {
    requiredTorrentRatio =
      rules.requiredTorrentRatio !== null && finiteNonNegative(rules.requiredTorrentRatio)
        ? rules.requiredTorrentRatio
        : null
    if (requiredTorrentRatio === null) {
      torrentProvenance = withNote(
        torrentProvenance,
        "Explicitly unknown in the registry; the account ratio is not used"
      )
    }
  } else if (
    rules?.satisfactionMode &&
    finiteNonNegative(rules.minimumRatio) &&
    rules.minimumRatio > 0
  ) {
    // Only legacy entries that opted into a mode ever used minimumRatio per
    // torrent. New entries must set requiredTorrentRatio explicitly.
    requiredTorrentRatio = rules.minimumRatio
    torrentProvenance = withNote(
      torrentProvenance,
      "Legacy minimumRatio reused because satisfactionMode was already declared"
    )
  }

  const seedTimeHours =
    rules && finiteNonNegative(rules.seedTimeHours) ? rules.seedTimeHours : null
  const hasRoute = requiredTorrentRatio !== null || (seedTimeHours ?? 0) > 0
  const satisfactionMode = hasRoute
    ? (rules?.satisfactionMode ?? "all")
    : null

  const loginIntervalDays =
    rules && finiteNonNegative(rules.loginIntervalDays) ? rules.loginIntervalDays : null
  const loginEvidence: "manual" | "none" = context.loginLastAccessAt ? "manual" : "none"
  const loginProvenance = supplied(rules, "login", baseManual)

  const transfer = freshnessFor(context.snapshotAt, now, staleAfterMs)

  return {
    requiredAccountRatio,
    requiredTorrentRatio,
    seedTimeHours,
    satisfactionMode,
    loginIntervalDays,
    loginEvidence,
    hnrBanLimit: rules?.hnrBanLimit ?? null,
    fulfillmentPeriodHours: rules?.fulfillmentPeriodHours ?? null,
    provenance: {
      accountRatio: accountProvenance,
      torrentRatio: torrentProvenance,
      accountedTransfer: {
        source: transfer.timestampKind === "snapshot" ? "snapshot" : "unknown",
        verifiedAt: transfer.verifiedAt,
        timestampKind: transfer.timestampKind,
        freshness: transfer.freshness,
        note:
          transfer.timestampKind === "snapshot"
            ? "Snapshot age, not an independent per-metric verification."
            : "No snapshot timestamp is available.",
      },
      hitAndRun: supplied(rules, "hitAndRun", baseManual),
      login:
        loginEvidence === "manual"
          ? withNote(
              loginProvenance,
              "Manual login marker; opening the site or polling does not prove a website login."
            )
          : withNote(
              loginProvenance,
              "No confirmed website login is on record; opening the site or polling does not prove one."
            ),
      seeding: supplied(rules, "seeding", baseManual),
    },
  }
}

/** Account minimum only. Per-torrent rules never feed this value. */
export function resolveAccountRatio(
  liveRequiredRatio: number | null | undefined,
  rules?: TrackerRules
): number | null {
  return resolveTrackerRules(rules, { liveRequiredAccountRatio: liveRequiredRatio })
    .requiredAccountRatio
}
