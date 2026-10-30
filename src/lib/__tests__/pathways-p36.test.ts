import { describe, expect, it } from "vitest"
import type { RankRequirementGroup } from "@/lib/rank-goals"
import type { RecruitmentCatalog, RecruitmentRouteRecord } from "@/lib/recruitment-routes"
import { RECRUITMENT_ROUTE_FORMAT_VERSION } from "@/lib/recruitment-routes"
import { emptyRecruitmentState } from "@/lib/recruitment-state"
import {
  buildWishlistPaths,
  pathWaitLabel,
  stepHasUncheckedRequirements,
  stepRequirementText,
  stepWaitLabel,
  stepWaitState,
  stepWaitStatus,
} from "@/lib/recruitment-wishlist"
import type { TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-30T12:00:00.000Z")
const RECENT_JOIN = new Date(NOW.getTime() - 100 * 86_400_000).toISOString()
const JUST_JOINED = NOW.toISOString()

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

function route(overrides: Partial<RecruitmentRouteRecord> = {}): RecruitmentRouteRecord {
  return {
    id: "tp:AlphaRatio:BroadcasTheNet",
    sourceTrackerId: "AlphaRatio",
    destinationTrackerId: "BroadcasTheNet",
    sourceRegistrySlug: "alpharatio",
    destinationRegistrySlug: "broadcasthenet",
    requirements: null,
    requirementNotes: [],
    minimumDays: 0,
    availability: "open",
    availabilityRaw: "Yes",
    sourceUpdatedAt: "2026-09",
    sourceUpdatedRaw: "Sep 2026",
    ...overrides,
  }
}

function tracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "Owned Alpha",
    registrySlug: "alpharatio",
    joinedAt: RECENT_JOIN,
    lastPolledAt: "2026-10-30T11:00:00.000Z",
    latestStats: {
      ratio: 1,
      ratioIsInfinite: false,
      uploadedBytes: "1000",
      downloadedBytes: "1000",
      bufferBytes: "0",
      seedingCount: 1,
      leechingCount: 0,
      requiredRatio: 1,
      warned: false,
      freeleechTokens: 0,
      hitAndRuns: 0,
      seedbonus: 0,
      shareScore: null,
      username: "owner",
      group: "User",
    },
    ...overrides,
  } as TrackerSummary
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

function pathFor(
  options: {
    routes?: RecruitmentRouteRecord[]
    sourceGates?: RecruitmentCatalog["sourceGates"]
    joinedAt?: string
    latestStats?: TrackerSummary["latestStats"]
  } = {}
) {
  const desired = "BroadcasTheNet"
  return buildWishlistPaths({
    catalog: catalog(options.routes ?? [route()], options.sourceGates),
    desiredTrackerSlug: desired,
    trackers: [tracker({ joinedAt: options.joinedAt ?? RECENT_JOIN, latestStats: options.latestStats })],
    savedRankGoals: {},
    state: { ...emptyRecruitmentState(), desiredTrackerSlug: desired },
    now: NOW,
  }).paths[0]
}

describe("P36 wait and requirement labels", () => {
  it("is Ready now only when the wait is met and there is no requirement text", () => {
    const path = pathFor({ routes: [route()] })
    expect(path).toBeDefined()
    expect(stepWaitState(path.steps[0])).toBe("ready")
    expect(stepWaitStatus(path.steps[0])).toBe("Ready now")
    expect(stepWaitLabel(path.steps[0])).toBe("Ready now")
    expect(pathWaitLabel(path)).toBe("Ready now")
    expect(stepHasUncheckedRequirements(path.steps[0])).toBe(false)
  })

  it("treats a no-requirement note as no other requirement", () => {
    const path = pathFor({ routes: [route({ requirementNotes: ["none"] })] })
    expect(stepRequirementText(path.steps[0])).toBeNull()
    expect(stepWaitLabel(path.steps[0])).toBe("Ready now")
  })

  it("shows Wait done plus the requirement when the wait is met but text remains", () => {
    const path = pathFor({ routes: [route({ requirementNotes: ["3TB upload"] })] })
    expect(stepWaitState(path.steps[0])).toBe("wait-done")
    expect(stepWaitStatus(path.steps[0])).toBe("Wait done")
    expect(stepWaitLabel(path.steps[0])).toBe("Wait done, needs 3TB upload")
    expect(pathWaitLabel(path)).toBe("Wait done, needs 3TB upload")
  })

  it("keeps the days left and the requirement together while waiting", () => {
    const path = pathFor({
      routes: [route({ minimumDays: 30, requirementNotes: ["3TB upload"] })],
      joinedAt: JUST_JOINED,
    })
    expect(stepWaitState(path.steps[0])).toBe("waiting")
    expect(stepWaitLabel(path.steps[0])).toBe("30 days left · needs 3TB upload")
    expect(pathWaitLabel(path)).toBe("30 days left · needs checking")
  })

  it("uses the source invite class when the route has no prose", () => {
    const path = pathFor({
      sourceGates: [
        { trackerId: "AlphaRatio", days: 0, text: "Sphinx: 26 weeks, 3.2TB upload" },
      ],
    })
    expect(stepRequirementText(path.steps[0])).toBe("Sphinx")
    expect(stepWaitLabel(path.steps[0])).toBe("Wait done, needs Sphinx")
    expect(pathWaitLabel(path)).toBe("Wait done, needs Sphinx")
  })

  it("marks an unmet structured requirement as needing checking, not Ready now", () => {
    const ratio: RankRequirementGroup = {
      mode: "all",
      conditions: [
        {
          kind: "numeric",
          id: "route-ratio",
          metric: "accountRatio",
          comparison: "gte",
          requiredValue: 3,
          label: "Ratio at least 3",
        },
      ],
    }
    const path = pathFor({
      routes: [route({ requirements: ratio })],
      latestStats: { ...(tracker().latestStats as NonNullable<TrackerSummary["latestStats"]>), ratio: 1 },
    })
    expect(stepWaitState(path.steps[0])).toBe("wait-done")
    expect(stepWaitLabel(path.steps[0])).toBe("Wait done, needs checking")
  })

  it("says the total needs checking when any step has unchecked requirements", () => {
    const middle = "Middle"
    const path = pathFor({
      routes: [
        route({ id: "tp:AlphaRatio:Middle", destinationTrackerId: middle }),
        route({
          id: `tp:Middle:BroadcasTheNet`,
          sourceTrackerId: middle,
          destinationTrackerId: "BroadcasTheNet",
          requirementNotes: ["3TB upload"],
        }),
      ],
    })
    expect(path.steps).toHaveLength(2)
    expect(pathWaitLabel(path)).toBe("Wait done · needs checking")
  })
})
