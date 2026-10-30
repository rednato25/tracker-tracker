import { describe, expect, it } from "vitest"
import {
  buildRankOverviews,
  UNKNOWN_COLLECTED,
} from "@/lib/rank-overview"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-30T12:00:00.000Z")
const TIB = 1024 ** 4

const BASE_STATS: TrackerLatestStats = {
  ratio: 2.4,
  ratioIsInfinite: false,
  uploadedBytes: String(2 * TIB),
  downloadedBytes: String(1 * TIB),
  bufferBytes: String(1 * TIB),
  seedingCount: 8,
  leechingCount: 1,
  requiredRatio: 1,
  warned: false,
  freeleechTokens: 0,
  hitAndRuns: 0,
  seedbonus: 1234,
  shareScore: null,
  username: "owner",
  group: "Power User",
}

function tracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "TorrentLeech",
    baseUrl: "https://tl.invalid",
    registrySlug: "torrentleech",
    platformType: "unit3d",
    isActive: true,
    lastPolledAt: "2026-10-30T11:00:00.000Z",
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
    latestStats: BASE_STATS,
    ...overrides,
  }
}

describe("buildRankOverviews", () => {
  it("projects the saved target and every condition with current and required values", () => {
    const [overview] = buildRankOverviews(
      [tracker()],
      { "1": { targetRank: "Super User" } },
      NOW
    )
    expect(overview.currentClass).toBe("Power User")
    expect(overview.targetClass).toBe("Super User")
    expect(overview.targetKind).toBe("saved")
    expect(overview.targetReached).toBe(false)
    expect(overview.hasStructuredRules).toBe(true)
    expect(overview.conditions).toHaveLength(3)
    expect(overview.conditions[0]).toMatchObject({
      requirement: "At least 12 weeks registered",
      current: "302 days",
      required: "84 days",
      status: "met",
      unknownReason: null,
    })
    expect(overview.conditions[1]).toMatchObject({
      requirement: "More than 1 TiB uploaded",
      current: "2.00 TiB",
      required: "1.00 TiB",
      status: "met",
    })
    expect(overview.ruleText).toContain("12 weeks registered")
    expect(overview.siteUrl).toBe("https://www.torrentleech.org")
    expect(overview.source).toMatchObject({
      title: "TorrentLeech Wiki - User Classes",
      verification: "published",
      url: expect.stringContaining("torrentleech"),
    })
  })

  it("labels a missing supported observation as not collected for this tracker", () => {
    const [overview] = buildRankOverviews(
      [
        tracker({
          latestStats: { ...BASE_STATS, uploadedBytes: null },
        }),
      ],
      { "1": { targetRank: "Power User" } },
      NOW
    )
    const upload = overview.conditions.find((condition) => condition.metric === "uploadedBytes")
    expect(upload?.status).toBe("unknown")
    expect(upload?.current).toBe("\u2014")
    expect(upload?.unknownReason).toBe(UNKNOWN_COLLECTED)
  })

  it("labels a supported metric with no observation as not collected, even off Gazelle", () => {
    const [overview] = buildRankOverviews(
      [
        tracker({
          id: 2,
          name: "DreadVault",
          registrySlug: "dreadvault",
          latestStats: { ...BASE_STATS, group: "User" },
        }),
      ],
      { "2": { targetRank: "Ancient One" } },
      NOW
    )
    const uploads = overview.conditions.find((condition) => condition.metric === "uploads")
    expect(uploads?.status).toBe("unknown")
    expect(uploads?.unknownReason).toBe(UNKNOWN_COLLECTED)
  })

  it("labels an uploads requirement on a UNIT3D tracker as not collected", () => {
    const [overview] = buildRankOverviews(
      [
        tracker({
          id: 5,
          name: "Zenith",
          registrySlug: "zenith",
          latestStats: { ...BASE_STATS, group: "Explorer" },
        }),
      ],
      { "5": { targetRank: "Bulker" } },
      NOW
    )
    const uploads = overview.conditions.find((condition) => condition.metric === "uploads")
    expect(uploads?.status).toBe("unknown")
    expect(uploads?.unknownReason).toBe(UNKNOWN_COLLECTED)
  })

  it("keeps free-text ladders when the registry publishes no structured goal", () => {
    const [overview] = buildRankOverviews(
      [
        tracker({
          id: 3,
          name: "Aither",
          registrySlug: "aither",
          latestStats: { ...BASE_STATS, group: "Phobos" },
        }),
      ],
      {},
      NOW
    )
    expect(overview.currentClass).toBe("Phobos")
    expect(overview.targetClass).toBe("Harmonia")
    expect(overview.targetKind).toBe("automatic")
    expect(overview.hasStructuredRules).toBe(false)
    expect(overview.conditions).toEqual([])
    expect(overview.ruleText).toContain("Upload")
    expect(overview.source.verification).toBe("missing")
    expect(overview.classes.map((userClass) => userClass.name)).toContain("Leech")
  })

  it("keeps an active tracker with no registry entry or stats instead of dropping it", () => {
    const [overview] = buildRankOverviews(
      [
        tracker({
          id: 4,
          name: "Private Unknown",
          registrySlug: "not-in-the-registry",
          latestStats: null,
        }),
      ],
      {},
      NOW
    )
    expect(overview.currentClass).toBeNull()
    expect(overview.targetClass).toBeNull()
    expect(overview.conditions).toEqual([])
    expect(overview.source.verification).toBe("missing")
    expect(overview.siteUrl).toBe("https://tl.invalid")
  })

  it("does not call a branching prefix the top of the ladder", () => {
    const [overview] = buildRankOverviews(
      [
        tracker({
          id: 5,
          name: "Zenith",
          registrySlug: "zenith",
          latestStats: { ...BASE_STATS, group: "Explorer" },
        }),
      ],
      { "5": { targetRank: "Bulker" } },
      NOW
    )
    expect(overview.targetClass).toBe("Bulker")
    expect(overview.targetKind).toBe("saved")
    expect(overview.highestAutomatic).toBe(false)
    expect(overview.hasStructuredRules).toBe(true)
    expect(overview.conditions).toHaveLength(4)
    const seedTime = overview.conditions.find(
      (condition) => condition.metric === "averageSeedTimeSeconds"
    )
    expect(seedTime?.status).toBe("unknown")
    expect(seedTime?.unknownReason).toBe(UNKNOWN_COLLECTED)
    expect(seedTime?.current).toBe("\u2014")
  })

  it("marks a saved target at or below the current class and keeps the next automatic class", () => {
    const [overview] = buildRankOverviews(
      [tracker()],
      { "1": { targetRank: "Power User" } },
      NOW
    )
    expect(overview.targetReached).toBe(true)
    expect(overview.reachedTarget).toBe("Power User")
    expect(overview.targetClass).toBe("Super User")
    expect(overview.targetKind).toBe("automatic")
  })
})
