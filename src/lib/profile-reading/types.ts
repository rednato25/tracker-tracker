// src/lib/profile-reading/types.ts
//
// P49 record stored under platformMeta.profileRead. It is deliberately
// latest-only: a daily fetch replaces the previous values, and a failed fetch
// keeps them with a status that makes the rank layer mark them stale.

export const PROFILE_READ_INTERVAL_MS = 24 * 60 * 60 * 1000
export const PROFILE_READ_STALE_MS = 24 * 60 * 60 * 1000

export type ProfileReadStatus = "session_expired" | "page_changed"

/** Metrics a profile page can supply, in their canonical units. */
export interface ProfileReadValues {
  /** Bytes. */
  seedSizeBytes?: number
  /** Seconds. */
  averageSeedTimeSeconds?: number
  /** Uploaded torrents. */
  uploads?: number
  /** Gamification level (V3X). */
  level?: number
  /** Total XP (V3X). */
  xp?: number
}

export interface ProfileReadRecord {
  /** ISO instant of the last successful read; null when no page has parsed. */
  fetchedAt: string | null
  /** ISO instant of the last attempt, successful or not. Drives the 24h gate. */
  attemptedAt: string | null
  /** Null means the last attempt succeeded, or none has run yet. */
  status: ProfileReadStatus | null
  values: ProfileReadValues
  /** User-facing cause; never carries page content or the cookie. */
  message?: string
}

const STATUS_VALUES: ReadonlySet<string> = new Set(["session_expired", "page_changed"])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null
  return Number.isNaN(Date.parse(value)) ? null : value
}

function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined
}

function normalizeValues(raw: unknown): ProfileReadValues {
  if (!isPlainObject(raw)) return {}
  const values: ProfileReadValues = {}
  const seedSizeBytes = nonNegativeNumber(raw.seedSizeBytes)
  if (seedSizeBytes !== undefined) values.seedSizeBytes = seedSizeBytes
  const averageSeedTimeSeconds = nonNegativeNumber(raw.averageSeedTimeSeconds)
  if (averageSeedTimeSeconds !== undefined) {
    values.averageSeedTimeSeconds = averageSeedTimeSeconds
  }
  const uploads = nonNegativeNumber(raw.uploads)
  if (uploads !== undefined) values.uploads = uploads
  const level = nonNegativeNumber(raw.level)
  if (level !== undefined) values.level = level
  const xp = nonNegativeNumber(raw.xp)
  if (xp !== undefined) values.xp = xp
  return values
}

/** Reads a stored record, tolerating a missing or malformed platformMeta. */
export function readProfileReadRecord(platformMeta: unknown): ProfileReadRecord | null {
  if (!isPlainObject(platformMeta)) return null
  const raw = platformMeta.profileRead
  if (!isPlainObject(raw)) return null
  const status =
    typeof raw.status === "string" && STATUS_VALUES.has(raw.status)
      ? (raw.status as ProfileReadStatus)
      : null
  return {
    fetchedAt: isoOrNull(raw.fetchedAt),
    attemptedAt: isoOrNull(raw.attemptedAt),
    status,
    values: normalizeValues(raw.values),
    ...(typeof raw.message === "string" && raw.message ? { message: raw.message } : {}),
  }
}

/**
 * Reading is eligible when the tracker is due and the last attempt did not stop
 * it. A session-expired or page-changed tracker stays stopped until the user
 * saves a new cookie or re-enables the setting.
 */
export function isProfileReadDue(record: ProfileReadRecord | null, now: Date): boolean {
  if (record?.status) return false
  const attempted = record?.attemptedAt ? Date.parse(record.attemptedAt) : Number.NaN
  if (Number.isNaN(attempted)) return true
  return now.getTime() - attempted >= PROFILE_READ_INTERVAL_MS
}

/** True while a stored record can still be used as an observation. */
export function isProfileReadFresh(record: ProfileReadRecord | null, now: Date): boolean {
  if (!record || record.status || !record.fetchedAt) return false
  const fetched = Date.parse(record.fetchedAt)
  if (Number.isNaN(fetched)) return false
  return now.getTime() - fetched <= PROFILE_READ_STALE_MS
}
