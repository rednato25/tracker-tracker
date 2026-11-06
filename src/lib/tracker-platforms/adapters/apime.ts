// src/lib/tracker-platforms/adapters/apime.ts
//
// Functions: stringOrNull, numeric, apimeClassName, readBonus, readUserId,
//            parseApimeUser, authHeaders, ApimeAdapter
//
// RetroFlix and SpeedApp run the same Laravel API: a GET /api/me that returns
// the account, an /api/torrent search and a POST /api/upload, all behind an
// Authorization header. It is not UNIT3D (/api/user) and not TR4KER
// (X-Api-Key). The two sites differ only in their numeric class ladders and
// which key carries the bonus, so both are registry data on one adapter.

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { validateHeaderToken } from "@/lib/tracker-credentials/header-token"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "../contract"
import { adapterFetch } from "../helpers/adapter-fetch"
import { requireBytes } from "../helpers/bytes"
import { pollError } from "../helpers/poll-error"

interface ApimeUser {
  username?: string
  user_id?: number
  id?: number
  class?: string | number
  uploaded?: number
  downloaded?: number
  // RetroFlix calls it seed_bonus, SpeedApp calls it credits, and the older
  // spelling is bonus_points. All three are the same spendable figure.
  bonus_points?: number | null
  credits?: number | null
  seed_bonus?: number | null
  bonus?: number | null
  seedbonus?: number | null
  created_at?: string | null
  joined_at?: string | null
  last_seen_at?: string | null
  last_seen?: string | null
  avatar_url?: string | null
  seeding?: number | null
  seeding_count?: number | null
  leeching?: number | null
  leeching_count?: number | null
  hit_and_run_count?: number | null
  hit_and_runs?: number | null
  free_leech_tokens?: number | null
  freeleech_tokens?: number | null
}

/** A trimmed string, or null for anything else including an empty one. */
function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

/**
 * A count or a decimal the API reports as a number, or as the numeric string a
 * Laravel decimal cast produces. Anything else is unknown, never 0.
 */
function numeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/**
 * The class the API reports as an id, read through the site's own ladder. A
 * class the map does not know shows as sent rather than disappearing; a map is
 * absent for a site whose API already sends a name.
 */
function apimeClassName(
  value: string | number | undefined,
  classMap?: Record<string, string>
): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const id = String(value)
    return classMap?.[id] ?? id
  }
  const name = stringOrNull(value)
  if (name === null) return null
  return classMap?.[name] ?? name
}

function readBonus(user: ApimeUser): number | null {
  return (
    numeric(user.bonus_points) ??
    numeric(user.credits) ??
    numeric(user.seed_bonus) ??
    numeric(user.bonus) ??
    numeric(user.seedbonus)
  )
}

function readUserId(user: ApimeUser): number | undefined {
  const id = numeric(user.user_id) ?? numeric(user.id)
  return id !== null && Number.isInteger(id) ? id : undefined
}

function parseApimeUser(
  user: ApimeUser,
  hostname: string,
  classMap?: Record<string, string>
): TrackerStats {
  const uploadedBytes = requireBytes(user.uploaded, "uploaded", hostname)
  const downloadedBytes = requireBytes(user.downloaded, "downloaded", hostname)
  const lastSeenAt = stringOrNull(user.last_seen_at)
  const lastSeen = lastSeenAt ?? stringOrNull(user.last_seen)

  return {
    username: stringOrNull(user.username) ?? "",
    group: apimeClassName(user.class, classMap),
    uploadedBytes,
    downloadedBytes,
    // Derived from the byte totals. RetroFlix also sends a ratio, but "∞" for
    // a zero-download account does not survive parseFloat.
    ratio: computeRatio(uploadedBytes, downloadedBytes),
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    seedingCount: numeric(user.seeding) ?? numeric(user.seeding_count),
    leechingCount: numeric(user.leeching) ?? numeric(user.leeching_count),
    seedbonus: readBonus(user),
    hitAndRuns: numeric(user.hit_and_run_count) ?? numeric(user.hit_and_runs),
    requiredRatio: null,
    warned: null,
    freeleechTokens: numeric(user.free_leech_tokens) ?? numeric(user.freeleech_tokens),
    remoteUserId: readUserId(user),
    joinedDate: stringOrNull(user.created_at) ?? stringOrNull(user.joined_at) ?? undefined,
    lastAccessDate: lastSeen ?? undefined,
    lastAccessField: lastSeenAt ? "last_seen_at" : lastSeen ? "last_seen" : undefined,
    avatarUrl: stringOrNull(user.avatar_url) ?? undefined,
  }
}

/**
 * The sites advertise `WWW-Authenticate: Bearer`, and both registry entries
 * select that spelling. Raw stays the default because the upload tools these
 * sites document send the key bare, so a third APIME site needs no code change.
 */
function authHeaders(apiToken: string, options?: FetchOptions): Record<string, string> {
  return {
    Authorization: options?.headerAuthStyle === "bearer" ? `Bearer ${apiToken}` : apiToken,
  }
}

export class ApimeAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const trimmedToken = validateHeaderToken(apiToken)
    const hostname = new URL(baseUrl).hostname
    const url = new URL(apiPath, baseUrl).toString()

    const data = await adapterFetch<ApimeUser>(
      url,
      hostname,
      options,
      authHeaders(trimmedToken, options)
    )

    return parseApimeUser(data, hostname, options?.apimeClassMap)
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const trimmedToken = validateHeaderToken(apiToken)
    const hostname = new URL(baseUrl).hostname
    const url = new URL(apiPath, baseUrl).toString()

    try {
      const data = await adapterFetch<ApimeUser>(
        url,
        hostname,
        options,
        authHeaders(trimmedToken, options)
      )
      // A body fetchStats would fail must not read as healthy here (adapter
      // standard 2.6).
      return [
        {
          label: "User Stats",
          endpoint: apiPath,
          data,
          error: pollError(() => parseApimeUser(data, hostname, options?.apimeClassMap)),
        },
      ]
    } catch (err) {
      return [
        {
          label: "User Stats",
          endpoint: apiPath,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        },
      ]
    }
  }
}
