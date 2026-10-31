// src/lib/profile-reading/meta.ts
//
// platformMeta is rewritten by every poll. These helpers are the only two
// merge points: a poll keeps the stored profileRead block, and a profile read
// keeps every API-owned key.

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseMeta(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isPlainObject(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * The meta to persist after a normal poll: the fresh adapter metadata plus the
 * profileRead block already on the row, if any. A tracker that never enabled
 * profile reading is untouched.
 */
export function withPreservedProfileRead<T>(next: T, existingRaw: string | null | undefined): T {
  const existing = parseMeta(existingRaw)
  const profileRead = existing?.profileRead
  if (profileRead === undefined) return next
  if (isPlainObject(next)) return { ...next, profileRead } as T
  return { profileRead } as T
}

/**
 * The meta to persist after a profile read: the current API metadata untouched,
 * with only profileRead replaced. Returns null when the row has no usable meta
 * and the record carries nothing, so the column never becomes "{}".
 */
export function withProfileReadRecord(
  existingRaw: string | null | undefined,
  record: unknown
): string {
  const existing = parseMeta(existingRaw)
  return JSON.stringify({ ...(existing ?? {}), profileRead: record })
}

/**
 * Clears the stop state and the 24-hour attempt stamp so a newly saved cookie
 * is tried on the next scheduler tick. The last successful values and their
 * fetch time stay in place until the new read replaces them.
 */
export function resetProfileReadGate(existingRaw: string | null | undefined): string | null {
  const existing = parseMeta(existingRaw)
  const record = existing?.profileRead
  if (!isPlainObject(record)) return null
  const { status: _status, attemptedAt: _attemptedAt, message: _message, ...rest } = record
  return JSON.stringify({ ...existing, profileRead: rest })
}

