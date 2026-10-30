// src/data/pathways/catalog.ts
//
// Build-time view of the raw trackerpathways snapshot. The JSON below is
// vendored unchanged; this module only adapts it to the P17/P30 format.

import metadata from "@/data/pathways/metadata.json"
import raw from "@/data/pathways/trackers.json"
import { RECRUITMENT_ROUTE_OVERRIDES } from "@/data/recruitment-overrides"
import { TRACKER_REGISTRY } from "@/data/tracker-registry"
import type {
  RecruitmentCatalog,
  RecruitmentRouteRecord,
  RecruitmentSourceGate,
  RecruitmentSourceRecord,
} from "@/lib/recruitment-routes"
import { RECRUITMENT_ROUTE_FORMAT_VERSION } from "@/lib/recruitment-routes"

type PathwaysRoute = {
  days: number
  reqs: string
  active: string
  updated: string
}

type PathwaysData = {
  trackerInfo: Record<string, unknown>
  unlockInviteClass: Record<string, [number | null, string]>
  routeInfo: Record<string, Record<string, PathwaysRoute>>
}

const data = raw as unknown as PathwaysData

const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  June: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")

const registryByKey = new Map<string, Set<string>>()
for (const tracker of TRACKER_REGISTRY) {
  for (const candidate of [tracker.name, tracker.slug, tracker.abbreviation]) {
    if (!candidate) continue
    const key = normalize(candidate)
    const slugs = registryByKey.get(key) ?? new Set<string>()
    slugs.add(tracker.slug)
    registryByKey.set(key, slugs)
  }
}

function registrySlugFor(name: string): string | null {
  const slugs = registryByKey.get(normalize(name))
  return slugs?.size === 1 ? ([...slugs][0] ?? null) : null
}

// trackerpathways stores `routeInfo[source][destination]`: the outer key is the
// tracker you are on, and its reqs/days apply to that source. Upstream walks
// `routeInfo[current]` forward (src/lib/graphUtils.ts and the routes API), so
// every reader here must keep that orientation.
const allNames = new Set(Object.keys(data.trackerInfo))
for (const [source, destinations] of Object.entries(data.routeInfo)) {
  allNames.add(source)
  for (const destination of Object.keys(destinations)) allNames.add(destination)
}

export const PATHWAYS_TRACKERS = [...allNames]
  .sort((a, b) => a.localeCompare(b))
  .map((id) => ({ id, name: id, registrySlug: registrySlugFor(id) }))

// The reverse map picks one upstream name per registry slug. Names and slugs
// can collide (for example "DigitalCore" and "DigitalCore.Club"); the exact
// registry name wins, then the slug, then the abbreviation. A tie stays
// unresolved rather than guessing.
const pathwaysByRegistry = new Map<string, string | null>()
const registryCandidates = new Map<string, { id: string; score: number }[]>()
for (const name of allNames) {
  const key = normalize(name)
  for (const tracker of TRACKER_REGISTRY) {
    let score = 0
    if (normalize(tracker.name) === key) score = 3
    else if (normalize(tracker.slug) === key) score = 2
    else if (tracker.abbreviation && normalize(tracker.abbreviation) === key) score = 1
    if (score === 0) continue
    const candidates = registryCandidates.get(tracker.slug) ?? []
    candidates.push({ id: name, score })
    registryCandidates.set(tracker.slug, candidates)
  }
}
for (const [slug, candidates] of registryCandidates) {
  const best = Math.max(...candidates.map((candidate) => candidate.score))
  const winners = candidates.filter((candidate) => candidate.score === best)
  pathwaysByRegistry.set(slug, winners.length === 1 ? (winners[0]?.id ?? null) : null)
}

export function pathwaysTrackerIdForRegistrySlug(slug: string | null | undefined): string | null {
  return slug ? (pathwaysByRegistry.get(slug) ?? null) : null
}

export function registrySlugForPathwaysTracker(id: string): string | null {
  return registrySlugFor(id)
}

export function normalizePathwaysTarget(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  if (allNames.has(value)) return value
  return pathwaysByRegistry.get(value) ?? null
}

export function pathwaysTrackerName(id: string): string {
  return id
}

const source: RecruitmentSourceRecord = {
  id: metadata.source,
  name: metadata.source,
  url: metadata.repo,
  license: metadata.license,
  licenseUrl: metadata.licenseUrl,
  copyright: metadata.copyright,
  version: metadata.commit,
  snapshotUrl: `https://raw.githubusercontent.com/${metadata.repo.replace("https://github.com/", "")}/${metadata.commit}/${metadata.sourceFile}`,
  accessedAt: metadata.fetchedAt,
  attribution: metadata.attribution,
}

function month(value: string): string | null {
  const match = /^([A-Za-z]+)\s+(\d{4})$/.exec(value.trim())
  if (!match) return null
  const mm = MONTHS[match[1]]
  return mm ? `${match[2]}-${mm}` : null
}

function availability(value: string): "open" | "closed" | "unknown" {
  const normalized = value.trim().toLowerCase()
  if (normalized === "yes" || normalized === "open") return "open"
  if (normalized === "no" || normalized === "closed") return "closed"
  return "unknown"
}

function routeId(sourceName: string, destinationName: string): string {
  return `tp:${encodeURIComponent(sourceName)}:${encodeURIComponent(destinationName)}`
}

// unlockInviteClass is keyed by the tracker being left. The gate belongs to the
// route source, never the destination.
export const RECRUITMENT_SOURCE_GATES: RecruitmentSourceGate[] = Object.entries(
  data.unlockInviteClass
)
  .filter(([, gate]) => Boolean(gate?.[1]?.trim()))
  .map(([trackerId, gate]) => ({ trackerId, days: gate[0], text: gate[1].trim() }))
  .sort((a, b) => a.trackerId.localeCompare(b.trackerId))

export const RECRUITMENT_ROUTES: RecruitmentRouteRecord[] = []
for (const [sourceName, destinations] of Object.entries(data.routeInfo)) {
  for (const [destinationName, route] of Object.entries(destinations)) {
    RECRUITMENT_ROUTES.push({
      id: routeId(sourceName, destinationName),
      sourceTrackerId: sourceName,
      destinationTrackerId: destinationName,
      sourceRegistrySlug: registrySlugFor(sourceName),
      destinationRegistrySlug: registrySlugFor(destinationName),
      requirements: null,
      requirementNotes: route.reqs.trim() ? [route.reqs.trim()] : [],
      minimumDays:
        typeof route.days === "number" && Number.isFinite(route.days) ? Math.max(0, route.days) : null,
      availability: availability(route.active),
      availabilityRaw: route.active,
      sourceUpdatedAt: month(route.updated),
      sourceUpdatedRaw: route.updated,
    })
  }
}
RECRUITMENT_ROUTES.sort((a, b) => a.id.localeCompare(b.id))

export const RECRUITMENT_CATALOG: RecruitmentCatalog = {
  formatVersion: RECRUITMENT_ROUTE_FORMAT_VERSION,
  source,
  routes: RECRUITMENT_ROUTES,
  sourceGates: RECRUITMENT_SOURCE_GATES,
  overrides: RECRUITMENT_ROUTE_OVERRIDES,
}
