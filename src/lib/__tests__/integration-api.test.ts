import { describe, expect, it } from "vitest"
import {
  buildIntegrationActions,
  buildIntegrationHistory,
  buildIntegrationSummary,
  INTEGRATION_HISTORY_DEFAULT_DAYS,
  INTEGRATION_HISTORY_DEFAULT_LIMIT,
  INTEGRATION_MAX_SUMMARY_TRACKERS,
  parseHistoryQuery,
} from "@/lib/integration-api"
import { maskUsername } from "@/lib/privacy"
import type { TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-26T12:00:00.000Z")

function tracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "Private Example",
    baseUrl: "https://private.example.invalid",
    registrySlug: null,
    platformType: "unit3d",
    isActive: true,
    lastPolledAt: "2026-10-26T11:55:00.000Z",
    lastError: "https://private.example.invalid/api?apikey=leaked",
    lastErrorAt: "2026-10-26T11:55:00.000Z",
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    color: "#123456",
    qbtTag: "tt",
    mouseholeUrl: null,
    hasMouseholeToken: false,
    useProxy: false,
    countCrossSeedUnsatisfied: false,
    hideUnreadBadges: false,
    isFavorite: false,
    sortOrder: 1,
    joinedAt: "2020-01-01",
    lastAccessAt: "2026-10-20T00:00:00.000Z",
    remoteUserId: 42,
    platformMeta: null,
    createdAt: "2020-01-01T00:00:00.000Z",
    latestStats: {
      ratio: 2,
      ratioIsInfinite: false,
      uploadedBytes: "1000",
      downloadedBytes: "500",
      bufferBytes: "500",
      seedingCount: 3,
      leechingCount: 1,
      requiredRatio: 1,
      warned: false,
      freeleechTokens: 0,
      hitAndRuns: 0,
      seedbonus: 10,
      shareScore: null,
      username: "owner-name",
      group: "Power User",
    },
    ...overrides,
  }
}

describe("buildIntegrationSummary", () => {
  it("hides tracker identity and usernames by default", () => {
    const body = buildIntegrationSummary([tracker()], { identityMode: "none", storeUsernames: true }, NOW)
    const serialized = JSON.stringify(body)

    expect(body.privacy).toEqual({ trackerIdentity: "none", usernamesIncluded: false })
    expect(body.trackers[0]).not.toHaveProperty("name")
    expect(body.trackers[0]).not.toHaveProperty("lastAccessAt")
    expect(body.trackers[0].latestStats).not.toHaveProperty("username")
    expect(body.trackers[0]).not.toHaveProperty("baseUrl")
    expect(body.trackers[0]).not.toHaveProperty("lastError")
    expect(serialized).not.toContain("private.example.invalid")
    expect(serialized).not.toContain("owner-name")
    expect(serialized).not.toContain("apikey")
  })

  it("reveals tracker names but not usernames in trackers mode", () => {
    const body = buildIntegrationSummary(
      [tracker()],
      { identityMode: "trackers", storeUsernames: true },
      NOW
    )
    expect(body.trackers[0].name).toBe("Private Example")
    expect(body.trackers[0].latestStats).not.toHaveProperty("username")
    expect(body.trackers[0]).not.toHaveProperty("lastAccessAt")
  })

  it("reveals usernames only in full mode and only when username storage is on", () => {
    const full = buildIntegrationSummary(
      [tracker()],
      { identityMode: "full", storeUsernames: true },
      NOW
    )
    expect(full.trackers[0].latestStats?.username).toBe("owner-name")
    expect(full.trackers[0].lastAccessAt).toBe("2026-10-20T00:00:00.000Z")

    const scrubbed = buildIntegrationSummary(
      [tracker()],
      { identityMode: "full", storeUsernames: false },
      NOW
    )
    expect(scrubbed.trackers[0].latestStats).not.toHaveProperty("username")
    expect(scrubbed.trackers[0]).not.toHaveProperty("lastAccessAt")
  })

  it("suppresses a redacted username even in full mode", () => {
    const base = tracker().latestStats
    const redacted = maskUsername("owner-name")
    const body = buildIntegrationSummary(
      [
        tracker({
          latestStats: base && redacted ? { ...base, username: redacted } : null,
        }),
      ],
      { identityMode: "full", storeUsernames: true },
      NOW
    )
    expect(body.trackers[0].latestStats).not.toHaveProperty("username")
  })

  it("preserves unknown and stale data distinctions", () => {
    const body = buildIntegrationSummary(
      [
        tracker({ id: 1, latestStats: null, lastPolledAt: null }),
        tracker({ id: 2, lastPolledAt: "2026-10-26T08:00:00.000Z" }),
        tracker({ id: 3, lastPolledAt: "2026-10-26T11:55:00.000Z" }),
      ],
      { identityMode: "none", storeUsernames: false },
      NOW
    )
    expect(body.trackers.map((item) => item.dataState)).toEqual(["unknown", "stale", "current"])
    expect(body.counts.unknownData).toBe(1)
  })

  it("bounds the tracker list and marks truncation without losing aggregate counts", () => {
    const many = Array.from({ length: INTEGRATION_MAX_SUMMARY_TRACKERS + 1 }, (_, index) =>
      tracker({ id: index + 1 })
    )
    const body = buildIntegrationSummary(many, { identityMode: "none", storeUsernames: false }, NOW)

    expect(body.trackers).toHaveLength(INTEGRATION_MAX_SUMMARY_TRACKERS)
    expect(body.truncated).toBe(true)
    expect(body.counts.total).toBe(INTEGRATION_MAX_SUMMARY_TRACKERS + 1)
    expect(body.totals.uploadedBytes).toBe(String((INTEGRATION_MAX_SUMMARY_TRACKERS + 1) * 1000))
  })
})

describe("buildIntegrationActions", () => {
  it("removes tracker and client names in the default privacy mode", () => {
    const body = buildIntegrationActions(
      {
        trackers: [tracker({ lastPolledAt: "2026-10-26T08:00:00.000Z" })],
        clients: [{ id: 9, name: "Private qBittorrent", enabled: true, lastError: "boom" }],
      },
      { identityMode: "none", storeUsernames: false },
      NOW
    )

    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain("Private Example")
    expect(serialized).not.toContain("Private qBittorrent")
    expect(body.actions.every((action) => !("trackerName" in action))).toBe(true)
    expect(body.actions.some((action) => action.status === "needs-verification")).toBe(true)
  })

  it("includes tracker names but never a client name in trackers mode", () => {
    const body = buildIntegrationActions(
      {
        trackers: [tracker({ lastPolledAt: "2026-10-26T08:00:00.000Z" })],
        clients: [{ id: 9, name: "Private qBittorrent", enabled: true, lastError: "boom" }],
      },
      { identityMode: "trackers", storeUsernames: false },
      NOW
    )

    const trackerAction = body.actions.find((action) => action.trackerId === 1)
    const clientAction = body.actions.find((action) => action.trackerId === null)
    expect(trackerAction?.trackerName).toBe("Private Example")
    expect(clientAction).not.toHaveProperty("trackerName")
    expect(JSON.stringify(body)).not.toContain("Private qBittorrent")
  })
})

describe("parseHistoryQuery", () => {
  it("uses bounded defaults", () => {
    const parsed = parseHistoryQuery(new URL("http://localhost/api/integrations/v1/history"))
    expect(parsed).toEqual({
      ok: true,
      query: {
        days: INTEGRATION_HISTORY_DEFAULT_DAYS,
        limit: INTEGRATION_HISTORY_DEFAULT_LIMIT,
        trackerId: null,
        before: null,
      },
    })
  })

  it.each([
    ["days=91", "days must be an integer between 1 and 90"],
    ["limit=501", "limit must be an integer between 1 and 500"],
    ["days=abc", "days must be an integer between 1 and 90"],
    ["trackerId=0", "trackerId must be an integer between 1 and 2147483647"],
    ["before=yesterday", "before must be an ISO-8601 UTC timestamp"],
  ])("rejects oversized or malformed %s", (query, error) => {
    const parsed = parseHistoryQuery(
      new URL(`http://localhost/api/integrations/v1/history?${query}`)
    )
    expect(parsed).toEqual({ ok: false, error })
  })
})

describe("buildIntegrationHistory", () => {
  it("keeps the requested range and exposes a cursor when truncated", () => {
    const body = buildIntegrationHistory(
      { days: 7, limit: 2, trackerId: 4, before: null },
      [
        {
          trackerId: 4,
          polledAt: "2026-10-25T00:00:00.000Z",
          uploadedBytes: "1",
          downloadedBytes: "1",
          ratio: 1,
          bufferBytes: "0",
          seeding: 1,
          leeching: 0,
          isManual: false,
        },
        {
          trackerId: 4,
          polledAt: "2026-10-26T00:00:00.000Z",
          uploadedBytes: "2",
          downloadedBytes: "1",
          ratio: 2,
          bufferBytes: "1",
          seeding: 2,
          leeching: 0,
          isManual: false,
        },
      ],
      true,
      NOW
    )

    expect(body.truncated).toBe(true)
    expect(body.nextBefore).toBe("2026-10-25T00:00:00.000Z")
    expect(body.range).toMatchObject({ days: 7, maxDays: 90, limit: 2, maxLimit: 500, trackerId: 4 })
  })
})
