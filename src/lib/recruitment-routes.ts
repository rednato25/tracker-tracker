// src/lib/recruitment-routes.ts
//
// P17 recruitment-route format and offline evaluator.
//
// The format deliberately separates three things that are easy to confuse:
//   1. requirement eligibility (met/unmet/unknown from structured observations),
//   2. recruitment availability (open/closed/unknown from the cited source),
//   3. invitation/admission reality (always unknown; nobody can guarantee it).
//
// Free text stays readable. The community dataset's explicit `days` value is
// kept as the minimum time on the source tracker; it is never converted into a
// structured rank condition. No prose is guessed into thresholds, and nothing
// here fetches data or touches the database.

import type {
  RankGoalStatus,
  RankGroupResult,
  RankManualCondition,
  RankObservationMap,
  RankRequirementGroup,
} from "@/lib/rank-goals"
import { evaluateRequirementGroup } from "@/lib/rank-goals"

export const RECRUITMENT_ROUTE_FORMAT_VERSION = 2

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
  sourceRegistrySlug: string | null
  destinationRegistrySlug: string | null
  /**
   * Only conditions supported by an explicit, documented source field. `null`
   * means the source has no evaluable structured requirements, not that there
   * are none.
   */
  requirements: RankRequirementGroup | null
  /** Source prose kept readable because it cannot be evaluated safely. */
  requirementNotes: string[]
  /** Minimum days on the source tracker, per trackerpathways. */
  minimumDays: number | null
  availability: RecruitmentAvailability
  availabilityRaw: string
  /** `YYYY-MM` at month precision; distinct from access/verification dates. */
  sourceUpdatedAt: string | null
  sourceUpdatedRaw: string | null
}

export interface RecruitmentSourceGate {
  trackerId: string
  /** Upstream wait value; not interpreted as account age. */
  days: number | null
  /** Source invite-class/forum gate prose. Always unresolved in P17. */
  text: string
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
  sourceGates: RecruitmentSourceGate[]
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
  sourceRegistrySlug: string | null
  destinationRegistrySlug: string | null
  eligibility: {
    status: RankGoalStatus
    progress: { met: number; unmet: number; unknown: number; total: number }
    structured: RankGroupResult | null
    requirementNotes: string[]
    originalRequirementNotes: string[]
    sourceRequirements: {
      days: number | null
      daysSource: "trackerpathways"
      inviteGate: RecruitmentSourceGate | null
    }

    reason: string
  }
  timeGate: {
    minimumDays: number | null
    effectiveDays: number | null
    accountAgeDays: number | null
    daysRemaining: number | null
    status: "open" | "waiting" | "unknown"
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

const NO_REQUIREMENT_NOTES = new Set([
  "none",
  "no requirement",
  "no requirements",
  "removed",
])

function isMandatoryNote(note: string): boolean {
  return !NO_REQUIREMENT_NOTES.has(note.trim().toLowerCase())
}

/**
 * Mandatory source text and the source invite gate are unresolved
 * prerequisites. They are inserted as manual UNKNOWN leaves so ALL/ANY keeps
 * the conservative result: a known unmet condition still wins, otherwise any
 * unresolved mandatory condition prevents `met`. The `days` value is evaluated
 * separately as a time gate.
 */
function unresolvedPrerequisites(
  effectiveNotes: string[],
  sourceGate: RecruitmentSourceGate | null
): RankManualCondition[] {
  const manual: RankManualCondition[] = []
  for (const [index, note] of effectiveNotes.entries()) {
    if (!isMandatoryNote(note)) continue
    manual.push({
      kind: "manual",
      id: `source-requirement-${index}`,
      label: "Unresolved source requirement",
      description: note,
    })
  }
  if (sourceGate) {
    manual.push({
      kind: "manual",
      id: "source-invite-gate",
      label: "Source invite-class or forum gate",
      description: `${sourceGate.text}${sourceGate.days === null ? "" : ` (upstream wait: ${sourceGate.days} days; not evaluated as account age)`}`,
    })
  }
  return manual
}

function buildEffectiveRequirements(
  structured: RankRequirementGroup | null,
  unresolved: RankManualCondition[]
): RankRequirementGroup | null {
  if (unresolved.length === 0) return structured
  return {
    mode: "all",
    conditions: structured ? [structured, ...unresolved] : unresolved,
  }
}


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
        ? "At least one known mandatory requirement is unmet."
        : "A mandatory requirement is missing, stale, unresolved or unverified, so eligibility remains unknown."
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
  const sourceGate =
    catalog.sourceGates.find((candidate) => candidate.trackerId === route.sourceTrackerId) ?? null
  const unresolved = unresolvedPrerequisites(requirementNotes, sourceGate)
  const requirements = buildEffectiveRequirements(effectiveRequirements, unresolved)
  const eligibility = evaluateStructured(requirements, input)

  const sourceUpdated = parseMonthStart(route.sourceUpdatedAt)
  const verified = override ? parseInstant(override.verifiedAt) : null
  const sourceFreshness = dateFreshness(sourceUpdated, input.now)
  const evidenceFreshness = override ? dateFreshness(verified, input.now) : "unknown"

  const accountAgeDays =
    input.joinedAt && !Number.isNaN(new Date(input.joinedAt).getTime())
      ? ageDays(new Date(input.joinedAt), input.now)
      : null
  const gateDays = sourceGate?.days ?? null
  const effectiveDays =
    route.minimumDays === null && gateDays === null
      ? null
      : Math.max(route.minimumDays ?? 0, gateDays ?? 0)
  const daysRemaining =
    effectiveDays === null || accountAgeDays === null
      ? null
      : Math.max(0, effectiveDays - accountAgeDays)
  const timeGateStatus =
    effectiveDays === null
      ? "unknown"
      : effectiveDays === 0
        ? "open"
        : accountAgeDays === null
          ? "unknown"
          : daysRemaining === 0
            ? "open"
            : "waiting"
  const availability = override?.availability ?? route.availability
  const availabilityConfirmed = override?.availability !== undefined

  return {
    formatVersion: RECRUITMENT_ROUTE_FORMAT_VERSION,
    routeId: route.id,
    sourceTrackerId: route.sourceTrackerId,
    destinationTrackerId: route.destinationTrackerId,
    sourceRegistrySlug: route.sourceRegistrySlug,
    destinationRegistrySlug: route.destinationRegistrySlug,
    eligibility: {
      status: eligibility.status,
      progress: eligibility.progress,
      structured: eligibility.structured,
      requirementNotes,
      originalRequirementNotes: route.requirementNotes,
      sourceRequirements: {
        days: route.minimumDays,
        daysSource: "trackerpathways",
        inviteGate: sourceGate,
      },
      reason: eligibility.reason,
    },
    timeGate: {
      minimumDays: route.minimumDays,
      effectiveDays,
      accountAgeDays,
      daysRemaining,
      status: timeGateStatus,
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
  maxHops = 6,
  maxPaths = Number.POSITIVE_INFINITY,
  includeClosed = false
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
    if (hops >= maxHops || paths.length >= maxPaths) return
    for (const route of bySource.get(current) ?? []) {
      if (paths.length >= maxPaths) return
      if (!includeClosed && route.availability === "closed") continue
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
  const gateIds = new Set<string>()

  for (const gate of catalog.sourceGates) {
    if (gateIds.has(gate.trackerId)) {
      errors.push(`duplicate source gate: ${gate.trackerId}`)
    }
    gateIds.add(gate.trackerId)
    if (!trackerIds.has(gate.trackerId)) {
      errors.push(`source gate references unknown tracker: ${gate.trackerId}`)
    }
    if (gate.days !== null && (!Number.isSafeInteger(gate.days) || gate.days < 0)) {
      errors.push(`source gate ${gate.trackerId}: days must be a non-negative integer or null`)
    }
    if (!gate.text.trim()) errors.push(`source gate ${gate.trackerId}: missing text`)
  }

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
    if (
      route.minimumDays !== null &&
      (!Number.isSafeInteger(route.minimumDays) || route.minimumDays < 0)
    ) {
      errors.push(`${route.id}: minimumDays must be a non-negative integer or null`)
    }
    if (
      !route.requirements &&
      route.requirementNotes.length === 0 &&
      route.minimumDays === null &&
      !gateIds.has(route.sourceTrackerId)
    ) {
      warnings.push(`${route.id}: no structured requirements and no readable source prerequisites`)
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
