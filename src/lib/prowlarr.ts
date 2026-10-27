// src/lib/prowlarr.ts
//
// P14 read-only Prowlarr import helpers. The Prowlarr API key authenticates
// Prowlarr only; tracker credentials are never copied from indexer fields.

import { TRACKER_REGISTRY, type TrackerRegistryEntry } from "@/data/tracker-registry"
import { isUnsafeNetworkHost } from "@/lib/network"

const PROWLARR_TIMEOUT_MS = 8_000
const PROWLARR_MAX_RESPONSE_BYTES = 512 * 1024

export interface ProwlarrIndexer {
  id: number
  name: string
  implementation: string
  fields: { name: string; value: unknown }[]
}

export type ProwlarrPreviewStatus =
  | "ready"
  | "already-added"
  | "ambiguous"
  | "unsupported"

export interface ProwlarrPreviewItem {
  indexerId: number
  name: string
  implementation: string
  baseUrl: string | null
  status: ProwlarrPreviewStatus
  matchedSlug: string | null
  matchedName: string | null
  reason: string
  credentialNote: string | null
}

export function normalizeProwlarrUrl(raw: string): string {
  const url = new URL(raw.trim())
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Prowlarr URL must use http or https")
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Prowlarr URL must not contain credentials, query or fragment")
  }
  return url.toString().replace(/\/$/, "")
}

export function prowlarrHostname(raw: string): string | null {
  try {
    return new URL(raw.trim().toLowerCase()).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

export async function fetchProwlarrIndexers(
  baseUrl: string,
  apiKey: string,
  options: { allowPrivate?: boolean } = {}
): Promise<ProwlarrIndexer[]> {
  const url = normalizeProwlarrUrl(baseUrl)
  if (!options.allowPrivate && isUnsafeNetworkHost(new URL(url).hostname)) {
    throw new Error("Prowlarr URL points to a private network; enable private access explicitly")
  }
  const response = await fetch(`${url}/api/v1/indexer`, {
    method: "GET",
    redirect: "error",
    headers: { "X-Api-Key": apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(PROWLARR_TIMEOUT_MS),
  })
  const text = await response.text()
  if (text.length > PROWLARR_MAX_RESPONSE_BYTES) {
    throw new Error("Prowlarr response is too large")
  }
  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? "Prowlarr rejected the API key"
        : "Prowlarr request failed"
    )
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("Prowlarr returned invalid JSON")
  }
  if (!Array.isArray(parsed)) throw new Error("Prowlarr returned an invalid indexer list")
  return parsed
    .map((item) => {
      const row = item as Record<string, unknown>
      if (typeof row.id !== "number" || typeof row.name !== "string") return null
      return {
        id: row.id,
        name: row.name,
        implementation: typeof row.implementation === "string" ? row.implementation : "unknown",
        fields: Array.isArray(row.fields)
          ? (row.fields as Record<string, unknown>[]).filter(
              (field) => typeof field.name === "string"
            ).map((field) => ({ name: field.name as string, value: field.value }))
          : [],
      } satisfies ProwlarrIndexer
    })
    .filter((item): item is ProwlarrIndexer => item !== null)
}

function indexerBaseUrl(indexer: ProwlarrIndexer): string | null {
  for (const field of indexer.fields) {
    if (/^(baseurl|base_url|url)$/i.test(field.name) && typeof field.value === "string") {
      return field.value
    }
  }
  return null
}

export interface ProwlarrIndexerMatch {
  candidates: TrackerRegistryEntry[]
  matched: TrackerRegistryEntry | null
  ambiguous: boolean
}

export function matchProwlarrIndexer(indexer: ProwlarrIndexer): ProwlarrIndexerMatch {
  const candidates = TRACKER_REGISTRY.filter((entry) => matches(indexer, entry))
  return {
    candidates,
    matched: candidates.length === 1 ? candidates[0] : null,
    ambiguous: candidates.length > 1,
  }
}

function matches(indexer: ProwlarrIndexer, entry: TrackerRegistryEntry): boolean {
  const name = indexer.name.trim().toLowerCase()
  if (name === entry.name.toLowerCase() || name === entry.slug.toLowerCase()) return true
  if (entry.abbreviation && name === entry.abbreviation.toLowerCase()) return true
  const indexerHost = indexerBaseUrl(indexer) ? prowlarrHostname(indexerBaseUrl(indexer) as string) : null
  const entryHost = prowlarrHostname(entry.url)
  return Boolean(indexerHost && entryHost && indexerHost === entryHost)
}

export function buildProwlarrPreview(
  indexers: ProwlarrIndexer[],
  existing: { registrySlug: string | null; baseUrl: string }[]
): ProwlarrPreviewItem[] {
  const existingSlugs = new Set(existing.map((row) => row.registrySlug).filter(Boolean))
  const existingHosts = new Set(
    existing.map((row) => prowlarrHostname(row.baseUrl)).filter(Boolean)
  )

  return indexers.map((indexer) => {
    const baseUrl = indexerBaseUrl(indexer)
    const match = matchProwlarrIndexer(indexer)
    const candidates = match.candidates
    const matched = match.matched
    const credentialNote =
      "Prowlarr credentials are not copied. Configure the tracker API credential after import."

    if (candidates.length > 1) {
      return {
        indexerId: indexer.id,
        name: indexer.name,
        implementation: indexer.implementation,
        baseUrl,
        status: "ambiguous",
        matchedSlug: null,
        matchedName: null,
        reason: "Multiple tracker registry entries match this indexer; review manually.",
        credentialNote,
      }
    }
    if (!matched) {
      return {
        indexerId: indexer.id,
        name: indexer.name,
        implementation: indexer.implementation,
        baseUrl,
        status: "unsupported",
        matchedSlug: null,
        matchedName: null,
        reason: "No supported tracker registry entry matches this indexer.",
        credentialNote,
      }
    }
    const host = baseUrl ? prowlarrHostname(baseUrl) : null
    if (existingSlugs.has(matched.slug) || (host && existingHosts.has(host))) {
      return {
        indexerId: indexer.id,
        name: indexer.name,
        implementation: indexer.implementation,
        baseUrl,
        status: "already-added",
        matchedSlug: matched.slug,
        matchedName: matched.name,
        reason: "This tracker is already in the application; it will not be overwritten.",
        credentialNote,
      }
    }
    return {
      indexerId: indexer.id,
      name: indexer.name,
      implementation: indexer.implementation,
      baseUrl,
      status: "ready",
      matchedSlug: matched.slug,
      matchedName: matched.name,
      reason: "Supported tracker match. Credentials must be configured after import.",
      credentialNote,
    }
  })
}
