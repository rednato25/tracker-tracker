import { describe, expect, it } from "vitest"
import type { TrackerAction } from "@/lib/actions"
import {
  buildDigest,
  type DigestConfig,
  type DigestTargetState,
  digestConfigFromSettings,
  isDigestDue,
} from "@/lib/digest"
import { truncateUtf8 } from "@/lib/utf8"

const config: DigestConfig = {
  enabled: true,
  time: "09:00",
  timezone: "UTC",
  emptyBehavior: "skip",
  targetIds: null,
}

function state(overrides: Partial<DigestTargetState> = {}): DigestTargetState {
  return {
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastDigestKey: null,
    nextAttemptAt: null,
    failureCount: 0,
    ...overrides,
  }
}

function action(overrides: Partial<TrackerAction> = {}): TrackerAction {
  return {
    key: "ratio-below-account:tracker:1",
    type: "ratio-below-account",
    status: "action-required",
    priority: "critical",
    trackerId: 1,
    trackerName: "Alpha",
    reason: "Ratio is below the account minimum.",
    nextAction: "Improve the ratio.",
    deadline: null,
    evidence: {},
    dismissible: true,
    ...overrides,
  }
}

describe("digest scheduling", () => {
  it("is due only after the configured local time", () => {
    expect(isDigestDue(config, undefined, new Date("2026-10-24T08:59:00Z")).due).toBe(false)
    expect(isDigestDue(config, undefined, new Date("2026-10-24T09:00:00Z")).due).toBe(true)
  })

  it("deduplicates the local date and does not replay missed days", () => {
    const first = isDigestDue(config, undefined, new Date("2026-10-24T10:00:00Z"))
    expect(first.due).toBe(true)
    expect(
      isDigestDue(config, state({ lastDigestKey: first.key }), new Date("2026-10-24T23:00:00Z")).due
    ).toBe(false)
    expect(
      isDigestDue(config, state({ lastDigestKey: first.key }), new Date("2026-10-25T10:00:00Z"))
        .due
    ).toBe(true)
  })

  it("handles the New York DST spring and fall boundaries", () => {
    const ny: DigestConfig = { ...config, timezone: "America/New_York" }
    expect(isDigestDue(ny, undefined, new Date("2026-03-08T12:59:00Z")).due).toBe(false)
    expect(isDigestDue(ny, undefined, new Date("2026-03-08T13:00:00Z")).due).toBe(true)
    expect(isDigestDue(ny, undefined, new Date("2026-11-01T13:00:00Z")).due).toBe(false)
    expect(isDigestDue(ny, undefined, new Date("2026-11-01T14:00:00Z")).due).toBe(true)
  })

  it("respects retry backoff and disabled config", () => {
    expect(
      isDigestDue(
        config,
        state({ nextAttemptAt: "2026-10-24T10:00:00Z" }),
        new Date("2026-10-24T09:30:00Z")
      ).due
    ).toBe(false)
    expect(isDigestDue({ ...config, enabled: false }, undefined, new Date("2026-10-24T10:00:00Z")).due).toBe(false)
  })

  it("parses selected target ids and empty behavior", () => {
    expect(
      digestConfigFromSettings({
        digestEnabled: true,
        digestTime: "09:00",
        digestTimezone: "UTC",
        digestEmptyBehavior: "send",
        digestTargetIds: "[2,3]",
      })
    ).toMatchObject({ targetIds: [2, 3], emptyBehavior: "send" })
  })
})

describe("digest rendering", () => {
  it("separates confirmed and verification items and omits resolved actions", () => {
    const text = buildDigest(
      [
        action(),
        action({
          key: "stale-data:tracker:2",
          type: "stale-data",
          status: "needs-verification",
          trackerId: 2,
          trackerName: "Beta",
          reason: "Data is stale.",
          nextAction: "Check the integration.",
        }),
      ],
      { dateKey: "2026-10-24", timezone: "UTC", emptyBehavior: "skip" }
    )
    expect(text).toContain("ACTION REQUIRED — Alpha")
    expect(text).toContain("NEEDS VERIFICATION — Beta")
    expect(text).not.toContain("resolved")
  })

  it("skips empty digests by default and sends only when explicitly configured", () => {
    expect(
      buildDigest([], { dateKey: "2026-10-24", timezone: "UTC", emptyBehavior: "skip" })
    ).toBeNull()
    expect(
      buildDigest([], { dateKey: "2026-10-24", timezone: "UTC", emptyBehavior: "send" })
    ).toContain("No active actions")
  })

  it("keeps the ntfy byte limit for emoji and Romanian diacritics", () => {
    const text = "ăâîșț🙂".repeat(1000)
    const trimmed = truncateUtf8(text, 4096)
    expect(Buffer.byteLength(trimmed, "utf8")).toBeLessThanOrEqual(4096)
    expect(trimmed.endsWith("…")).toBe(true)
  })

  it("truncates predictably with an omitted count and a safe dashboard link", () => {
    const actions = Array.from({ length: 30 }, (_, index) =>
      action({
        key: `ratio-below-account:tracker:${index + 1}`,
        trackerId: index + 1,
        trackerName: `Tracker ${index + 1}`,
        reason: `Reason ${index + 1} `.repeat(10),
      })
    )
    const text = buildDigest(actions, {
      dateKey: "2026-10-24",
      timezone: "UTC",
      emptyBehavior: "skip",
      maxChars: 600,
      dashboardUrl: "https://tracker.example.test/",
    })
    expect(text?.length).toBeLessThanOrEqual(600)
    expect(text).toContain("more item")
    expect(text).toContain("https://tracker.example.test/")
  })
})
