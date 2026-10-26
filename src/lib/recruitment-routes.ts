// src/lib/recruitment-routes.ts
//
// P17 recruitment-route format and offline evaluator.
//
// The format deliberately separates three things that are easy to confuse:
//   1. requirement eligibility (met/unmet/unknown from structured observations),
//   2. recruitment availability (open/closed/unknown from the cited source),
//   3. invitation/admission reality (always unknown; nobody can guarantee it).
//
// Free text stays readable. Only the community dataset's explicit `days` field
// becomes a structured account-age condition. No prose is guessed into
// thresholds, and nothing here fetches data or touches the database.

import type {
  RankGoalStatus,
  RankGroupResult,
  RankObservationMap,
  RankRequirementGroup,
} from "@/lib/rank-goals"
import { evaluateRequirementGroup } from "@/lib/rank-goals"

export const RECRUITMENT_ROUTE_FORMAT_VERSION = 1

/** Community data older than this is called stale. It is never called verified. */
export const RECRUITMENT_SOURCE_STALE_AFTER_DAYS = 180

export type RecruitmentAvailability = "open" | "closed" | "unknown"
export type RecruitmentFreshness = "fresh" | "stale" | "unknown"

export interface RecruitmentSourceRecord {
  id: string
  name: string
  url: string
  license: string
  licenseUrl: string
  copyright: string
  /** Pinned upstream commit, not a moving branch. */
  version: string
  snapshotUrl: string
  /** When this project took the snapshot. Never a verification date. */
  accessedAt: string
  attribution: string
}

export interface RecruitmentRouteRecord {
  id: string
  sourceTrackerId: string
  destinationTrackerId: string
  /**
   * Only conditions supported by an explicit source field. `null` means the
   * source has no structured requirements, not that there are none.
   */
  requirements: RankRequirementGroup | null
  /** Source prose kept readable because it cannot be evaluated safely. */
  requirementNotes: string[]
  availability: RecruitmentAvailability
  availabilityRaw: string
  /** `YYYY-MM` at month precision; distinct from access/verification dates. */
  sourceUpdatedAt: string | null
  sourceUpdatedRaw: string | null
}

export interface RecruitmentRouteOverride {
  routeId: string
  author: string
  authoredAt: string
  provenanceUrl: string
  /** A locally verified observation; required so an override is not anonymous. */
  verifiedAt: string
  availability?: RecruitmentAvailability
  requirements?: RankRequirementGroup | null
  requirementNotes?: string[]
  note?: string
}

export interface RecruitmentCatalog {
  formatVersion: typeof RECRUITMENT_ROUTE_FORMAT_VERSION
  source: RecruitmentSourceRecord
  routes: RecruitmentRouteRecord[]
  overrides: RecruitmentRouteOverride[]
}

export interface RecruitmentEvaluationInput {
  observations: RankObservationMap
  joinedAt?: string | null
  now: Date
}

export interface RecruitmentRouteEvaluation {
  formatVersion: typeof RECRUITMENT_ROUTE_FORMAT_VERSION
  routeId: string
  sourceTrackerId: string
  destinationTrackerId: string
  eligibility: {
    status: RankGoalStatus
    progress: { met: number; unmet: number; unknown: number; total: number }
    structured: RankGroupResult | null
    requirementNotes: string[]
    originalRequirementNotes: string[]
    reason: string
  }
  availability: {
    status: RecruitmentAvailability
    confirmed: boolean
    source: "community-dataset" | "local-override"
    raw: string
    originalStatus: RecruitmentAvailability
    note: string
  }
  evidence: {
    source: RecruitmentSourceRecord
    sourceUpdatedAt: string | null
    sourceUpdatedRaw: string | null
    sourceAccessedAt: string
    lastVerifiedAt: string | null
    sourceFreshness: RecruitmentFreshness
    evidenceFreshness: RecruitmentFreshness
    sourceAgeDays: number | null
    caveat: string
  }
  override: {
    author: string
    authoredAt: string
    provenanceUrl: string
    verifiedAt: string
    note: string | null
  } | null
  invitation: {
    guaranteed: false
    activeRecruiter: "unknown"
    admission: "unknown"
    note: string
  }
}

const EMPTY_PROGRESS = { met: 0, unmet: 0, unknown: 0, total: 0 }
const DAY_MS = 86_400_000

function parseMonthStart(value: string | null): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return new Date(Date.UTC(year, month - 1, 1))
}

function parseInstant(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function ageDays(from: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / DAY_MS))
}

function dateFreshness(from: Date | null, now: Date): RecruitmentFreshness {
  if (!from) return "unknown"
  return ageDays(from, now) > RECRUITMENT_SOURCE_STALE_AFTER_DAYS ? "stale" : "fresh"
}

function evaluateStructured(
  requirements: RankRequirementGroup | null,
  input: RecruitmentEvaluationInput
): { status: RankGoalStatus; structured: RankGroupResult | null; progress: typeof EMPTY_PROGRESS; reason: string } {
  if (!requirements) {
    return {
      status: "unknown",
      structured: null,
      progress: { ...EMPTY_PROGRESS },
      reason:
        "No structured requirements are supported by the cited source; only readable notes are available.",
    }
  }

  const structured = evaluateRequirementGroup(requirements, {
    userClasses: [],
    currentRank: null,
    observations: input.observations,
    joinedAt: input.joinedAt,
    now: input.now,
  })

  if (structured.progress.total === 0) {
    return {
      status: "unknown",
      structured,
      progress: structured.progress,
      reason: "The structured requirement group is empty, so eligibility cannot be evaluated.",
    }
  }

  const reason =
    structured.status === "met"
      ? "All structured requirements are met; this says nothing about an active recruiter or invitation."
      : structured.status === "unmet"
        ? "At least one structured requirement is unmet."
        : "A structured observation is missing, stale or unverified, so eligibility remains unknown."
  return { status: structured.status, structured, progress: structured.progress, reason }
}

export function evaluateRecruitmentRoute(
  catalog: RecruitmentCatalog,
  routeId: string,
  input: RecruitmentEvaluationInput
): RecruitmentRouteEvaluation | null {
  const route = catalog.routes.find((candidate) => candidate.id === routeId)
  if (!route) return null
  const override = catalog.overrides.find((candidate) => candidate.routeId === routeId) ?? null

  const effectiveRequirements =
    override && "requirements" in override ? (override.requirements ?? null) : route.requirements
  const requirementNotes = override?.requirementNotes ?? route.requirementNotes
  const eligibility = evaluateStructured(effectiveRequirements, input)

  const sourceUpdated = parseMonthStart(route.sourceUpdatedAt)
  const verified = override ? parseInstant(override.verifiedAt) : null
  const sourceFreshness = dateFreshness(sourceUpdated, input.now)
  const evidenceFreshness = override ? dateFreshness(verified, input.now) : "unknown"

  const availability = override?.availability ?? route.availability
  const availabilityConfirmed = override?.availability !== undefined

  return {
    formatVersion: RECRUITMENT_ROUTE_FORMAT_VERSION,
    routeId: route.id,
    sourceTrackerId: route.sourceTrackerId,
    destinationTrackerId: route.destinationTrackerId,
    eligibility: {
      status: eligibility.status,
      progress: eligibility.progress,
      structured: eligibility.structured,
      requirementNotes,
      originalRequirementNotes: route.requirementNotes,
      reason: eligibility.reason,
    },
    availability: {
      status: availability,
      confirmed: availabilityConfirmed,
      source: availabilityConfirmed ? "local-override" : "community-dataset",
      raw: route.availabilityRaw,
      originalStatus: route.availability,
      note: availabilityConfirmed
        ? "Availability was explicitly set by a dated local override."
        : "Availability is community-reported; no active recruiter was verified.",
    },
    evidence: {
      source: catalog.source,
      sourceUpdatedAt: route.sourceUpdatedAt,
      sourceUpdatedRaw: route.sourceUpdatedRaw,
      sourceAccessedAt: catalog.source.accessedAt,
      lastVerifiedAt: override?.verifiedAt ?? null,
      sourceFreshness,
      evidenceFreshness,
      sourceAgeDays: sourceUpdated ? ageDays(sourceUpdated, input.now) : null,
      caveat:
        "Accessing the source is not verification. Community data and local overrides do not prove an active recruiter, invitation or admission.",
    },
    override: override
      ? {
          author: override.author,
          authoredAt: override.authoredAt,
          provenanceUrl: override.provenanceUrl,
          verifiedAt: override.verifiedAt,
          note: override.note ?? null,
        }
      : null,
    invitation: {
      guaranteed: false,
      activeRecruiter: "unknown",
      admission: "unknown",
      note: "Meeting requirements never guarantees an active recruiter, an invitation or admission.",
    },
  }
}

export interface RecruitmentPath {
  routeIds: string[]
  hops: number
}

/**
 * Bounded depth-first path search over route edges. A visited set prevents a
 * cycle from producing infinite traversal; a path never revisits a tracker.
 */
export function findRecruitmentPaths(
  routes: RecruitmentRouteRecord[],
  fromTrackerId: string,
  toTrackerId: string,
  maxHops = 6
): RecruitmentPath[] {
  if (maxHops < 1 || fromTrackerId === toTrackerId) return []
  const bySource = new Map<string, RecruitmentRouteRecord[]>()
  for (const route of routes) {
    const list = bySource.get(route.sourceTrackerId) ?? []
    list.push(route)
    bySource.set(route.sourceTrackerId, list)
  }

  const paths: RecruitmentPath[] = []
  const visited = new Set<string>([fromTrackerId])

  const walk = (current: string, routeIds: string[], hops: number) => {
    if (hops >= maxHops) return
    for (const route of bySource.get(current) ?? []) {
      const destination = route.destinationTrackerId
      if (visited.has(destination)) continue
      const next = [...routeIds, route.id]
      if (destination === toTrackerId) {
        paths.push({ routeIds: next, hops: next.length })
        continue
      }
      visited.add(destination)
      walk(destination, next, hops + 1)
      visited.delete(destination)
    }
  }

  walk(fromTrackerId, [], 0)
  return paths
}

export interface RecruitmentCatalogValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validateRecruitmentCatalog(
  catalog: RecruitmentCatalog,
  validTrackerIds: readonly string[]
): RecruitmentCatalogValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const trackerIds = new Set(validTrackerIds)
  const routeIds = new Set<string>()
  const pairs = new Set<string>()
  const overrideIds = new Set<string>()

  for (const route of catalog.routes) {
    if (!route.id.trim()) errors.push("route has an empty id")
    if (routeIds.has(route.id)) errors.push(`duplicate route id: ${route.id}`)
    routeIds.add(route.id)

    if (!trackerIds.has(route.sourceTrackerId)) {
      errors.push(`${route.id}: unknown source tracker ${route.sourceTrackerId}`)
    }
    if (!trackerIds.has(route.destinationTrackerId)) {
      errors.push(`${route.id}: unknown destination tracker ${route.destinationTrackerId}`)
    }
    if (route.sourceTrackerId === route.destinationTrackerId) {
      errors.push(`${route.id}: source and destination are the same tracker`)
    }

    const pair = `${route.sourceTrackerId}->${route.destinationTrackerId}`
    if (pairs.has(pair)) errors.push(`duplicate source/destination pair: ${pair}`)
    pairs.add(pair)

    if (route.sourceUpdatedAt && !parseMonthStart(route.sourceUpdatedAt)) {
      errors.push(`${route.id}: sourceUpdatedAt must be YYYY-MM`)
    }
    if (!route.requirements && route.requirementNotes.length === 0) {
      warnings.push(`${route.id}: no structured requirements and no readable notes`)
    }
  }

  for (const override of catalog.overrides) {
    if (overrideIds.has(override.routeId)) {
      errors.push(`duplicate override for route: ${override.routeId}`)
    }
    overrideIds.add(override.routeId)
    if (!routeIds.has(override.routeId)) {
      errors.push(`override references unknown route: ${override.routeId}`)
    }
    if (!override.author.trim()) errors.push(`override ${override.routeId}: missing author`)
    if (!override.provenanceUrl.trim()) {
      errors.push(`override ${override.routeId}: missing provenance URL`)
    }
    if (!parseInstant(override.authoredAt)) {
      errors.push(`override ${override.routeId}: authoredAt is not a valid date`)
    }
    if (!parseInstant(override.verifiedAt)) {
      errors.push(`override ${override.routeId}: verifiedAt is not a valid date`)
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}
