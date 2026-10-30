import { describe, expect, it } from "vitest"
import { RECRUITMENT_CATALOG } from "@/data/recruitment-catalog"
import { buildRouteChoices } from "@/lib/recruitment-pathways"
import { emptyRecruitmentState } from "@/lib/recruitment-state"
import { buildWishlistPaths, type WishlistPathView } from "@/lib/recruitment-wishlist"
import type { TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-30T12:00:00.000Z")

function tracker(): TrackerSummary {
  return {
    id: 1,
    name: "AlphaRatio",
    registrySlug: "alpharatio",
    joinedAt: "2025-01-01T00:00:00.000Z",
    lastPolledAt: NOW.toISOString(),
    latestStats: null,
  } as TrackerSummary
}

function paths(): WishlistPathView[] {
  const result = buildWishlistPaths({
    catalog: RECRUITMENT_CATALOG,
    desiredTrackerSlug: "Aither",
    trackers: [tracker()],
    savedRankGoals: {},
    state: emptyRecruitmentState(),
    now: NOW,
    maxHops: 3,
    maxPathsPerSource: 200,
    maxTotal: 500,
  })
  expect(result.paths.length).toBeGreaterThanOrEqual(3)
  return result.paths
}

function withDays(path: WishlistPathView, days: number | null, key = path.key): WishlistPathView {
  return { ...path, key, totalDaysRemaining: days }
}

describe("P40 route choices", () => {
  it("sorts by fastest days left, with unknown waits last", () => {
    const [one, two, , , , six] = paths()
    const choices = [
      withDays(one, 0),
      withDays(two, 5),
      withDays(six, 2),
      withDays(six, null, "unknown"),
    ]
    const result = buildRouteChoices({
      paths: choices,
      sort: "fastest",
      maxHops: 3,
      startFrom: null,
      pinnedKey: null,
    })
    expect(result.choices.map((choice) => choice.waitLabel)).toEqual([
      "Ready now",
      "2 days left",
      "5 days left",
      "Unknown",
    ])
  })

  it("sorts by fewest hops and still puts unknown waits last", () => {
    const [one, two, , , , six] = paths()
    const choices = [
      withDays(one, 0),
      withDays(two, 5),
      withDays(six, 2),
      withDays(six, null, "unknown"),
    ]
    const result = buildRouteChoices({
      paths: choices,
      sort: "fewest-hops",
      maxHops: 3,
      startFrom: null,
      pinnedKey: null,
    })
    expect(result.choices.map((choice) => [choice.hops, choice.waitLabel])).toEqual([
      [1, "Ready now"],
      [2, "2 days left"],
      [2, "5 days left"],
      [2, "Unknown"],
    ])
  })

  it("applies the max-hops filter", () => {
    const all = paths()
    const oneHop = buildRouteChoices({
      paths: all,
      sort: "fastest",
      maxHops: 1,
      startFrom: null,
      pinnedKey: null,
    })
    expect(oneHop.total).toBe(1)
    expect(oneHop.choices[0].hops).toBe(1)

    const twoHops = buildRouteChoices({
      paths: all,
      sort: "fastest",
      maxHops: 2,
      startFrom: null,
      pinnedKey: null,
    })
    expect(twoHops.total).toBe(3)
  })

  it("applies the start-from filter", () => {
    const all = paths()
    const fromAlpha = buildRouteChoices({
      paths: all,
      sort: "fastest",
      maxHops: 3,
      startFrom: "AlphaRatio",
      pinnedKey: null,
    })
    expect(fromAlpha.total).toBe(all.length)

    const fromOther = buildRouteChoices({
      paths: all,
      sort: "fastest",
      maxHops: 3,
      startFrom: "TorrentLeech",
      pinnedKey: null,
    })
    expect(fromOther.total).toBe(0)
  })

  it("puts a pinned route first and the fastest route right below it", () => {
    const [one, two, three] = paths()
    const choices = [withDays(one, 10), withDays(two, 2), withDays(three, 5)]
    const pinned = choices[2]
    const result = buildRouteChoices({
      paths: choices,
      sort: "fastest",
      maxHops: 3,
      startFrom: null,
      pinnedKey: pinned.key,
    })
    expect(result.choices[0].path.key).toBe(pinned.key)
    expect(result.choices[0].pinned).toBe(true)
    expect(result.choices[1].fastest).toBe(true)
    expect(result.choices[1].path.key).toBe(choices[1].key)
  })

  it("reports whether a route has a requirement to check", () => {
    const [one] = paths()
    const result = buildRouteChoices({
      paths: [one],
      sort: "fastest",
      maxHops: 3,
      startFrom: null,
      pinnedKey: null,
    })
    expect(result.choices[0].needsChecking).toBe(true)
  })
})
