//
// P38 view models for the pathways page. The catalog is the only source of
// truth; these helpers group routes by owned tracker and build the target
// profile. They do not change data, invent thresholds, or touch the database.

import { pathwaysTrackerIdForRegistrySlug, pathwaysTrackerName } from "@/data/pathways/catalog"
import { getTrackerBySlug } from "@/data/tracker-registry"
import { type ClassGateComparison, compareClassGate } from "@/lib/rank-class-gate"
import type {
  RecruitmentCatalog,
  RecruitmentRouteRecord,
  RecruitmentSourceGate,
} from "@/lib/recruitment-routes"
import type { RecruitmentState } from "@/lib/recruitment-state"
import {
  buildWishlistPaths,
  pathHasUncheckedRequirements,
  pathWaitLabel,
  pathWaitValue,
  type WishlistPathView,
} from "@/lib/recruitment-wishlist"
import type { TrackerSummary } from "@/types/api"

const DAY_MS = 24 * 60 * 60 * 1000
const NO_REQUIREMENT = /^(none|no requirements?|removed)$/i

export type InviteTiming = {
  open: boolean
  daysRemaining: number | null
  label: string
}

export interface OwnedTrackerDestinationView {
  routeId: string
  destinationTrackerId: string
  destinationName: string
  requirementText: string | null
  days: number | null
  closed: boolean
  /** Null unless the source tracker's registry ladder names a required class. */
  classGate: ClassGateComparison | null
}

export interface OwnedTrackerCardView {
  sourceTrackerId: string
  sourceName: string
  sourceTracker: TrackerSummary
  gate: RecruitmentSourceGate | null
  invitesOpen: boolean
  inviteDaysRemaining: number | null
  invitesLabel: string
  destinations: OwnedTrackerDestinationView[]
  closedDestinationCount: number
}

export interface OwnedTrackerCardsResult {
  cards: OwnedTrackerCardView[]
  unsupportedOwnedTrackers: TrackerSummary[]
  /** Owned accounts whose join date is missing, so the first-hop wait is unknown. */
  missingAccountAgeTrackers: TrackerSummary[]
}

export interface ProfileRouteView {
  routeId: string
  trackerId: string
  trackerName: string
  requirementText: string | null
  days: number | null
  closed: boolean
  checkedAt: string | null
  checkedRaw: string | null
}

export interface ReachableSourceView {
  sourceTrackerId: string
  sourceName: string
  requirementText: string | null
  closed: boolean
  owned: boolean
  reachable: boolean
  path: WishlistPathView | null
}

export type NoRouteView =
  | { kind: "nobody"; message: string; sources: [] }
  | { kind: "unreachable"; message: string; sources: ReachableSourceView[] }

export interface TrackerProfileView {
  targetTrackerId: string
  targetName: string
  gate: RecruitmentSourceGate | null
  gateText: string | null
  gateDays: number | null
  invitedFrom: ProfileRouteView[]
  canInviteTo: ProfileRouteView[]
  invitedOpenCount: number
  invitedClosedCount: number
  recruitingStatus: "open" | "closed" | "none" | "unknown"
  recruitingLabel: string
  checkedRaw: string | null
  paths: WishlistPathView[]
  fastest: WishlistPathView | null
  otherPaths: WishlistPathView[]
  noRoute: NoRouteView | null
}

function accountAgeDays(joinedAt: string | null, now: Date): number | null {
  if (!joinedAt) return null
  const joined = Date.parse(joinedAt)
  if (Number.isNaN(joined)) return null
  return Math.max(0, Math.floor((now.getTime() - joined) / DAY_MS))
}

export function routeRequirementText(route: RecruitmentRouteRecord): string | null {
  const notes = route.requirementNotes
    .map((note) => note.trim())
    .filter((note) => note && !NO_REQUIREMENT.test(note))
  return notes.length > 0 ? notes.join(" · ") : null
}

export function inviteTiming(
  gate: RecruitmentSourceGate | null,
  tracker: TrackerSummary,
  now: Date
): InviteTiming {
  if (!gate) {
    return { open: true, daysRemaining: 0, label: "Invites open now" }
  }
  if (gate.days === null) {
    return { open: false, daysRemaining: null, label: "Invite timing unknown" }
  }
  if (gate.days === 0) {
    return { open: true, daysRemaining: 0, label: "Invites open now" }
  }
  const age = accountAgeDays(tracker.joinedAt, now)
  if (age === null) {
    return { open: false, daysRemaining: null, label: "Invite timing unknown" }
  }
  const daysRemaining = Math.max(0, gate.days - age)
  if (daysRemaining === 0) {
    return { open: true, daysRemaining: 0, label: "Invites open now" }
  }
  return {
    open: false,
    daysRemaining,
    label: `Invites open in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
  }
}

function compareOpenThenName(
  a: { closed: boolean; name: string },
  b: { closed: boolean; name: string }
): number {
  if (a.closed !== b.closed) return a.closed ? 1 : -1
  return a.name.localeCompare(b.name)
}

function groupOwnedTrackers(trackers: TrackerSummary[]): {
  ownedBySlug: Map<string, TrackerSummary>
  unsupportedOwnedTrackers: TrackerSummary[]
} {
  const ownedBySlug = new Map<string, TrackerSummary>()
  const unsupportedOwnedTrackers: TrackerSummary[] = []
  for (const tracker of trackers) {
    const trackerId = pathwaysTrackerIdForRegistrySlug(tracker.registrySlug)
    if (!trackerId) {
      unsupportedOwnedTrackers.push(tracker)
      continue
    }
    if (!ownedBySlug.has(trackerId)) ownedBySlug.set(trackerId, tracker)
  }
  return { ownedBySlug, unsupportedOwnedTrackers }
}

export function buildOwnedTrackerCards(input: {
  catalog: RecruitmentCatalog
  trackers: TrackerSummary[]
  now: Date
}): OwnedTrackerCardsResult {
  const { ownedBySlug, unsupportedOwnedTrackers } = groupOwnedTrackers(input.trackers)
  const cards: OwnedTrackerCardView[] = []

  for (const [sourceTrackerId, sourceTracker] of ownedBySlug) {
    const gate =
      input.catalog.sourceGates.find((candidate) => candidate.trackerId === sourceTrackerId) ?? null
    const registryEntry = sourceTracker.registrySlug
      ? getTrackerBySlug(sourceTracker.registrySlug)
      : undefined
    const destinations = input.catalog.routes
      .filter((route) => route.sourceTrackerId === sourceTrackerId)
      .map<OwnedTrackerDestinationView>((route) => {
        const requirementText = routeRequirementText(route)
        return {
          routeId: route.id,
          destinationTrackerId: route.destinationTrackerId,
          destinationName: pathwaysTrackerName(route.destinationTrackerId),
          requirementText,
          days: route.minimumDays,
          closed: route.availability === "closed",
          classGate: registryEntry
            ? compareClassGate({
                texts: [requirementText, gate?.text],
                classes: registryEntry.userClasses,
                currentClass: sourceTracker.latestStats?.group ?? null,
              })
            : null,
        }
      })
      .sort((a, b) =>
        compareOpenThenName(
          { closed: a.closed, name: a.destinationName },
          { closed: b.closed, name: b.destinationName }
        )
      )

    if (destinations.length === 0 && gate === null) continue

    const timing = inviteTiming(gate, sourceTracker, input.now)
    cards.push({
      sourceTrackerId,
      sourceName: pathwaysTrackerName(sourceTrackerId),
      sourceTracker,
      gate,
      invitesOpen: timing.open,
      inviteDaysRemaining: timing.daysRemaining,
      invitesLabel: timing.label,
      destinations,
      closedDestinationCount: destinations.filter((destination) => destination.closed).length,
    })
  }

  cards.sort((a, b) => {
    const aDays = a.inviteDaysRemaining ?? Number.POSITIVE_INFINITY
    const bDays = b.inviteDaysRemaining ?? Number.POSITIVE_INFINITY
    if (aDays !== bDays) return aDays - bDays
    return a.sourceName.localeCompare(b.sourceName)
  })

  const missingAccountAgeTrackers = input.trackers
    .filter((tracker) => !tracker.joinedAt)
    .sort((a, b) => a.name.localeCompare(b.name))

  return { cards, unsupportedOwnedTrackers, missingAccountAgeTrackers }
}

function profileRoute(
  route: RecruitmentRouteRecord,
  direction: "incoming" | "outgoing"
): ProfileRouteView {
  const trackerId =
    direction === "incoming" ? route.sourceTrackerId : route.destinationTrackerId
  return {
    routeId: route.id,
    trackerId,
    trackerName: pathwaysTrackerName(trackerId),
    requirementText: routeRequirementText(route),
    days: route.minimumDays,
    closed: route.availability === "closed",
    checkedAt: route.sourceUpdatedAt,
    checkedRaw: route.sourceUpdatedRaw,
  }
}

function comparedProfileRoutes(routes: ProfileRouteView[]): ProfileRouteView[] {
  return [...routes].sort((a, b) =>
    compareOpenThenName(
      { closed: a.closed, name: a.trackerName },
      { closed: b.closed, name: b.trackerName }
    )
  )
}

function pathForSource(input: {
  catalog: RecruitmentCatalog
  sourceTrackerId: string
  trackers: TrackerSummary[]
  savedRankGoals: Record<string, { targetRank: string }>
  state: RecruitmentState
  now: Date
}): WishlistPathView | null {
  const owned = new Set(
    input.trackers
      .map((tracker) => pathwaysTrackerIdForRegistrySlug(tracker.registrySlug))
      .filter((id): id is string => id !== null)
  )
  if (owned.has(input.sourceTrackerId)) return null

  const result = buildWishlistPaths({
    catalog: input.catalog,
    desiredTrackerSlug: input.sourceTrackerId,
    trackers: input.trackers,
    savedRankGoals: input.savedRankGoals,
    // A hidden path is still a real path; hiding only affects the main list.
    state: { ...input.state, hiddenPathKeys: [] },
    now: input.now,
  })
  return result.paths[0] ?? null
}

function buildNoRoute(input: {
  catalog: RecruitmentCatalog
  targetName: string
  invitedFrom: ProfileRouteView[]
  trackers: TrackerSummary[]
  savedRankGoals: Record<string, { targetRank: string }>
  state: RecruitmentState
  now: Date
}): NoRouteView | null {
  const openInvites = input.invitedFrom.filter((route) => !route.closed)
  if (openInvites.length === 0) {
    return input.invitedFrom.length === 0
      ? {
          kind: "nobody",
          message: `Nobody in the data invites to ${input.targetName}. It may recruit through open signups or interviews.`,
          sources: [],
        }
      : {
          kind: "nobody",
          message: `Every invite route to ${input.targetName} in the data is closed. It may recruit through open signups or interviews.`,
          sources: [],
        }
  }

  const owned = new Map<string, TrackerSummary>()
  for (const tracker of input.trackers) {
    const id = pathwaysTrackerIdForRegistrySlug(tracker.registrySlug)
    if (id && !owned.has(id)) owned.set(id, tracker)
  }

  const sources = openInvites.map<ReachableSourceView>((route) => {
    if (owned.has(route.trackerId)) {
      return {
        sourceTrackerId: route.trackerId,
        sourceName: route.trackerName,
        requirementText: route.requirementText,
        closed: false,
        owned: true,
        reachable: true,
        path: null,
      }
    }
    const path = pathForSource({
      catalog: input.catalog,
      sourceTrackerId: route.trackerId,
      trackers: input.trackers,
      savedRankGoals: input.savedRankGoals,
      state: input.state,
      now: input.now,
    })
    return {
      sourceTrackerId: route.trackerId,
      sourceName: route.trackerName,
      requirementText: route.requirementText,
      closed: false,
      owned: false,
      reachable: path !== null,
      path,
    }
  })

  return {
    kind: "unreachable",
    message: `These trackers invite to ${input.targetName}. Check whether you can reach one of them.`,
    sources,
  }
}

export function buildTrackerProfile(input: {
  catalog: RecruitmentCatalog
  targetTrackerId: string
  trackers: TrackerSummary[]
  savedRankGoals: Record<string, { targetRank: string }>
  state: RecruitmentState
  now: Date
  maxHops?: number
}): TrackerProfileView {
  const targetName = pathwaysTrackerName(input.targetTrackerId)
  const gate =
    input.catalog.sourceGates.find(
      (candidate) => candidate.trackerId === input.targetTrackerId
    ) ?? null

  const invitedFrom = comparedProfileRoutes(
    input.catalog.routes
      .filter((route) => route.destinationTrackerId === input.targetTrackerId)
      .map((route) => profileRoute(route, "incoming"))
  )
  const canInviteTo = comparedProfileRoutes(
    input.catalog.routes
      .filter((route) => route.sourceTrackerId === input.targetTrackerId)
      .map((route) => profileRoute(route, "outgoing"))
  )

  const invitedOpenCount = invitedFrom.filter((route) => !route.closed).length
  const invitedClosedCount = invitedFrom.length - invitedOpenCount
  const recruitingStatus: TrackerProfileView["recruitingStatus"] =
    invitedFrom.length === 0
      ? "none"
      : invitedOpenCount > 0
        ? "open"
        : invitedClosedCount === invitedFrom.length
          ? "closed"
          : "unknown"
  const recruitingLabel =
    recruitingStatus === "none"
      ? "No invite data"
      : recruitingStatus === "open"
        ? "Open"
        : recruitingStatus === "closed"
          ? "Closed"
          : "Needs checking"

  const newestRoute = invitedFrom
    .filter((route) => route.checkedAt !== null)
    .sort((a, b) => (b.checkedAt ?? "").localeCompare(a.checkedAt ?? ""))[0]

  const result = buildWishlistPaths({
    catalog: input.catalog,
    desiredTrackerSlug: input.targetTrackerId,
    trackers: input.trackers,
    savedRankGoals: input.savedRankGoals,
    state: input.state,
    now: input.now,
    maxHops: input.maxHops ?? 3,
    // The profile has its own pagination (10, then Show all), so keep the full
    // candidate set instead of the old five-per-source cap.
    maxPathsPerSource: 200,
    maxTotal: 500,
  })
  const fastest = result.paths[0] ?? null
  const noRoute =
    result.paths.length === 0
      ? buildNoRoute({
          catalog: input.catalog,
          targetName,
          invitedFrom,
          trackers: input.trackers,
          savedRankGoals: input.savedRankGoals,
          state: input.state,
          now: input.now,
        })
      : null

  return {
    targetTrackerId: input.targetTrackerId,
    targetName,
    gate,
    gateText: gate?.text ?? null,
    gateDays: gate?.days ?? null,
    invitedFrom,
    canInviteTo,
    invitedOpenCount,
    invitedClosedCount,
    recruitingStatus,
    recruitingLabel,
    checkedRaw: newestRoute?.checkedRaw ?? null,
    paths: result.paths,
    fastest,
    otherPaths: result.paths.slice(1),
    noRoute,
  }
}

export function reachableSourceLabel(source: ReachableSourceView): string {
  if (source.owned) return "You are on this tracker."
  if (source.path) return pathWaitLabel(source.path)
  return "Not reachable from your trackers."
}

export type PathwayRouteSort = "fastest" | "fewest-hops"

export interface PathwayRouteChoiceView {
  path: WishlistPathView
  pinned: boolean
  fastest: boolean
  hops: number
  waitLabel: string
  needsChecking: boolean
  /** Class gate on the owned first hop, if the source ladder has one. */
  classGate: ClassGateComparison | null
}

export interface PathwayRouteChoicesResult {
  choices: PathwayRouteChoiceView[]
  total: number
  fastestKey: string | null
  pinnedKey: string | null
  pinnedFilteredOut: boolean
}

function compareKnownWait(a: WishlistPathView, b: WishlistPathView): number {
  const aDays = a.totalDaysRemaining
  const bDays = b.totalDaysRemaining
  if (aDays === null && bDays === null) return 0
  if (aDays === null) return 1
  if (bDays === null) return -1
  return aDays - bDays
}

function compareFastest(a: WishlistPathView, b: WishlistPathView): number {
  return (
    compareKnownWait(a, b) ||
    a.routeIds.length - b.routeIds.length ||
    a.key.localeCompare(b.key)
  )
}

function compareRouteChoices(
  a: WishlistPathView,
  b: WishlistPathView,
  sort: PathwayRouteSort
): number {
  // Requirement 5 is absolute: unknown waits fall below every known wait,
  // before the selected sort is applied inside each group.
  const aKnown = a.totalDaysRemaining !== null
  const bKnown = b.totalDaysRemaining !== null
  if (aKnown !== bKnown) return aKnown ? -1 : 1
  if (sort === "fewest-hops") {
    return (
      a.routeIds.length - b.routeIds.length ||
      compareKnownWait(a, b) ||
      a.key.localeCompare(b.key)
    )
  }
  return (
    compareKnownWait(a, b) ||
    a.routeIds.length - b.routeIds.length ||
    a.key.localeCompare(b.key)
  )
}

function routeChoice(path: WishlistPathView, fastestKey: string | null, pinnedKey: string | null) {
  return {
    path,
    pinned: path.key === pinnedKey,
    fastest: path.key === fastestKey,
    hops: path.routeIds.length,
    waitLabel: pathWaitValue(path),
    needsChecking: pathHasUncheckedRequirements(path),
    classGate: path.steps[0]?.classGate ?? null,
  } satisfies PathwayRouteChoiceView
}

/**
 * Applies the target-profile controls after the catalog search:
 * max hops, start-from, sort, pinned route first, and the fastest route right
 * below a different pinned route. Unknown waits always trail known waits.
 */
export function buildRouteChoices(input: {
  paths: WishlistPathView[]
  sort: PathwayRouteSort
  maxHops: number
  startFrom: string | null
  pinnedKey: string | null
}): PathwayRouteChoicesResult {
  const filtered = input.paths.filter(
    (path) =>
      path.routeIds.length <= input.maxHops &&
      (input.startFrom === null || path.steps[0]?.sourceTrackerId === input.startFrom)
  )
  const pinnedPath = input.pinnedKey
    ? (filtered.find((path) => path.key === input.pinnedKey) ?? null)
    : null
  const pinnedFilteredOut = Boolean(
    input.pinnedKey && !filtered.some((path) => path.key === input.pinnedKey)
  )
  const fastest = [...filtered].sort(compareFastest)[0] ?? null
  const sorted = [...filtered].sort((a, b) => compareRouteChoices(a, b, input.sort))

  const ordered: WishlistPathView[] = []
  if (pinnedPath) ordered.push(pinnedPath)
  if (fastest && fastest.key !== pinnedPath?.key) ordered.push(fastest)
  for (const path of sorted) {
    if (path.key === pinnedPath?.key || path.key === fastest?.key) continue
    ordered.push(path)
  }

  return {
    choices: ordered.map((path) => routeChoice(path, fastest?.key ?? null, pinnedPath?.key ?? null)),
    total: ordered.length,
    fastestKey: fastest?.key ?? null,
    pinnedKey: pinnedPath?.key ?? null,
    pinnedFilteredOut,
  }
}
