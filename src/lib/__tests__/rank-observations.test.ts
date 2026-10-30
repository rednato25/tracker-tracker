import { describe, expect, it } from "vitest"
import { buildRankObservations } from "@/lib/rank-observations"
import type { TrackerLatestStats } from "@/types/api"

const NOW = new Date("2026-10-28T12:00:00.000Z")

function stats(overrides: Partial<TrackerLatestStats> = {}): TrackerLatestStats {
  return {
    ratio: 2,
    ratioIsInfinite: false,
    uploadedBytes: "1000",
    downloadedBytes: "500",
    bufferBytes: "500",
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
    ...overrides,
  }
}

describe("buildRankObservations", () => {
  it("maps Gazelle community.uploaded as uploads with the same freshness/source", () => {
    const result = buildRankObservations({
      latestStats: stats(),
      lastPolledAt: "2026-10-28T11:00:00.000Z",
      platformType: "gazelle",
      platformMeta: { community: { uploaded: 3 }, ranks: { uploads: 99 } },
      now: NOW,
    })

    expect(result.uploads).toEqual({
      value: 3,
      freshness: "fresh",
      source: "api",
      observedAt: "2026-10-28T11:00:00.000Z",
    })
    expect(result.accountRatio?.freshness).toBe("fresh")
  })

  it("keeps missing uploads unknown and never uses ranks.uploads", () => {
    const result = buildRankObservations({
      latestStats: stats(),
      lastPolledAt: "2026-10-28T11:00:00.000Z",
      platformType: "gazelle",
      platformMeta: { community: {}, ranks: { uploads: 99 } },
      now: NOW,
    })

    expect(result.uploads).toBeUndefined()
  })

  it("keeps an infinite ratio as a usable observation", () => {
    const result = buildRankObservations({
      latestStats: stats({ ratio: null, ratioIsInfinite: true }),
      lastPolledAt: "2026-10-28T11:00:00.000Z",
      platformType: "unit3d",
      platformMeta: null,
      now: NOW,
    })

    expect(result.accountRatio?.value).toBe(Number.POSITIVE_INFINITY)
    expect(result.accountRatio?.freshness).toBe("fresh")
  })

  it("marks stale observations consistently", () => {
    const result = buildRankObservations({
      latestStats: stats(),
      lastPolledAt: "2026-10-27T10:00:00.000Z",
      platformType: "gazelle",
      platformMeta: { community: { uploaded: 3 } },
      now: NOW,
    })

    expect(result.uploads?.freshness).toBe("stale")
    expect(result.accountRatio?.freshness).toBe("stale")
  })

  it("ignores Gazelle metadata on another platform and returns empty without stats", () => {
    const other = buildRankObservations({
      latestStats: stats(),
      lastPolledAt: "2026-10-28T11:00:00.000Z",
      platformType: "unit3d",
      platformMeta: { community: { uploaded: 3 } },
      now: NOW,
    })
    expect(other.uploads).toBeUndefined()

    expect(
      buildRankObservations({
        latestStats: null,
        lastPolledAt: null,
        platformType: "gazelle",
        platformMeta: { community: { uploaded: 3 } },
        now: NOW,
      })
    ).toEqual({})
  })

  it("reads stored seed size from each platform's own metadata key", () => {
    const filelist = buildRankObservations({
      latestStats: stats(),
      lastPolledAt: "2026-10-28T11:00:00.000Z",
      platformType: "filelist",
      platformMeta: { totalSeedSizeBytes: 5 * 1024 ** 4 },
      now: NOW,
    })
    expect(filelist.seedSizeBytes?.value).toBe(5 * 1024 ** 4)

    const portugas = buildRankObservations({
      latestStats: stats(),
      lastPolledAt: "2026-10-28T11:00:00.000Z",
      platformType: "portugas",
      platformMeta: { seedSizeBytes: 2 * 1024 ** 4 },
      now: NOW,
    })
    expect(portugas.seedSizeBytes?.value).toBe(2 * 1024 ** 4)

    const digitalcore = buildRankObservations({
      latestStats: stats(),
      lastPolledAt: "2026-10-28T11:00:00.000Z",
      platformType: "digitalcore",
      platformMeta: { seedSizeBytes: 3 * 1024 ** 3 },
      now: NOW,
    })
    expect(digitalcore.seedSizeBytes?.value).toBe(3 * 1024 ** 3)
  })

  it("reads CarPT seeding points and leaves average seed time uncollected", () => {
    const result = buildRankObservations({
      latestStats: stats(),
      lastPolledAt: "2026-10-28T11:00:00.000Z",
      platformType: "carpt",
      platformMeta: { seedingPoints: 27730.1 },
      now: NOW,
    })
    expect(result.seedingPoints?.value).toBe(27730.1)
    expect(result.averageSeedTimeSeconds).toBeUndefined()
  })

  it("keeps a missing seed size or seeding points absent instead of zero", () => {
    const filelist = buildRankObservations({
      latestStats: stats(),
      lastPolledAt: "2026-10-28T11:00:00.000Z",
      platformType: "filelist",
      platformMeta: {},
      now: NOW,
    })
    expect(filelist.seedSizeBytes).toBeUndefined()

    const carpt = buildRankObservations({
      latestStats: stats(),
      lastPolledAt: "2026-10-28T11:00:00.000Z",
      platformType: "carpt",
      platformMeta: {},
      now: NOW,
    })
    expect(carpt.seedingPoints).toBeUndefined()
  })
})
