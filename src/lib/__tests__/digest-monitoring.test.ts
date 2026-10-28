import { describe, expect, it } from "vitest"
import type { TrackerAction } from "@/lib/actions"
import { buildDigest, buildDigestForData } from "@/lib/digest"
import { buildDigestMonitoring } from "@/lib/digest-monitoring"
import { maskUsername } from "@/lib/privacy"
import type { TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-28T12:00:00.000Z")
const GIB = 1024 ** 3
const TIB = 1024 ** 4

function stats() {
  return {
    ratio: 2,
    ratioIsInfinite: false,
    uploadedBytes: String(1 * TIB),
    downloadedBytes: String(500 * GIB),
    bufferBytes: String(500 * GIB),
    seedingCount: 3,
    leechingCount: 0,
    requiredRatio: 1,
    warned: false,
    freeleechTokens: 0,
    hitAndRuns: 0,
    seedbonus: 100,
    shareScore: null,
    username: "owner",
    group: "Power User",
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
    lastPolledAt: "2026-10-28T10:00:00.000Z",
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    color: "#123456",
    qbtTag: null,
    mouseholeUrl: null,
    hasMouseholeToken: false,
    useProxy: false,
    countCrossSeedUnsatisfied: false,
    hideUnreadBadges: false,
    isFavorite: false,
    sortOrder: 1,
    joinedAt: "2026-01-01T00:00:00.000Z",
    lastAccessAt: null,
    remoteUserId: null,
    platformMeta: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    latestStats: stats(),
    ...overrides,
  }
}

const action: TrackerAction = {
  key: "ratio-below-account:tracker:1",
  type: "ratio-below-account",
  status: "action-required",
  priority: "critical",
  trackerId: 1,
  trackerName: "TorrentLeech",
  reason: "Ratio is below the account minimum.",
  nextAction: "Improve the ratio.",
  deadline: null,
  evidence: {},
  dismissible: true,
}

describe("buildDigestMonitoring", () => {
  it("shows fresh metrics, buffer sign and tracker-specific bonus without summing", () => {
    const section = buildDigestMonitoring(
      [
        tracker(),
        tracker({ id: 2, name: "Other", latestStats: { ...stats(), seedbonus: 20 } }),
      ],
      { "1": { targetRank: "Power User" } },
      NOW
    )
    expect(section?.trackers.find((row) => row.trackerId === 1)).toMatchObject({
      ratio: "2.00",
      buffer: "+500 GiB",
      uploaded: "1.00 TiB",
      downloaded: "500 GiB",
      seeding: "3",
      bonus: "100",
      rank: "Power User",
      target: "Power User",
      freshness: "fresh",
    })
    expect(section?.trackers.find((row) => row.trackerId === 2)?.bonus).toBe("20")
    expect(section?.trackers.map((row) => row.bonus).join(" ")).not.toContain("120")
  })

  it("keeps confirmed zero distinct from missing and marks stale/missing snapshots", () => {
    const section = buildDigestMonitoring(
      [
        tracker({
          latestStats: {
            ...stats(),
            uploadedBytes: "0",
            downloadedBytes: "0",
            bufferBytes: "0",
            seedingCount: 0,
            seedbonus: 0,
          },
        }),
        tracker({ id: 2, lastPolledAt: "2026-10-28T08:00:00.000Z" }),
        tracker({ id: 3, latestStats: null, lastPolledAt: null }),
      ],
      {},
      NOW
    )
    expect(section?.trackers.find((row) => row.trackerId === 1)).toMatchObject({
      uploaded: "0 B",
      downloaded: "0 B",
      buffer: "0 B",
      seeding: "0",
      bonus: "0",
    })
    expect(section?.trackers.find((row) => row.trackerId === 2)?.freshness).toBe("stale")
    expect(section?.trackers.find((row) => row.trackerId === 3)?.freshness).toBe("missing")
    expect(section?.trackers.find((row) => row.trackerId === 3)?.ratio).toBe("\u2014")
  })

  it("hides a redacted rank", () => {
    const section = buildDigestMonitoring(
      [tracker({ latestStats: { ...stats(), group: maskUsername("Power User") } })],
      {},
      NOW
    )
    expect(section?.trackers[0].rank).toBe("hidden")
  })

  it("puts actions before monitoring and sends monitoring-only content under skip", () => {
    const monitoring = buildDigestMonitoring([tracker()], {}, NOW)
    const withAction = buildDigest([action], {
      dateKey: "2026-10-28",
      timezone: "UTC",
      emptyBehavior: "skip",
      monitoring,
    })
    expect(withAction?.indexOf("ACTION REQUIRED")).toBeLessThan(
      withAction?.indexOf("MONITORING") ?? -1
    )

    const monitoringOnly = buildDigest([], {
      dateKey: "2026-10-28",
      timezone: "UTC",
      emptyBehavior: "skip",
      monitoring,
    })
    expect(monitoringOnly).toContain("No active actions or verification items.")
    expect(monitoringOnly).toContain("MONITORING")
    expect(monitoringOnly).toContain("TorrentLeech")
  })

  it("bounds monitoring rows with a visible omitted count", () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      tracker({ id: index + 1, name: `Tracker ${index + 1}` })
    )
    const section = buildDigestMonitoring(many, {}, NOW, 2)
    expect(section?.trackers).toHaveLength(2)
    expect(section?.omitted).toBe(10)

    const text = buildDigest([], {
      dateKey: "2026-10-28",
      timezone: "UTC",
      emptyBehavior: "skip",
      monitoring: section,
    })
    expect(text).toContain("10 trackers not shown")
  })

  it("uses the same monitoring renderer through the settings data helper", () => {
    const text = buildDigestForData(
      {
        digestEnabled: true,
        digestTime: "09:00",
        digestTimezone: "UTC",
        digestEmptyBehavior: "skip",
        digestIncludeMonitoring: true,
        digestTargetIds: null,
        rankGoals: JSON.stringify({ "1": { targetRank: "Power User" } }),
      },
      [tracker()],
      [],
      NOW,
      "2026-10-28",
      null
    )
    expect(text).toContain("MONITORING")
    expect(text).toContain("target Power User")
  })
})
