import { describe, expect, it } from "vitest"
import type { RankRequirementGroup } from "@/lib/rank-goals"
import type { RecruitmentCatalog, RecruitmentRouteRecord } from "@/lib/recruitment-routes"
import {
  evaluateRecruitmentRoute,
  RECRUITMENT_ROUTE_FORMAT_VERSION,
} from "@/lib/recruitment-routes"
import {
  emptyRecruitmentState,
  normalizeRecruitmentState,
  recruitmentPathKey,
} from "@/lib/recruitment-state"
import {
  buildWishlistPaths,
  goalLinkIsCurrent,
  upsertGoalLink,
} from "@/lib/recruitment-wishlist"
import type { TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-26T12:00:00.000Z")

const SOURCE = {
  id: "fixture",
  name: "fixture",
  url: "https://example.invalid",
  license: "MIT",
  licenseUrl: "https://example.invalid/license",
  copyright: "fixture",
  version: "fixture-v1",
  snapshotUrl: "https://example.invalid/routes.json",
  accessedAt: "2026-10-26T00:00:00.000Z",
  attribution: "Fixture routes.",
}

function ageRequirement(days: number): RankRequirementGroup {
  return {
    mode: "all",
    conditions: [
      {
        kind: "numeric",
        id: "source-age",
        metric: "accountAgeDays",
        comparison: "gte",
        requiredValue: days,
        label: "Minimum source account age",
      },
    ],
  }
}

function ratioRequirement(ratio: number): RankRequirementGroup {
  return {
    mode: "all",
    conditions: [
      {
        kind: "numeric",
        id: "source-ratio",
        metric: "accountRatio",
        comparison: "gte",
        requiredValue: ratio,
        label: "Minimum ratio",
      },
    ],
  }
}

function route(overrides: Partial<RecruitmentRouteRecord> = {}): RecruitmentRouteRecord {
  return {
    id: "tp:AlphaRatio:BroadcasTheNet",
    sourceTrackerId: "AlphaRatio",
    destinationTrackerId: "BroadcasTheNet",
    sourceRegistrySlug: "alpharatio",
    destinationRegistrySlug: "broadcasthenet",
    requirements: ageRequirement(30),
    requirementNotes: [],
    minimumDays: null,
    availability: "open",
    availabilityRaw: "Yes",
    sourceUpdatedAt: "2026-09",
    sourceUpdatedRaw: "Sep 2026",
    ...overrides,
  }
}

function catalog(
  routes: RecruitmentRouteRecord[],
  sourceGates: RecruitmentCatalog["sourceGates"] = []
): RecruitmentCatalog {
  return {
    formatVersion: RECRUITMENT_ROUTE_FORMAT_VERSION,
    source: SOURCE,
    routes,
    sourceGates,
    overrides: [],
  }
}

function tracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "Owned Alpha",
    baseUrl: "https://alpha.invalid",
    registrySlug: "alpharatio",
    platformType: "unit3d",
    isActive: true,
    lastPolledAt: "2026-10-26T10:00:00.000Z",
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
    joinedAt: "2026-09-01T00:00:00.000Z",
    lastAccessAt: null,
    remoteUserId: null,
    platformMeta: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    latestStats: {
      ratio: 2.5,
      ratioIsInfinite: false,
      uploadedBytes: "1000000000",
      downloadedBytes: "400000000",
      bufferBytes: "600000000",
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
    },
    ...overrides,
  }
}

function stateFor(desiredTrackerSlug: string | null, hiddenPathKeys: string[] = []) {
  return {
    ...emptyRecruitmentState(),
    desiredTrackerSlug,
    hiddenPathKeys,
  }
}

describe("buildWishlistPaths", () => {
  it("shows direct and bounded multi-step routes, evaluating owned steps only", () => {
    const item = catalog([
      route(),
      route({ id: "tp:AlphaRatio:Aither", destinationTrackerId: "Aither" }),
      route({
        id: "tp:Aither:BroadcasTheNet",
        sourceTrackerId: "Aither",
        destinationTrackerId: "BroadcasTheNet",
      }),
    ])
    const result = buildWishlistPaths({
      catalog: item,
      desiredTrackerSlug: "BroadcasTheNet",
      trackers: [tracker()],
      savedRankGoals: {},
      state: stateFor("broadcasthenet"),
      now: NOW,
    })

    expect(result.paths).toHaveLength(2)
    const direct = result.paths.find((path) => path.routeIds.length === 1)
    const multi = result.paths.find((path) => path.routeIds.length === 2)
    expect(direct?.status).toBe("known-met")
    expect(direct?.steps[0].scenario).toBe(false)
    expect(multi?.status).toBe("needs-verification")
    expect(multi?.steps[0].scenario).toBe(false)
    expect(multi?.steps[1].scenario).toBe(true)
    expect(multi?.steps[1].observationNote).toContain("Scenario only")
  })

  it("keeps cycles finite and deduplicates path keys", () => {
    const item = catalog([
      route(),
      route({
        id: "tp:BroadcasTheNet:AlphaRatio",
        sourceTrackerId: "BroadcasTheNet",
        destinationTrackerId: "AlphaRatio",
      }),
    ])
    const result = buildWishlistPaths({
      catalog: item,
      desiredTrackerSlug: "BroadcasTheNet",
      trackers: [tracker()],
      savedRankGoals: {},
      state: stateFor("broadcasthenet"),
      now: NOW,
    })
    expect(result.paths.map((path) => path.key)).toEqual(["tp:AlphaRatio:BroadcasTheNet"])
  })

  it("excludes closed routes from suggested paths but keeps the step closed", () => {
    const item = catalog([route({ availability: "closed", availabilityRaw: "No" })])
    const result = buildWishlistPaths({
      catalog: item,
      desiredTrackerSlug: "BroadcasTheNet",
      trackers: [tracker()],
      savedRankGoals: {},
      state: stateFor("BroadcasTheNet"),
      now: NOW,
    })
    expect(result.paths).toEqual([])
    const evaluation = evaluateRecruitmentRoute(item, "tp:AlphaRatio:BroadcasTheNet", {
      observations: {},
      now: NOW,
    })
    expect(evaluation?.availability.status).toBe("closed")
  })

  it("shows every source gate and minimum time per trackerpathways", () => {
    const item = catalog(
      [route({ minimumDays: 365 })],
      [{ trackerId: "AlphaRatio", days: 30, text: "Sphinx: 26 weeks, 3.2TB upload" }]
    )
    const result = buildWishlistPaths({
      catalog: item,
      desiredTrackerSlug: "BroadcasTheNet",
      trackers: [tracker()],
      savedRankGoals: {},
      state: stateFor("BroadcasTheNet"),
      now: NOW,
    })
    expect(result.paths[0].steps[0].evaluation.eligibility.sourceRequirements.inviteGate?.text).toContain(
      "Sphinx"
    )
    expect(result.paths[0].steps[0].evaluation.timeGate.effectiveDays).toBe(365)
    expect(result.paths[0].minimumDays).toBe(365)
  })

  it("marks stale or missing observations as needing verification", () => {
    const item = catalog([
      route({ requirements: ratioRequirement(1.5) }),
    ])
    const stale = buildWishlistPaths({
      catalog: item,
      desiredTrackerSlug: "BroadcasTheNet",
      trackers: [
        tracker({
          lastPolledAt: "2026-10-20T10:00:00.000Z",
          latestStats: { ...(tracker().latestStats ?? {}), ratio: 3 } as TrackerSummary["latestStats"],
        }),
      ],
      savedRankGoals: {},
      state: stateFor("broadcasthenet"),
      now: NOW,
    })
    expect(stale.paths[0].status).toBe("needs-verification")
    expect(stale.paths[0].steps[0].evaluation.eligibility.status).toBe("unknown")

    const missing = buildWishlistPaths({
      catalog: item,
      desiredTrackerSlug: "BroadcasTheNet",
      trackers: [tracker({ latestStats: null })],
      savedRankGoals: {},
      state: stateFor("broadcasthenet"),
      now: NOW,
    })
    expect(missing.paths[0].status).toBe("needs-verification")
    expect(missing.paths[0].steps[0].observationNote).toContain("No stored stats")
  })

  it("distinguishes unsupported coverage, owned destinations, no accounts and hidden paths", () => {
    const item = catalog([route()])
    const unsupported = buildWishlistPaths({
      catalog: item,
      desiredTrackerSlug: "zenith",
      trackers: [tracker()],
      savedRankGoals: {},
      state: stateFor("zenith"),
      now: NOW,
    })
    expect(unsupported.catalogHasDesired).toBe(false)
    expect(unsupported.paths).toEqual([])

    const owned = buildWishlistPaths({
      catalog: item,
      desiredTrackerSlug: "AlphaRatio",
      trackers: [tracker()],
      savedRankGoals: {},
      state: stateFor("alpharatio"),
      now: NOW,
    })
    expect(owned.desiredOwned).toBe(true)

    const noAccounts = buildWishlistPaths({
      catalog: item,
      desiredTrackerSlug: "BroadcasTheNet",
      trackers: [],
      savedRankGoals: {},
      state: stateFor("broadcasthenet"),
      now: NOW,
    })
    expect(noAccounts.ownedSlugs).toEqual([])

    const hidden = buildWishlistPaths({
      catalog: item,
      desiredTrackerSlug: "BroadcasTheNet",
      trackers: [tracker()],
      savedRankGoals: {},
      state: stateFor("BroadcasTheNet", ["tp:AlphaRatio:BroadcasTheNet"]),
      now: NOW,
    })
    expect(hidden.paths[0].hidden).toBe(true)
  })

  it("bounds the total and marks truncation", () => {
    const item = catalog([
      route(),
      route({ id: "tp:AlphaRatio:Aither", destinationTrackerId: "Aither" }),
      route({
        id: "tp:Aither:BroadcasTheNet",
        sourceTrackerId: "Aither",
        destinationTrackerId: "BroadcasTheNet",
      }),
    ])
    const result = buildWishlistPaths({
      catalog: item,
      desiredTrackerSlug: "BroadcasTheNet",
      trackers: [tracker()],
      savedRankGoals: {},
      state: stateFor("broadcasthenet"),
      now: NOW,
      maxTotal: 1,
    })
    expect(result.paths).toHaveLength(1)
    expect(result.truncated).toBe(true)
  })
})

describe("goal links", () => {
  it("offers a link only when the exact structured condition exists in a saved goal", () => {
    const item = catalog([
      route({
        id: "tp:TorrentLeech:BroadcasTheNet",
        sourceTrackerId: "TorrentLeech",
        destinationTrackerId: "BroadcasTheNet",
        requirements: ageRequirement(14),
      }),
    ])
    const result = buildWishlistPaths({
      catalog: item,
      desiredTrackerSlug: "BroadcasTheNet",
      trackers: [tracker({ registrySlug: "torrentleech" })],
      savedRankGoals: { "1": { targetRank: "Power User" } },
      state: stateFor("broadcasthenet"),
      now: NOW,
    })
    const candidate = result.paths[0].steps[0].goalCandidates[0]
    expect(candidate).toMatchObject({
      routeId: "tp:TorrentLeech:BroadcasTheNet",
      conditionId: "source-age",
      goalTrackerSlug: "torrentleech",
      targetRank: "Power User",
      metric: "accountAgeDays",
      comparison: "gte",
      requiredValue: 14,
    })

    const state = normalizeRecruitmentState({
      desiredTrackerSlug: "BroadcasTheNet",
      goalLinks: [candidate],
    })
    expect(state.goalLinks).toHaveLength(1)
    expect(goalLinkIsCurrent(state.goalLinks[0], candidate)).toBe(true)
    const updated = upsertGoalLink(state.goalLinks, { ...candidate, targetRank: "Super User" })
    expect(updated).toHaveLength(1)
    expect(updated[0].targetRank).toBe("Super User")
  })

  it("does not offer a link for a different threshold", () => {
    const item = catalog([
      route({
        id: "tp:TorrentLeech:BroadcasTheNet",
        sourceTrackerId: "TorrentLeech",
        destinationTrackerId: "BroadcasTheNet",
        requirements: ageRequirement(30),
      }),
    ])
    const result = buildWishlistPaths({
      catalog: item,
      desiredTrackerSlug: "BroadcasTheNet",
      trackers: [tracker({ registrySlug: "torrentleech" })],
      savedRankGoals: { "1": { targetRank: "Power User" } },
      state: stateFor("broadcasthenet"),
      now: NOW,
    })
    expect(result.paths[0].steps[0].goalCandidates).toEqual([])
  })
})

describe("path keys", () => {
  it("uses route ids in order", () => {
    expect(recruitmentPathKey(["a", "b"])).toBe("a>b")
  })
})
