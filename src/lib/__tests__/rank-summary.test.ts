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
    expect(summary.bars.length).toBeGreaterThan(0)
    expect(summary.totalChecks).toBeGreaterThan(0)
    expect(summary.distanceText).toMatch(/^Super User:/)
    expect(summary.bars[0]).toMatchObject({
      current: expect.any(String),
      required: expect.any(String),
      status: expect.stringMatching(/^(met|unmet|unknown)$/),
    })
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

  it("says the highest automatic class is reached at the top of the ladder", () => {
    const summary = buildRankGoalSummaries(
      [tracker({ latestStats: { ...tracker().latestStats!, group: "TL GOD" } })],
      {},
      NOW
    )[0]
    expect(summary.highestAutomatic).toBe(true)
    expect(summary.automaticNextRank).toBeNull()
    expect(summary.nextRankName).toBeNull()
    expect(summary.nextRankRequirements).toBeNull()
    expect(summary.bars).toEqual([])
  })

  it("does not call a branching prefix the top of the ladder", () => {
    const summary = buildRankGoalSummaries(
      [
        tracker({
          registrySlug: "zenith",
          name: "Zenith",
          latestStats: { ...tracker().latestStats!, group: "Explorer" },
        }),
      ],
      { "1": { targetRank: "Bulker" } },
      NOW
    )[0]
    expect(summary.targetRank).toBe("Bulker")
    expect(summary.highestAutomatic).toBe(false)
    expect(summary.automaticNextRank).toBeNull()
    expect(summary.totalChecks).toBe(4)
  })

  it("marks a saved target at or below the current class as reached and offers the next class", () => {
    const summary = buildRankGoalSummaries(
      [tracker({ latestStats: { ...tracker().latestStats!, group: "Super User" } })],
      { "1": { targetRank: "Power User" } },
      NOW
    )[0]
    expect(summary.targetReached).toBe(true)
    expect(summary.targetRank).toBe("Power User")
    expect(summary.automaticNextRank).toBe("Extreme User")
    expect(summary.bars.length).toBeGreaterThan(0)
    expect(summary.distanceText).toMatch(/^Extreme User:/)
  })

  it("shows Target reached and the highest automatic class when the target is already at the top", () => {
    const summary = buildRankGoalSummaries(
      [
        tracker({
          registrySlug: "myanonamouse",
          name: "MyAnonaMouse",
          latestStats: { ...tracker().latestStats!, group: "Power User" },
        }),
      ],
      { "1": { targetRank: "User" } },
      NOW
    )[0]
    expect(summary.targetReached).toBe(true)
    expect(summary.automaticNextRank).toBeNull()
    expect(summary.highestAutomatic).toBe(true)
  })

  it("names a text-only next class and keeps its rule text", () => {
    const summary = buildRankGoalSummaries(
      [
        tracker({
          registrySlug: "v3x",
          name: "V3X",
          latestStats: { ...tracker().latestStats!, group: "Figurant" },
        }),
      ],
      {},
      NOW
    )[0]
    expect(summary.status).toBe("unsupported")
    expect(summary.automaticNextRank).toBe("Second rôle")
    expect(summary.nextRankName).toBe("Second rôle")
    expect(summary.nextIsTextOnly).toBe(true)
    expect(summary.nextRankRequirements).toBe("Level 10, 11 088 XP")
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

describe("rank ladder state", () => {
  function only(overrides: Partial<TrackerSummary>, saved: Record<string, { targetRank: string }> = {}) {
    const summaries = buildRankGoalSummaries([tracker(overrides)], saved, NOW)
    expect(summaries).toHaveLength(1)
    return summaries[0]
  }

  it("summarizes a text-only ladder with no saved target instead of dropping it", () => {
    const summary = only({
      registrySlug: "aither",
      name: "Aither",
      latestStats: { ...tracker().latestStats!, group: "Phobos" },
    })
    expect(summary.status).toBe("unsupported")
    expect(summary.ladderState).toBe("next")
    expect(summary.automaticNextRank).toBe("Harmonia")
    expect(summary.nextIsTextOnly).toBe(true)
    expect(summary.nextRankRequirements).toMatch(/Upload/)
    expect(summary.highestAutomatic).toBe(false)
  })

  it("reserves the top state for the top of an evaluated automatic ladder", () => {
    expect(only({ latestStats: { ...tracker().latestStats!, group: "TL GOD" } }).ladderState).toBe(
      "top"
    )
    expect(
      only({
        registrySlug: "aither",
        name: "Aither",
        latestStats: { ...tracker().latestStats!, group: "Titan" },
      }).ladderState
    ).toBe("top")
  })

  it("says a branching prefix branches rather than tops out", () => {
    const summary = only({
      registrySlug: "zenith",
      name: "Zenith",
      latestStats: { ...tracker().latestStats!, group: "Explorer" },
    })
    expect(summary.ladderState).toBe("branch")
    expect(summary.highestAutomatic).toBe(false)
  })

  it("marks a staff or appointed class as appointed", () => {
    const summary = only({
      registrySlug: "aither",
      name: "Aither",
      latestStats: { ...tracker().latestStats!, group: "Uploader" },
    })
    expect(summary.ladderState).toBe("appointed")
  })

  it("marks a class that is not in the saved ladder as off-ladder", () => {
    const summary = only({
      registrySlug: "aither",
      name: "Aither",
      latestStats: { ...tracker().latestStats!, group: "Mystery Class" },
    })
    expect(summary.ladderState).toBe("off-ladder")
    expect(summary.highestAutomatic).toBe(false)
  })

  it("does not infer a next class without a reported or visible current class", () => {
    expect(only({ latestStats: { ...tracker().latestStats!, group: null } }).ladderState).toBe(
      "no-rank"
    )
    const hidden = only({ latestStats: { ...tracker().latestStats!, group: "▓▓▓▓▓▓" } })
    expect(hidden.currentRankHidden).toBe(true)
    expect(hidden.ladderState).toBe("no-rank")
  })

  it("calls a banned or disabled account restricted, not missing from the ladder", () => {
    const summary = only({
      registrySlug: "latteam",
      name: "Lat-Team",
      latestStats: { ...tracker().latestStats!, group: "Banned" },
    })
    expect(summary.ladderState).toBe("restricted")
    expect(summary.automaticNextRank).toBeNull()
  })

  it.each([
    ["speedapp", "Peasant", "User"],
    ["retromoviesclub", "Seat Filler", "Actor"],
    ["myanonamouse", "Mouse", "User"],
    ["dreadvault", "Leech", "User"],
    ["seedcore", "Leech", "User"],
    ["latteam", "Leech", "User"],
  ])("puts %s's starting or demotion class %s on the ladder below %s", (slug, current, next) => {
    const summary = only({
      registrySlug: slug,
      latestStats: { ...tracker().latestStats!, group: current },
    })
    expect(summary.ladderState).toBe("next")
    expect(summary.automaticNextRank).toBe(next)
  })

  it("summarizes a tracker with no registry ladder as no-ladder", () => {
    const summary = only({ registrySlug: null, name: "Custom" })
    expect(summary.ladderState).toBe("no-ladder")
    expect(summary.highestAutomatic).toBe(false)
    expect(summary.automaticNextRank).toBeNull()
  })
})
