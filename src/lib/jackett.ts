// src/lib/jackett.ts
//
// P15 read-only Jackett import helpers. Jackett's indexer DTO exposes
// site_link/name/type, not indexer secrets. The admin password is used only to
// obtain a dashboard cookie for the read-only indexer list; it is not persisted.

import { TRACKER_REGISTRY, type TrackerRegistryEntry } from "@/data/tracker-registry"
import { isUnsafeNetworkHost } from "@/lib/network"

const TIMEOUT_MS = 8_000
const MAX_BYTES = 512 * 1024

export interface JackettIndexer {
  id: string
  name: string
  type: string
  siteLink: string | null
  alternativeSiteLinks: string[]
}

export type JackettPreviewStatus = "ready" | "already-added" | "ambiguous" | "unsupported"

export interface JackettPreviewItem {
  indexerId: string
  name: string
  implementation: string
  baseUrl: string | null
  status: JackettPreviewStatus
  matchedSlug: string | null
  matchedName: string | null
  reason: string
  credentialNote: string | null
}

export function normalizeJackettUrl(raw: string): string {
  const url = new URL(raw.trim())
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Jackett URL must use http or https")
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Jackett URL must not contain credentials, query or fragment")
  }
  return url.toString().replace(/\/$/, "")
}

function hostname(raw: string | null): string | null {
  if (!raw) return null
  if (!URL.canParse(raw.trim().toLowerCase())) return null
  return new URL(raw.trim().toLowerCase()).hostname.replace(/^www\./, "")
}

export async function fetchJackettIndexers(
  baseUrl: string,
  adminPassword: string,
  options: { allowPrivate?: boolean } = {}
): Promise<JackettIndexer[]> {
  const url = normalizeJackettUrl(baseUrl)
  if (!options.allowPrivate && isUnsafeNetworkHost(new URL(url).hostname)) {
    throw new Error("Jackett URL points to a private network; enable private access explicitly")
  }
  const login = await fetch(`${url}/UI/Dashboard`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password: adminPassword }).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const setCookies = login.headers.getSetCookie?.() ?? []
  const cookie = setCookies.map((value) => value.split(";")[0]).join("; ")
  if (!cookie) throw new Error("Jackett rejected the admin password")

  const response = await fetch(`${url}/api/v2.0/indexers?configured=true`, {
    method: "GET",
    redirect: "error",
    headers: { Accept: "application/json", Cookie: cookie },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const text = await response.text()
  if (text.length > MAX_BYTES) throw new Error("Jackett response is too large")
  if (!response.ok) throw new Error("Jackett rejected the admin session")
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw new Error("Jackett returned invalid JSON") }
  if (!Array.isArray(parsed)) throw new Error("Jackett returned an invalid indexer list")
  return parsed.flatMap((item) => {
    const row = item as Record<string, unknown>
    if (typeof row.id !== "string" || typeof row.name !== "string") return []
    return [{
      id: row.id,
      name: row.name,
      type: typeof row.type === "string" ? row.type : "unknown",
      siteLink: typeof row.site_link === "string" ? row.site_link : null,
      alternativeSiteLinks: Array.isArray(row.alternativesitelinks)
        ? (row.alternativesitelinks as unknown[]).filter((v): v is string => typeof v === "string")
        : [],
    }]
  })
}

function matches(indexer: JackettIndexer, entry: TrackerRegistryEntry): boolean {
  const name = indexer.name.trim().toLowerCase()
  if (name === entry.name.toLowerCase() || name === entry.slug.toLowerCase()) return true
  if (entry.abbreviation && name === entry.abbreviation.toLowerCase()) return true
  const links = [indexer.siteLink, ...indexer.alternativeSiteLinks].map(hostname).filter(Boolean)
  const entryHost = hostname(entry.url)
  return Boolean(entryHost && links.includes(entryHost))
}

export function buildJackettPreview(
  indexers: JackettIndexer[],
  existing: { registrySlug: string | null; baseUrl: string }[]
): JackettPreviewItem[] {
  const existingSlugs = new Set(existing.map((row) => row.registrySlug).filter(Boolean))
  const existingHosts = new Set(existing.map((row) => hostname(row.baseUrl)).filter(Boolean))
  return indexers.map((indexer) => {
    const candidates = TRACKER_REGISTRY.filter((entry) => matches(indexer, entry))
    const matched = candidates.length === 1 ? candidates[0] : null
    const credentialNote = "Jackett credentials are not copied. Configure the tracker API credential after import."
    const base = { indexerId: indexer.id, name: indexer.name, implementation: indexer.type, baseUrl: indexer.siteLink, credentialNote }
    if (candidates.length > 1) return { ...base, status: "ambiguous" as const, matchedSlug: null, matchedName: null, reason: "Multiple registry entries match this indexer." }
    if (!matched) return { ...base, status: "unsupported" as const, matchedSlug: null, matchedName: null, reason: "No supported tracker registry entry matches this indexer." }
    const host = hostname(indexer.siteLink)
    if (existingSlugs.has(matched.slug) || (host && existingHosts.has(host))) {
      return { ...base, status: "already-added" as const, matchedSlug: matched.slug, matchedName: matched.name, reason: "This tracker is already present and will not be overwritten." }
    }
    return { ...base, status: "ready" as const, matchedSlug: matched.slug, matchedName: matched.name, reason: "Supported match; configure tracker credentials after import." }
  })
}
