import { describe, expect, it } from "vitest"
import { maskUsername } from "@/lib/privacy"
import { buildRankGoalSummaries, parseSavedRankGoals } from "@/lib/rank-summary"
import type { PlatformMeta, TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-28T12:00:00.000Z")
const GIB = 1024 ** 3
const TIB = 1024 ** 4

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
    latestStats: {
      ratio: 1.2,
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
      group: "User",
    },
    ...overrides,
  }
}

describe("buildRankGoalSummaries", () => {
  it("shows the saved target and known unmet requirements", () => {
    const summaries = buildRankGoalSummaries(
      [tracker({ latestStats: { ...tracker().latestStats!, ratio: 1.0 } })],
      { "1": { targetRank: "Super User" } },
      NOW
    )
    const summary = summaries[0]
    expect(summary.targetRank).toBe("Super User")
    expect(summary.currentRank).toBe("User")
    expect(summary.status).toBe("goal")
    expect(summary.unmet.length).toBeGreaterThan(0)
    expect(summary.unknown.length).toBe(0)
    expect(summary.linkHref).toBe("/trackers/1#rank-goal")
    expect(summary.linkLabel).toBe("Open rank goal")
  })

  it("keeps stale observations unknown rather than treating them as met", () => {
    const summaries = buildRankGoalSummaries(
      [tracker({ lastPolledAt: "2026-10-20T10:00:00.000Z" })],
      { "1": { targetRank: "Power User" } },
      NOW
    )
    expect(summaries[0].unknown.length).toBeGreaterThan(0)
    expect(summaries[0].unmet).toEqual([])
    expect(summaries[0].metCount).toBeGreaterThan(0)
  })

  it("shows an unknown current rank without inventing one", () => {
    const summaries = buildRankGoalSummaries(
      [tracker({ latestStats: { ...tracker().latestStats!, group: null } })],
      { "1": { targetRank: "Power User" } },
      NOW
    )
    expect(summaries[0].currentRank).toBeNull()
    expect(summaries[0].currentRankHidden).toBe(false)
    expect(summaries[0].targetRank).toBe("Power User")
  })

  it("shows an unsupported tracker's current rank and unavailable structured progress", () => {
    const summaries = buildRankGoalSummaries(
      [
        tracker({
          registrySlug: "aither",
          name: "Aither",
          latestStats: { ...tracker().latestStats!, group: "Power User" },
        }),
      ],
      { "1": { targetRank: "Power User" } },
      NOW
    )
    const summary = summaries[0]
    expect(summary.status).toBe("unsupported")
    expect(summary.currentRank).toBe("Power User")
    expect(summary.unmet).toEqual([])
    expect(summary.linkLabel).toBe("Open tracker")
  })

  it("offers only an automatic next rank and target-selection link when no target is saved", () => {
    const summaries = buildRankGoalSummaries(
      [tracker({ latestStats: { ...tracker().latestStats!, group: "Power User" } })],
      {},
      NOW
    )
    expect(summaries[0].status).toBe("no-target")
    expect(summaries[0].automaticNextRank).toBe("Super User")
    expect(summaries[0].targetRank).toBeNull()
    expect(summaries[0].linkLabel).toBe("Choose a target")
  })

  it("evaluates REDacted uploads from Gazelle community, not the ranks percentile", () => {
    const red = tracker({
      registrySlug: "redacted",
      name: "REDacted",
      platformType: "gazelle",
      platformMeta: { community: { uploaded: 3 }, ranks: { uploads: 99 } } as unknown as PlatformMeta,
      latestStats: { ...tracker().latestStats!, group: "User", uploadedBytes: String(1 * GIB) },
    })
    const present = buildRankGoalSummaries([red], { "1": { targetRank: "Power User" } }, NOW)[0]
    expect(present.metCount).toBeGreaterThan(0)
    expect(present.unmet.some((item) => item.label === "At least 5 uploads")).toBe(true)
    expect(present.unmet.find((item) => item.label === "At least 5 uploads")?.remaining).toBe("2")
    expect(present.unknown.some((item) => item.label === "At least 5 uploads")).toBe(false)

    const missing = buildRankGoalSummaries(
      [
        tracker({
          registrySlug: "redacted",
          name: "REDacted",
          platformType: "gazelle",
          platformMeta: { ranks: { uploads: 999 } } as unknown as PlatformMeta,
          latestStats: { ...tracker().latestStats!, group: "User" },
        }),
      ],
      { "1": { targetRank: "Power User" } },
      NOW
    )[0]
    expect(missing.unknown.some((item) => item.label === "At least 5 uploads")).toBe(true)
  })

  it("hides a redacted observed rank", () => {
    const summaries = buildRankGoalSummaries(
      [
        tracker({
          latestStats: { ...tracker().latestStats!, group: maskUsername("Power User") },
        }),
      ],
      { "1": { targetRank: "Power User" } },
      NOW
    )
    expect(summaries[0].currentRankHidden).toBe(true)
    expect(summaries[0].currentRank).toBeNull()
  })
})

describe("parseSavedRankGoals", () => {
  it("keeps valid saved targets and drops malformed values", () => {
    expect(
      parseSavedRankGoals(
        JSON.stringify({
          "1": { targetRank: "Power User" },
          "0": { targetRank: "Bad" },
          "2": { targetRank: "" },
          "3": { targetRank: 42 },
        })
      )
    ).toEqual({ "1": { targetRank: "Power User" } })
  })

  it("returns an empty map for corrupt JSON", () => {
    expect(parseSavedRankGoals("{")).toEqual({})
    expect(parseSavedRankGoals(null)).toEqual({})
  })
})
