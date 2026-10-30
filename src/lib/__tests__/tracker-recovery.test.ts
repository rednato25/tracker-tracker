import { describe, expect, it } from "vitest"
import {
  failureRetryDelayMs,
  isAutoRetryStopped,
  isFailureRetryDue,
  isLoginExpiredMessage,
  LOGIN_EXPIRED_STOP_MESSAGE,
  nextFailureRetryAt,
  plainPollError,
} from "@/lib/tracker-recovery"

const HOUR = 60 * 60 * 1000
const NOW = new Date("2026-10-30T12:00:00.000Z")

describe("tracker failed-poll recovery", () => {
  it("backs off 1h, 3h, 6h, then every 12h", () => {
    expect(failureRetryDelayMs(4) / HOUR).toBe(1)
    expect(failureRetryDelayMs(5) / HOUR).toBe(3)
    expect(failureRetryDelayMs(6) / HOUR).toBe(6)
    expect(failureRetryDelayMs(7) / HOUR).toBe(12)
    expect(failureRetryDelayMs(20) / HOUR).toBe(12)
  })

  it("schedules an auto-paused retry from the last failure", () => {
    const failedAt = new Date(NOW.getTime() - 2 * HOUR)
    expect(
      nextFailureRetryAt({
        pausedAt: new Date(NOW.getTime() - 2 * HOUR),
        lastErrorAt: failedAt,
        consecutiveFailures: 5,
        userPausedAt: null,
        lastError: "Request timed out",
      })
    ).toEqual(new Date(failedAt.getTime() + 3 * HOUR))
  })

  it("never schedules a manual pause", () => {
    expect(
      nextFailureRetryAt({
        pausedAt: new Date(NOW.getTime() - 5 * HOUR),
        lastErrorAt: new Date(NOW.getTime() - 5 * HOUR),
        consecutiveFailures: 6,
        userPausedAt: new Date(NOW.getTime() - HOUR),
        lastError: "Request timed out",
      })
    ).toBeNull()
  })

  it("stops a login-expired pause after the first retry", () => {
    const tracker = {
      pausedAt: new Date(NOW.getTime() - HOUR),
      lastErrorAt: new Date(NOW.getTime() - HOUR),
      consecutiveFailures: 5,
      userPausedAt: null,
      lastError: LOGIN_EXPIRED_STOP_MESSAGE,
    }
    expect(isAutoRetryStopped(tracker)).toBe(true)
    expect(nextFailureRetryAt(tracker)).toBeNull()
    expect(isFailureRetryDue(tracker, NOW)).toBe(false)
  })

  it("is due once the backoff has elapsed", () => {
    const failedAt = new Date(NOW.getTime() - 4 * HOUR)
    const tracker = {
      pausedAt: failedAt,
      lastErrorAt: failedAt,
      consecutiveFailures: 4,
      userPausedAt: null,
      lastError: "Request timed out",
    }
    expect(isFailureRetryDue(tracker, NOW)).toBe(true)
  })

  it("recognizes rejected cookies and tokens", () => {
    expect(isLoginExpiredMessage("Authentication failed")).toBe(true)
    expect(isLoginExpiredMessage("Session expired")).toBe(true)
    expect(isLoginExpiredMessage("Invalid credentials")).toBe(true)
    expect(isLoginExpiredMessage("Invalid API key")).toBe(true)
    expect(isLoginExpiredMessage("Request timed out")).toBe(false)
  })

  it("reduces sanitized errors to plain words", () => {
    expect(plainPollError("Request timed out")).toBe("Timeout")
    expect(plainPollError("Host unreachable")).toBe("Site down")
    expect(plainPollError("Session expired")).toBe(LOGIN_EXPIRED_STOP_MESSAGE)
    expect(plainPollError(LOGIN_EXPIRED_STOP_MESSAGE)).toBe(LOGIN_EXPIRED_STOP_MESSAGE)
    expect(plainPollError("Tracker returned an unexpected response")).toBe(
      "Tracker returned an unexpected response"
    )
  })
})
