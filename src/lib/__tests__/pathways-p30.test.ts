import { spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { PATHWAYS_TRACKERS, RECRUITMENT_CATALOG } from "@/data/recruitment-catalog"
import type {
  RecruitmentCatalog,
  RecruitmentRouteRecord,
  RecruitmentSourceGate,
} from "@/lib/recruitment-routes"
import { RECRUITMENT_ROUTE_FORMAT_VERSION } from "@/lib/recruitment-routes"
import { emptyRecruitmentState } from "@/lib/recruitment-state"
import { buildWishlistPaths } from "@/lib/recruitment-wishlist"
import type { TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-28T12:00:00.000Z")
const TARGET = PATHWAYS_TRACKERS.find(
  (tracker) =>
    !tracker.registrySlug &&
    RECRUITMENT_CATALOG.routes.some((route) => route.destinationTrackerId === tracker.id)
)?.id

function route(overrides: Partial<RecruitmentRouteRecord> = {}): RecruitmentRouteRecord {
  return {
    id: "tp:AlphaRatio:Unregistered",
    sourceTrackerId: "AlphaRatio",
    destinationTrackerId: TARGET ?? "Unregistered",
    sourceRegistrySlug: "alpharatio",
    destinationRegistrySlug: null,
    requirements: null,
    requirementNotes: ["Readable prose only"],
    minimumDays: 60,
    availability: "open",
    availabilityRaw: "Yes",
    sourceUpdatedAt: "2026-10",
    sourceUpdatedRaw: "Oct 2026",
    ...overrides,
  }
}

function catalog(
  routes: RecruitmentRouteRecord[],
  sourceGates: RecruitmentSourceGate[] = []
): RecruitmentCatalog {
  return {
    formatVersion: RECRUITMENT_ROUTE_FORMAT_VERSION,
    source: RECRUITMENT_CATALOG.source,
    routes,
    sourceGates,
    overrides: [],
  }
}

function tracker(joinedAt: string | null): TrackerSummary {
  return {
    id: 1,
    name: "AlphaRatio",
    registrySlug: "alpharatio",
    isActive: true,
    pausedAt: null,
    userPausedAt: null,
    color: "#123456",
    joinedAt,
    lastPolledAt: "2026-10-28T11:00:00.000Z",
    latestStats: null,
  } as TrackerSummary
}

function ownedTracker(
  id: number,
  name: string,
  registrySlug: string,
  joinedAt: string
): TrackerSummary {
  return { ...tracker(joinedAt), id, name, registrySlug }
}

const RECENT_JOIN = "2026-09-18T12:00:00.000Z"

function rankingCatalog() {
  return catalog([
    route({
      id: "tp:Aither:Target",
      sourceTrackerId: "Aither",
      destinationTrackerId: TARGET as string,
      sourceRegistrySlug: "aither",
      minimumDays: 100,
    }),
    route({
      id: "tp:Zenith:Target",
      sourceTrackerId: "Zenith",
      destinationTrackerId: TARGET as string,
      sourceRegistrySlug: "zenith",
      minimumDays: 7,
    }),
  ])
}

function rankingTrackers(): TrackerSummary[] {
  return [
    ownedTracker(1, "Aither", "aither", RECENT_JOIN),
    ownedTracker(2, "Zenith", "zenith", RECENT_JOIN),
  ]
}

function state(target: string) {
  return { ...emptyRecruitmentState(), desiredTrackerSlug: target }
}

describe("P30 full pathways wishlist", () => {
  it("keeps the complete pinned trackerpathways snapshot and attribution", () => {
    expect(RECRUITMENT_CATALOG.routes).toHaveLength(598)
    expect(RECRUITMENT_CATALOG.sourceGates).toHaveLength(61)
    expect(RECRUITMENT_CATALOG.source.version).toMatch(/^[0-9a-f]{40}$/)
    expect(RECRUITMENT_CATALOG.source.license).toBe("MIT")
    expect(RECRUITMENT_CATALOG.source.attribution).toContain("trackerpathways")
  })

  it("selects a destination that is not in the tracker registry", () => {
    expect(TARGET).toBeTruthy()
    const desired = TARGET as string
    const result = buildWishlistPaths({
      catalog: catalog([route({ destinationTrackerId: desired })]),
      desiredTrackerSlug: desired,
      trackers: [tracker("2026-01-01T00:00:00.000Z")],
      savedRankGoals: {},
      state: state(desired),
      now: NOW,
    })
    expect(result.paths).toHaveLength(1)
    expect(result.paths[0].steps[0].destinationTrackerId).toBe(desired)
  })

  it("finds a two-hop path through an unregistered tracker", () => {
    const middle = "Unregistered Middle"
    const result = buildWishlistPaths({
      catalog: catalog([
        route({ id: "tp:AlphaRatio:Middle", destinationTrackerId: middle }),
        route({
          id: "tp:Middle:Target",
          sourceTrackerId: middle,
          destinationTrackerId: TARGET as string,
          sourceRegistrySlug: null,
        }),
      ]),
      desiredTrackerSlug: TARGET as string,
      trackers: [tracker("2026-01-01T00:00:00.000Z")],
      savedRankGoals: {},
      state: state(TARGET as string),
      now: NOW,
    })
    expect(result.paths[0].routeIds).toHaveLength(2)
    expect(result.paths[0].steps[1].scenario).toBe(true)
  })

  it("ranks a faster route from an alphabetically later source ahead of a slower earlier one", () => {
    const result = buildWishlistPaths({
      catalog: rankingCatalog(),
      desiredTrackerSlug: TARGET as string,
      trackers: rankingTrackers(),
      savedRankGoals: {},
      state: state(TARGET as string),
      now: NOW,
    })
    expect(result.paths.map((path) => path.steps[0].sourceTrackerId)).toEqual(["Zenith", "Aither"])
    expect(result.paths.map((path) => path.totalDaysRemaining)).toEqual([0, 60])
  })

  it("applies the cap only after ranking", () => {
    const result = buildWishlistPaths({
      catalog: rankingCatalog(),
      desiredTrackerSlug: TARGET as string,
      trackers: rankingTrackers(),
      savedRankGoals: {},
      state: state(TARGET as string),
      now: NOW,
      maxTotal: 1,
    })
    expect(result.paths).toHaveLength(1)
    expect(result.paths[0].steps[0].sourceTrackerId).toBe("Zenith")
    expect(result.truncated).toBe(true)
  })

  it("ranks unknown-day paths after known ones", () => {
    const item = catalog([
      route({
        id: "tp:Aither:Target",
        sourceTrackerId: "Aither",
        destinationTrackerId: TARGET as string,
        sourceRegistrySlug: "aither",
        minimumDays: null,
      }),
      route({
        id: "tp:Zenith:Target",
        sourceTrackerId: "Zenith",
        destinationTrackerId: TARGET as string,
        sourceRegistrySlug: "zenith",
        minimumDays: 7,
      }),
    ])
    const result = buildWishlistPaths({
      catalog: item,
      desiredTrackerSlug: TARGET as string,
      trackers: rankingTrackers(),
      savedRankGoals: {},
      state: state(TARGET as string),
      now: NOW,
    })
    expect(result.paths.map((path) => path.steps[0].sourceTrackerId)).toEqual(["Zenith", "Aither"])
    expect(result.paths.map((path) => path.totalDaysRemaining)).toEqual([0, null])
  })

  it("includes source-gate days in the fastest ranking", () => {
    const item = catalog(
      [
        route({
          id: "tp:Aither:Target",
          sourceTrackerId: "Aither",
          destinationTrackerId: TARGET as string,
          sourceRegistrySlug: "aither",
          minimumDays: 0,
        }),
        route({
          id: "tp:Zenith:Target",
          sourceTrackerId: "Zenith",
          destinationTrackerId: TARGET as string,
          sourceRegistrySlug: "zenith",
          minimumDays: 7,
        }),
      ],
      [{ trackerId: "Aither", days: 80, text: "Gate: 80 days" }]
    )
    const result = buildWishlistPaths({
      catalog: item,
      desiredTrackerSlug: TARGET as string,
      trackers: rankingTrackers(),
      savedRankGoals: {},
      state: state(TARGET as string),
      now: NOW,
    })
    expect(result.paths.map((path) => path.steps[0].sourceTrackerId)).toEqual(["Zenith", "Aither"])
    expect(result.paths.map((path) => path.totalDaysRemaining)).toEqual([0, 40])
  })

  it("uses each path's own start tracker join date for the first hop", () => {
    const result = buildWishlistPaths({
      catalog: rankingCatalog(),
      desiredTrackerSlug: TARGET as string,
      trackers: [
        ownedTracker(1, "Aither", "aither", new Date(NOW.getTime() - 10 * 86_400_000).toISOString()),
        ownedTracker(2, "Zenith", "zenith", new Date(NOW.getTime() - 200 * 86_400_000).toISOString()),
      ],
      savedRankGoals: {},
      state: state(TARGET as string),
      now: NOW,
    })
    const bySource = new Map(result.paths.map((path) => [path.steps[0].sourceTrackerId, path]))
    expect(bySource.get("Aither")?.steps[0].evaluation.timeGate).toMatchObject({
      accountAgeDays: 10,
      effectiveDays: 100,
      daysRemaining: 90,
    })
    expect(bySource.get("Zenith")?.steps[0].evaluation.timeGate).toMatchObject({
      accountAgeDays: 200,
      effectiveDays: 7,
      daysRemaining: 0,
    })
    expect(bySource.get("Zenith")?.totalDaysRemaining).toBe(0)
    expect(bySource.get("Aither")?.totalDaysRemaining).toBe(90)
  })

  it("shows days remaining from account age and keeps unknown age unknown", () => {
    const open = buildWishlistPaths({
      catalog: catalog([route({ minimumDays: 60 })]),
      desiredTrackerSlug: TARGET as string,
      trackers: [tracker(new Date(NOW.getTime() - 30 * 86_400_000).toISOString())],
      savedRankGoals: {},
      state: state(TARGET as string),
      now: NOW,
    })
    expect(open.paths[0].steps[0].evaluation.timeGate).toMatchObject({
      effectiveDays: 60,
      daysRemaining: 30,
      status: "waiting",
    })

    const unknown = buildWishlistPaths({
      catalog: catalog([route({ minimumDays: 60 })]),
      desiredTrackerSlug: TARGET as string,
      trackers: [tracker(null)],
      savedRankGoals: {},
      state: state(TARGET as string),
      now: NOW,
    })
    expect(unknown.paths[0].steps[0].evaluation.timeGate).toMatchObject({
      effectiveDays: 60,
      daysRemaining: null,
      status: "unknown",
    })
  })

  it("uses the larger of route days and forum days per step, then sums the path", () => {
    const middle = "Unregistered Middle"
    const result = buildWishlistPaths({
      catalog: catalog(
        [
          route({ id: "tp:AlphaRatio:Middle", destinationTrackerId: middle, minimumDays: 30 }),
          route({
            id: "tp:Middle:Target",
            sourceTrackerId: middle,
            destinationTrackerId: TARGET as string,
            sourceRegistrySlug: null,
            minimumDays: 60,
          }),
        ],
        [{ trackerId: "AlphaRatio", days: 90, text: "Gate: 90 days" }]
      ),
      desiredTrackerSlug: TARGET as string,
      trackers: [tracker("2026-01-01T00:00:00.000Z")],
      savedRankGoals: {},
      state: state(TARGET as string),
      now: NOW,
    })
    expect(result.paths[0].steps[0].evaluation.timeGate.effectiveDays).toBe(90)
    expect(result.paths[0].steps[1].evaluation.timeGate.effectiveDays).toBe(60)
    expect(result.paths[0].minimumDays).toBe(150)
    expect(result.paths[0].totalDaysRemaining).toBe(60)
  })

  it("keeps the time gate unknown when neither the route nor the source lists days", () => {
    const result = buildWishlistPaths({
      catalog: catalog([route({ minimumDays: null })]),
      desiredTrackerSlug: TARGET as string,
      trackers: [tracker("2026-01-01T00:00:00.000Z")],
      savedRankGoals: {},
      state: state(TARGET as string),
      now: NOW,
    })
    expect(result.paths[0].steps[0].evaluation.timeGate).toEqual({
      minimumDays: null,
      effectiveDays: null,
      accountAgeDays: expect.any(Number),
      daysRemaining: null,
      status: "unknown",
    })
    expect(result.paths[0].minimumDays).toBeNull()
  })

  it("excludes inactive routes from suggested paths", () => {
    const result = buildWishlistPaths({
      catalog: catalog([route({ availability: "closed" })]),
      desiredTrackerSlug: TARGET as string,
      trackers: [tracker("2026-01-01T00:00:00.000Z")],
      savedRankGoals: {},
      state: state(TARGET as string),
      now: NOW,
    })
    expect(result.paths).toEqual([])
  })

  it("rejects a malformed vendored file", () => {
    const dir = mkdtempSync(join(tmpdir(), "p30-pathways-"))
    const file = join(dir, "malformed.json")
    writeFileSync(file, JSON.stringify({ trackerInfo: {}, unlockInviteClass: {}, routeInfo: { Bad: [] } }))
    const result = spawnSync(
      process.execPath,
      ["scripts/pathways-update.mjs", "--validate-file", file],
      { cwd: process.cwd(), encoding: "utf8" }
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("routeInfo.Bad must be an object")
  })
})
