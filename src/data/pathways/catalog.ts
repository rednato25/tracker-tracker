// src/data/pathways/catalog.ts
//
// Build-time view of the raw trackerpathways snapshot. The JSON below is
// vendored unchanged; this module only adapts it to the P17/P30 format.

import {
  PATHWAYS_TRACKER_ALIASES,
  PATHWAYS_UNMATCHED_REGISTRY_SLUGS,
} from "@/data/pathways/aliases"
import metadata from "@/data/pathways/metadata.json"
import raw from "@/data/pathways/trackers.json"
import { RECRUITMENT_ROUTE_OVERRIDES } from "@/data/recruitment-overrides"
import { getTrackerBySlug } from "@/data/tracker-registry"
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

export function registrySlugForPathwaysTracker(name: string): string | null {
  return PATHWAYS_TRACKER_ALIASES[name] ?? null
}

export const PATHWAYS_UNSUPPORTED_REGISTRY_SLUGS: readonly string[] =
  PATHWAYS_UNMATCHED_REGISTRY_SLUGS

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
  .map((id) => ({ id, name: id, registrySlug: registrySlugForPathwaysTracker(id) }))

// One canonical trackerpathways id per registry slug. When the dataset spells
// a tracker more than once (DigitalCore and DigitalCore.Club), prefer the
// spelling that appears as a route source, since that is the one an owned card
// and its destinations are keyed by.
const aliasIdsBySlug = new Map<string, string[]>()
for (const [name, slug] of Object.entries(PATHWAYS_TRACKER_ALIASES)) {
  if (!allNames.has(name)) continue
  const ids = aliasIdsBySlug.get(slug) ?? []
  ids.push(name)
  aliasIdsBySlug.set(slug, ids)
}
const canonicalIdBySlug = new Map<string, string>()
for (const [slug, ids] of aliasIdsBySlug) {
  const sourceIds = ids.filter((id) => Object.hasOwn(data.routeInfo, id)).sort()
  canonicalIdBySlug.set(slug, sourceIds[0] ?? [...ids].sort()[0] ?? "")
}
for (const slug of PATHWAYS_UNMATCHED_REGISTRY_SLUGS) {
  canonicalIdBySlug.delete(slug)
}

export function pathwaysTrackerIdForRegistrySlug(slug: string | null | undefined): string | null {
  return slug ? (canonicalIdBySlug.get(slug) ?? null) : null
}

/** The registry display name for a matched trackerpathways id, or null. */
export function registryNameForPathwaysTracker(id: string): string | null {
  const slug = registrySlugForPathwaysTracker(id)
  return slug ? (getTrackerBySlug(slug)?.name ?? null) : null
}

export function normalizePathwaysTarget(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  if (allNames.has(value)) return value
  return pathwaysTrackerIdForRegistrySlug(value)
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
      sourceRegistrySlug: registrySlugForPathwaysTracker(sourceName),
      destinationRegistrySlug: registrySlugForPathwaysTracker(destinationName),
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
