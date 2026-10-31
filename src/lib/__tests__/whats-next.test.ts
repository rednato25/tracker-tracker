import { describe, expect, it } from "vitest"
import { buildWhatsNext } from "@/lib/whats-next"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-28T12:00:00.000Z")
const DAY_MS = 24 * 60 * 60 * 1000
const GIB = 1024 ** 3
const TIB = 1024 ** 4

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString()
}

function stats(overrides: Partial<TrackerLatestStats> = {}): TrackerLatestStats {
  return {
    ratio: 3,
    ratioIsInfinite: false,
    uploadedBytes: String(2 * TIB),
    downloadedBytes: String(1 * TIB),
    bufferBytes: String(1 * TIB),
    seedingCount: 20,
    leechingCount: 0,
    requiredRatio: 1,
    warned: false,
    freeleechTokens: 0,
    hitAndRuns: 0,
    seedbonus: 100,
    shareScore: null,
    username: "owner",
    group: "Power User",
    ...overrides,
  }
}

function tracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "TorrentLeech",
    baseUrl: "https://tl.invalid",
    registrySlug: "torrentleech",
    platformType: "unit3d",
    isActive: true,
    lastPolledAt: daysAgo(1 / 24),
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    color: "#2ecc71",
    qbtTag: null,
    mouseholeUrl: null,
    hasMouseholeToken: false,
    useProxy: false,
    countCrossSeedUnsatisfied: false,
    hideUnreadBadges: false,
    isFavorite: false,
    sortOrder: 1,
    joinedAt: daysAgo(70),
    lastAccessAt: daysAgo(1),
    remoteUserId: null,
    platformMeta: null,
    createdAt: daysAgo(365),
    latestStats: stats(),
    ...overrides,
  }
}

describe("buildWhatsNext", () => {
  it("lists an account-age-only promotion with the exact wait and an all-met promotion first", () => {
    const items = buildWhatsNext({
      trackers: [
        tracker({ id: 1, name: "Yu-Scene", joinedAt: daysAgo(70) }),
        tracker({ id: 2, name: "AllMet", joinedAt: daysAgo(100) }),
      ],
      savedRankGoals: {
        "1": { targetRank: "Super User" },
        "2": { targetRank: "Super User" },
      },
      now: NOW,
    })

    expect(items.map((item) => item.kind)).toEqual(["promotion-waiting", "promotion-time"])
    expect(items[0]).toMatchObject({
      trackerName: "AllMet",
      kind: "promotion-waiting",
      dueInDays: 0,
    })
    expect(items[0].detail).toContain("waiting for the site")
    expect(items[1]).toMatchObject({
      trackerName: "Yu-Scene",
      kind: "promotion-time",
      dueInDays: 14,
    })
    expect(items[1].title).toBe("Yu-Scene \u2192 Super User")
    expect(items[1].detail).toBe("in 14 days of account age")
  })

  it("includes a login deadline within 14 days and a ratio within 10% of the threshold", () => {
    const items = buildWhatsNext({
      trackers: [
        tracker({
          id: 1,
          name: "LoginSoon",
          registrySlug: "blutopia",
          latestStats: null,
          lastAccessAt: daysAgo(20),
        }),
        tracker({
          id: 2,
          name: "RatioEdge",
          latestStats: stats({
            ratio: 1.05,
            requiredRatio: 1,
            uploadedBytes: String(100 * GIB),
          }),
        }),
      ],
      savedRankGoals: {},
      now: NOW,
    })

    const login = items.find((item) => item.kind === "login")
    expect(login).toMatchObject({ trackerName: "LoginSoon", dueInDays: 10 })
    expect(login?.detail).toBe("due in 10 days")

    const ratio = items.find((item) => item.kind === "ratio")
    expect(ratio).toMatchObject({ trackerName: "RatioEdge", dueInDays: null })
    expect(ratio?.detail).toContain("minimum 1.00")
  })

  it("excludes logins beyond 14 days and ratios outside the 10% band", () => {
    const items = buildWhatsNext({
      trackers: [
        tracker({
          id: 1,
          name: "LoginLater",
          registrySlug: "blutopia",
          latestStats: null,
          lastAccessAt: daysAgo(1),
        }),
        tracker({
          id: 2,
          name: "RatioSafe",
          latestStats: stats({ ratio: 1.5, requiredRatio: 1 }),
        }),
        tracker({
          id: 3,
          name: "RatioBelow",
          latestStats: stats({ ratio: 0.9, requiredRatio: 1 }),
        }),
        tracker({
          id: 4,
          name: "StaleRatio",
          lastPolledAt: daysAgo(3),
          latestStats: stats({ ratio: 1.01, requiredRatio: 1 }),
        }),
      ],
      savedRankGoals: {},
      now: NOW,
    })

    expect(items).toHaveLength(0)
  })

  it("returns at most five rows, soonest first", () => {
    const trackers = Array.from({ length: 6 }, (_, index) =>
      tracker({
        id: index + 1,
        name: `Tracker ${index + 1}`,
        registrySlug: "blutopia",
        lastAccessAt: daysAgo(20 + index),
        latestStats: null,
      })
    )
    const items = buildWhatsNext({
      trackers,
      savedRankGoals: {},
      now: NOW,
      limit: 5,
    })

    expect(items).toHaveLength(5)
    const days = items.map((item) => item.dueInDays as number)
    expect(days).toEqual([...days].sort((a, b) => a - b))
  })
})
