// src/lib/tracker-recovery.ts
//
// P39 failed-poll recovery. Auto-pause stays at four consecutive failures, but
// a paused tracker is retried on a bounded backoff. Manual pauses never enter
// this path. A rejected cookie/token stops after the first retry and carries a
// persistent marker in last_error, so no schema change is needed.

export const POLL_FAILURE_THRESHOLD = 4
export const LOGIN_EXPIRED_STOP_MESSAGE = "Login expired, update credentials"

const HOUR_MS = 60 * 60 * 1000
const LOGIN_EXPIRED =
  /login expired|authentication failed|session expired|invalid credentials|invalid .*api key|api key.*invalid|unauthorized|forbidden|requires 2fa|alt 2fa token|\b401\b|\b403\b/i

type FailurePausedTracker = {
  pausedAt?: Date | string | null
  userPausedAt?: Date | string | null
  consecutiveFailures?: number | null
  lastError?: string | null
  lastErrorAt?: Date | string | null
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function isLoginExpiredMessage(message: string | null | undefined): boolean {
  return typeof message === "string" && LOGIN_EXPIRED.test(message)
}

/** True after the first retry of a login-expired pause has also failed. */
export function isAutoRetryStopped(tracker: FailurePausedTracker): boolean {
  if (!tracker.pausedAt || tracker.userPausedAt) return false
  return tracker.lastError === LOGIN_EXPIRED_STOP_MESSAGE
}

/**
 * 1h after the pause, 3h after the first failed retry, 6h after the second,
 * then every 12h.
 */
export function failureRetryDelayMs(consecutiveFailures: number): number {
  if (consecutiveFailures <= POLL_FAILURE_THRESHOLD) return 1 * HOUR_MS
  if (consecutiveFailures === POLL_FAILURE_THRESHOLD + 1) return 3 * HOUR_MS
  if (consecutiveFailures === POLL_FAILURE_THRESHOLD + 2) return 6 * HOUR_MS
  return 12 * HOUR_MS
}

/**
 * When an auto-paused tracker is next due. Null means no automatic retry:
 * manual pause, no pause at all, or a stopped login-expired retry.
 */
export function nextFailureRetryAt(tracker: FailurePausedTracker): Date | null {
  if (!tracker.pausedAt || tracker.userPausedAt) return null
  if (isAutoRetryStopped(tracker)) return null
  const base = asDate(tracker.lastErrorAt) ?? asDate(tracker.pausedAt)
  if (!base) return null
  return new Date(
    base.getTime() + failureRetryDelayMs(Math.max(0, tracker.consecutiveFailures ?? 0))
  )
}

export function isFailureRetryDue(tracker: FailurePausedTracker, now: Date): boolean {
  const retryAt = nextFailureRetryAt(tracker)
  return retryAt !== null && now.getTime() >= retryAt.getTime()
}

/** The card's plain-language cause, not the sanitized transport string. */
export function plainPollError(message: string | null | undefined): string {
  if (!message) return "No error recorded"
  if (isLoginExpiredMessage(message)) return LOGIN_EXPIRED_STOP_MESSAGE
  if (/timed?\s*out/i.test(message)) return "Timeout"
  if (
    /unreachable|not found|refused|reset|connection failed|connection reset|site down|offline|ECONN|ENOTFOUND|EHOSTUNREACH|ECONNREFUSED|ECONNRESET/i.test(
      message
    )
  ) {
    return "Site down"
  }
  return message
}
