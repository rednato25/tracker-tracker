// src/lib/prowlarr-search.ts
//
// P19 read-only Prowlarr search. Only identified, non-secret fields cross the
// boundary. Prowlarr's download/magnet/info URLs and guids are deliberately not
// returned because they can carry credentials or proxy access material.

import { isUnsafeNetworkHost } from "@/lib/network"
import {
  matchProwlarrIndexer,
  normalizeProwlarrUrl,
  type ProwlarrIndexer,
  type ProwlarrIndexerMatch,
} from "@/lib/prowlarr"

export const PROWLARR_SEARCH_TIMEOUT_MS = 10_000
export const PROWLARR_SEARCH_MAX_RESPONSE_BYTES = 1024 * 1024
export const PROWLARR_SEARCH_MAX_INDEXERS = 10
export const PROWLARR_SEARCH_MAX_LIMIT = 20
export const PROWLARR_SEARCH_MAX_OFFSET = 500
export const PROWLARR_SEARCH_CONCURRENCY = 3
export const PROWLARR_SEARCH_MAX_TOTAL_RESULTS = 200

export type ProwlarrOwnership =
  | "owned"
  | "placeholder"
  | "no-account"
  | "ambiguous"
  | "unsupported"

export interface ProwlarrAccountSnapshot {
  trackerId: number
  name: string
  uploadedBytes: string | null
  downloadedBytes: string | null
  requiredRatio: number | null
  lastPolledAt: string | null
}

export interface ProwlarrOwnedTracker {
  id: number
  name: string
  registrySlug: string | null
  userPausedAt: string | null
  hasStats: boolean
  uploadedBytes?: string | null
  downloadedBytes?: string | null
  requiredRatio?: number | null
  lastPolledAt?: string | null
}

export interface ProwlarrSearchIndexer {
  indexerId: number
  indexerName: string
  implementation: string
  trackerSlug: string | null
  trackerName: string | null
  ownership: ProwlarrOwnership
  accountName: string | null
  account?: ProwlarrAccountSnapshot | null
  reason: string
}

export interface ProwlarrSearchRelease {
  indexerId: number
  indexerName: string
  title: string
  sizeBytes: number | null
  seeders: number | null
  leechers: number | null
  publishDate: string | null
  protocol: string | null
  downloadFactor: number | null
  downloadFactorLabel: string | null
}

export interface ProwlarrSearchFailure {
  indexerId: number
  indexerName: string
  error: string
}

export interface ProwlarrSearchBatch {
  releases: ProwlarrSearchRelease[]
  failures: ProwlarrSearchFailure[]
  selected: number
  responded: number
  hasMore: boolean
}

export function buildProwlarrSearchIndexers(
  indexers: ProwlarrIndexer[],
  owned: ProwlarrOwnedTracker[],
  matcher: (indexer: ProwlarrIndexer) => ProwlarrIndexerMatch = matchProwlarrIndexer
): ProwlarrSearchIndexer[] {
  const bySlug = new Map<string, ProwlarrOwnedTracker[]>()
  for (const tracker of owned) {
    if (!tracker.registrySlug) continue
    const rows = bySlug.get(tracker.registrySlug) ?? []
    rows.push(tracker)
    bySlug.set(tracker.registrySlug, rows)
  }

  return indexers.map((indexer) => {
    const match = matcher(indexer)
    if (match.ambiguous) {
      return {
        indexerId: indexer.id,
        indexerName: indexer.name,
        implementation: indexer.implementation,
        trackerSlug: null,
        trackerName: null,
        ownership: "ambiguous",
        accountName: null,
        reason: "Multiple registry entries match this indexer; it is not mapped automatically.",
      }
    }
    if (!match.matched) {
      return {
        indexerId: indexer.id,
        indexerName: indexer.name,
        implementation: indexer.implementation,
        trackerSlug: null,
        trackerName: null,
        ownership: "unsupported",
        accountName: null,
        reason: "No supported tracker registry entry matches this indexer.",
      }
    }

    const accounts = bySlug.get(match.matched.slug) ?? []
    if (accounts.length === 0) {
      return {
        indexerId: indexer.id,
        indexerName: indexer.name,
        implementation: indexer.implementation,
        trackerSlug: match.matched.slug,
        trackerName: match.matched.name,
        ownership: "no-account",
        accountName: null,
        reason: "Matched registry tracker, but you have no account row for it.",
      }
    }

    const healthy = accounts.find((account) => !(account.userPausedAt && !account.hasStats))
    const account = healthy ?? accounts[0]
    const placeholder = Boolean(account.userPausedAt && !account.hasStats)
    return {
      indexerId: indexer.id,
      indexerName: indexer.name,
      implementation: indexer.implementation,
      trackerSlug: match.matched.slug,
      trackerName: match.matched.name,
      ownership: placeholder ? "placeholder" : "owned",
      accountName: account.name,
      account: placeholder
        ? null
        : {
            trackerId: account.id,
            name: account.name,
            uploadedBytes: account.uploadedBytes ?? null,
            downloadedBytes: account.downloadedBytes ?? null,
            requiredRatio: account.requiredRatio ?? null,
            lastPolledAt: account.lastPolledAt ?? null,
          },
      reason: placeholder
        ? "This is an imported PAUSED placeholder with no stats; it is not a configured or healthy account."
        : "Matched owned tracker account.",
    }
  })
}

function downloadFactor(flags: unknown): {
  value: number | null
  label: string | null
} {
  if (!Array.isArray(flags)) return { value: null, label: null }
  const names = flags
    .filter((flag): flag is string => typeof flag === "string")
    .map((flag) => flag.toLowerCase())
  const matches = names.filter((name) =>
    ["freeleech", "neutralleech", "halfleech"].includes(name)
  )
  if (matches.length !== 1) return { value: null, label: null }
  if (matches[0] === "freeleech") {
    return { value: 0, label: "Freeleech (0% download)" }
  }
  if (matches[0] === "neutralleech") {
    return { value: 0, label: "Neutral leech (no download/upload count)" }
  }
  return { value: 0.5, label: "Half leech (50% download)" }
}

function nullableInteger(value: unknown, min: number): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) return null
  return value
}

function positiveSize(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) return null
  return value
}

function publishDate(value: unknown): string | null {
  if (typeof value !== "string") return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 1970) return null
  return date.toISOString()
}

export function mapProwlarrSearchRelease(
  raw: unknown,
  expected: { indexerId: number; indexerName: string }
): ProwlarrSearchRelease | null {
  if (typeof raw !== "object" || raw === null) return null
  const row = raw as Record<string, unknown>
  const title = typeof row.title === "string" ? row.title.trim() : ""
  if (!title) return null
  const factor = downloadFactor(row.indexerFlags)
  return {
    indexerId: expected.indexerId,
    indexerName:
      typeof row.indexer === "string" && row.indexer.trim()
        ? row.indexer.trim()
        : expected.indexerName,
    title,
    sizeBytes: positiveSize(row.size),
    seeders: nullableInteger(row.seeders, 0),
    leechers: nullableInteger(row.leechers, 0),
    publishDate: publishDate(row.publishDate),
    protocol: typeof row.protocol === "string" ? row.protocol : null,
    downloadFactor: factor.value,
    downloadFactorLabel: factor.label,
  }
}

function safeSearchError(err: unknown, status?: number): string {
  if (err instanceof Error && err.name === "TimeoutError") return "Prowlarr search timed out"
  if (status === 401 || status === 403) return "Prowlarr rejected the API key"
  if (status !== undefined) return `Prowlarr search failed (HTTP ${status})`
  return "Prowlarr request failed"
}

async function searchOneIndexer(input: {
  url: string
  apiKey: string
  indexer: ProwlarrSearchIndexer
  query: string
  limit: number
  offset: number
}): Promise<{ releases: ProwlarrSearchRelease[]; failure: ProwlarrSearchFailure | null; full: boolean }> {
  const params = new URLSearchParams({
    query: input.query,
    indexerIds: String(input.indexer.indexerId),
    type: "search",
    limit: String(input.limit),
    offset: String(input.offset),
  })
  let response: Response
  try {
    response = await fetch(`${input.url}/api/v1/search?${params.toString()}`, {
      method: "GET",
      redirect: "error",
      headers: { "X-Api-Key": input.apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(PROWLARR_SEARCH_TIMEOUT_MS),
    })
  } catch (err) {
    return {
      releases: [],
      failure: {
        indexerId: input.indexer.indexerId,
        indexerName: input.indexer.indexerName,
        error: safeSearchError(err),
      },
      full: false,
    }
  }

  let text: string
  try {
    text = await response.text()
  } catch (err) {
    return {
      releases: [],
      failure: {
        indexerId: input.indexer.indexerId,
        indexerName: input.indexer.indexerName,
        error: safeSearchError(err, response.status),
      },
      full: false,
    }
  }
  if (text.length > PROWLARR_SEARCH_MAX_RESPONSE_BYTES) {
    return {
      releases: [],
      failure: {
        indexerId: input.indexer.indexerId,
        indexerName: input.indexer.indexerName,
        error: "Prowlarr response was too large",
      },
      full: false,
    }
  }
  if (!response.ok) {
    return {
      releases: [],
      failure: {
        indexerId: input.indexer.indexerId,
        indexerName: input.indexer.indexerName,
        error: safeSearchError(null, response.status),
      },
      full: false,
    }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {
      releases: [],
      failure: {
        indexerId: input.indexer.indexerId,
        indexerName: input.indexer.indexerName,
        error: "Prowlarr returned invalid JSON",
      },
      full: false,
    }
  }
  if (!Array.isArray(parsed)) {
    return {
      releases: [],
      failure: {
        indexerId: input.indexer.indexerId,
        indexerName: input.indexer.indexerName,
        error: "Prowlarr returned an invalid search response",
      },
      full: false,
    }
  }
  const releases = parsed
    .map((row) =>
      mapProwlarrSearchRelease(row, {
        indexerId: input.indexer.indexerId,
        indexerName: input.indexer.indexerName,
      })
    )
    .filter((row): row is ProwlarrSearchRelease => row !== null)
  return { releases, failure: null, full: parsed.length >= input.limit }
}

export async function searchProwlarrIndexers(input: {
  baseUrl: string
  apiKey: string
  allowPrivate: boolean
  indexers: ProwlarrSearchIndexer[]
  query: string
  limit: number
  offset: number
}): Promise<ProwlarrSearchBatch> {
  const url = normalizeProwlarrUrl(input.baseUrl)
  if (!input.allowPrivate && isUnsafeNetworkHost(new URL(url).hostname)) {
    throw new Error("Prowlarr URL points to a private network; enable private access explicitly")
  }

  const queue = [...input.indexers]
  const releases: ProwlarrSearchRelease[] = []
  const failures: ProwlarrSearchFailure[] = []
  let responded = 0
  let hasMore = false

  const worker = async () => {
    for (;;) {
      const indexer = queue.shift()
      if (!indexer) return
      const result = await searchOneIndexer({
        url,
        apiKey: input.apiKey,
        indexer,
        query: input.query,
        limit: input.limit,
        offset: input.offset,
      })
      if (result.failure) failures.push(result.failure)
      else responded++
      if (result.full) hasMore = true
      releases.push(...result.releases)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(PROWLARR_SEARCH_CONCURRENCY, input.indexers.length) }, worker)
  )

  releases.sort((a, b) => {
    const aTime = a.publishDate ? Date.parse(a.publishDate) : Number.NEGATIVE_INFINITY
    const bTime = b.publishDate ? Date.parse(b.publishDate) : Number.NEGATIVE_INFINITY
    return bTime - aTime || a.indexerName.localeCompare(b.indexerName)
  })

  return {
    releases: releases.slice(0, PROWLARR_SEARCH_MAX_TOTAL_RESULTS),
    failures: failures.sort((a, b) => a.indexerName.localeCompare(b.indexerName)),
    selected: input.indexers.length,
    responded,
    hasMore,
  }
}
