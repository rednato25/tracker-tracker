import { describe, expect, it } from "vitest"
import { RECRUITMENT_CATALOG } from "@/data/recruitment-catalog"
import { TRACKER_REGISTRY } from "@/data/tracker-registry"
import type { RankObservation, RankRequirementGroup } from "@/lib/rank-goals"
import type {
  RecruitmentCatalog,
  RecruitmentRouteOverride,
  RecruitmentRouteRecord,
  RecruitmentSourceRecord,
} from "@/lib/recruitment-routes"
import {
  evaluateRecruitmentRoute,
  findRecruitmentPaths,
  RECRUITMENT_ROUTE_FORMAT_VERSION,
  validateRecruitmentCatalog,
} from "@/lib/recruitment-routes"

const NOW = new Date("2026-10-26T12:00:00.000Z")

const SOURCE: RecruitmentSourceRecord = {
  id: "fixture",
  name: "fixture routes",
  url: "https://example.invalid/routes",
  license: "MIT",
  licenseUrl: "https://example.invalid/license",
  copyright: "Copyright fixture",
  version: "fixture-v1",
  snapshotUrl: "https://example.invalid/routes.json",
  accessedAt: "2026-10-26T00:00:00.000Z",
  attribution: "Synthetic fixture for P17 tests.",
}

function ageRequirement(days: number): RankRequirementGroup {
  return {
    mode: "all",
    conditions: [
      {
        kind: "numeric",
        id: "source-account-age",
        metric: "accountAgeDays",
        comparison: "gte",
        requiredValue: days,
        label: `Minimum ${days} days`,
      },
    ],
  }
}

function route(overrides: Partial<RecruitmentRouteRecord> = {}): RecruitmentRouteRecord {
  return {
    id: "tp:alpha:beta",
    sourceTrackerId: "alpha",
    destinationTrackerId: "beta",
    requirements: ageRequirement(180),
    requirementNotes: ["Community prose"],
    availability: "open",
    availabilityRaw: "Yes",
    sourceUpdatedAt: "2026-06",
    sourceUpdatedRaw: "Jun 2026",
    ...overrides,
  }
}

function override(overrides: Partial<RecruitmentRouteOverride> = {}): RecruitmentRouteOverride {
  return {
    routeId: "tp:alpha:beta",
    author: "Fixture Author",
    authoredAt: "2026-10-20T12:00:00.000Z",
    provenanceUrl: "https://example.invalid/route-check",
    verifiedAt: "2026-10-21T12:00:00.000Z",
    ...overrides,
  }
}

function catalog(
  routes: RecruitmentRouteRecord[],
  overrides: RecruitmentRouteOverride[] = []
): RecruitmentCatalog {
  return {
    formatVersion: RECRUITMENT_ROUTE_FORMAT_VERSION,
    source: SOURCE,
    routes,
    overrides,
  }
}

function observation(value: number | null, freshness: "fresh" | "stale" | "unknown" = "fresh"): RankObservation {
  return { value, freshness, source: "snapshot", observedAt: "2026-10-26T10:00:00.000Z" }
}

const validIds = TRACKER_REGISTRY.map((tracker) => tracker.slug)

describe("real recruitment catalog", () => {
  it("is a pinned MIT trackerpathways subset with valid registry references", () => {
    expect(RECRUITMENT_CATALOG.source.license).toBe("MIT")
    expect(RECRUITMENT_CATALOG.source.version).toBe(
      "5e3b206ed1352b56a685b90ec8da3757f702c3eb"
    )
    expect(RECRUITMENT_CATALOG.source.accessedAt).toBe("2026-10-26T00:00:00.000Z")
    expect(RECRUITMENT_CATALOG.routes.length).toBe(194)
    expect(RECRUITMENT_CATALOG.overrides).toEqual([])

    const validation = validateRecruitmentCatalog(RECRUITMENT_CATALOG, validIds)
    expect(validation.errors).toEqual([])
    expect(validation.valid).toBe(true)
  })

  it("only structures the dataset's explicit account-age days field", () => {
    for (const item of RECRUITMENT_CATALOG.routes) {
      if (!item.requirements) continue
      expect(item.requirements.mode).toBe("all")
      expect(item.requirements.conditions.length).toBe(1)
      const condition = item.requirements.conditions[0]
      expect("metric" in condition && condition.metric).toBe("accountAgeDays")
      expect("comparison" in condition && condition.comparison).toBe("gte")
    }
  })

  it("keeps free-text-only routes unknown instead of inventing thresholds", () => {
    const freeText = RECRUITMENT_CATALOG.routes.find(
      (item) => item.requirements === null && item.requirementNotes.length > 0
    )
    expect(freeText).toBeDefined()
    if (!freeText) return

    const result = evaluateRecruitmentRoute(RECRUITMENT_CATALOG, freeText.id, {
      observations: { accountAgeDays: observation(9999) },
      now: NOW,
    })
    expect(result?.eligibility.status).toBe("unknown")
    expect(result?.eligibility.structured).toBeNull()
    expect(result?.eligibility.requirementNotes.length).toBeGreaterThan(0)
  })

  it("evaluates a closed real route without equating eligibility with availability", () => {
    const closed = RECRUITMENT_CATALOG.routes.find((item) => item.availability === "closed")
    expect(closed).toBeDefined()
    if (!closed) return

    const result = evaluateRecruitmentRoute(RECRUITMENT_CATALOG, closed.id, {
      observations: { accountAgeDays: observation(5000) },
      now: NOW,
    })
    expect(result?.eligibility.status).toBe("met")
    expect(result?.availability.status).toBe("closed")
    expect(result?.availability.confirmed).toBe(false)
    expect(result?.invitation.guaranteed).toBe(false)
    expect(result?.invitation.activeRecruiter).toBe("unknown")
  })
})

describe("catalog validation", () => {
  it("reports duplicate ids, duplicate pairs and invalid tracker references", () => {
    const bad = catalog([
      route(),
      route({ id: "tp:alpha:beta", destinationTrackerId: "missing" }),
      route({ id: "tp:beta", destinationTrackerId: "beta" }),
      route({ id: "", destinationTrackerId: "gamma" }),
      route({ id: "tp:self", sourceTrackerId: "alpha", destinationTrackerId: "alpha" }),
    ])

    const validation = validateRecruitmentCatalog(bad, ["alpha", "beta", "gamma"])
    expect(validation.valid).toBe(false)
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "route has an empty id",
        "duplicate route id: tp:alpha:beta",
        "tp:alpha:beta: unknown destination tracker missing",
        "duplicate source/destination pair: alpha->beta",
        "tp:self: source and destination are the same tracker",
      ])
    )
  })

  it("rejects malformed or unattributed overrides", () => {
    const bad = catalog(
      [route()],
      [
        override({ author: " " }),
        override({ routeId: "tp:missing" }),
        override({ provenanceUrl: "" }),
        override({ authoredAt: "not-a-date" }),
      ]
    )
    const validation = validateRecruitmentCatalog(bad, ["alpha", "beta"])
    expect(validation.valid).toBe(false)
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "duplicate override for route: tp:alpha:beta",
        "override references unknown route: tp:missing",
        "override tp:alpha:beta: missing author",
        "override tp:alpha:beta: missing provenance URL",
        "override tp:alpha:beta: authoredAt is not a valid date",
      ])
    )
  })
})

describe("route eligibility", () => {
  it("keeps missing and stale observations unknown", () => {
    const item = catalog([route()])
    const missing = evaluateRecruitmentRoute(item, "tp:alpha:beta", {
      observations: {},
      now: NOW,
    })
    expect(missing?.eligibility.status).toBe("unknown")
    expect(missing?.eligibility.reason).toContain("missing, stale or unverified")

    const stale = evaluateRecruitmentRoute(item, "tp:alpha:beta", {
      observations: { accountAgeDays: observation(500, "stale") },
      now: NOW,
    })
    expect(stale?.eligibility.status).toBe("unknown")
    expect(stale?.eligibility.structured?.conditions[0]).toMatchObject({
      status: "unknown",
      freshness: "stale",
    })
  })

  it("keeps a route with no structured requirements explicitly unknown", () => {
    const item = catalog([route({ requirements: null, requirementNotes: ["Invite forum access"] })])
    const result = evaluateRecruitmentRoute(item, "tp:alpha:beta", {
      observations: { accountAgeDays: observation(999) },
      now: NOW,
    })
    expect(result?.eligibility.status).toBe("unknown")
    expect(result?.eligibility.progress).toEqual({ met: 0, unmet: 0, unknown: 0, total: 0 })
    expect(result?.eligibility.requirementNotes).toEqual(["Invite forum access"])
  })

  it("reuses ALL and ANY semantics", () => {
    const all: RankRequirementGroup = {
      mode: "all",
      conditions: [
        { kind: "numeric", metric: "accountAgeDays", comparison: "gte", requiredValue: 180 },
        { kind: "numeric", metric: "seedbonus", comparison: "gte", requiredValue: 1000 },
      ],
    }
    const any: RankRequirementGroup = { ...all, mode: "any" }
    const item = catalog([route({ requirements: all })])

    const allUnknown = evaluateRecruitmentRoute(item, "tp:alpha:beta", {
      observations: { accountAgeDays: observation(200) },
      now: NOW,
    })
    expect(allUnknown?.eligibility.status).toBe("unknown")

    const allUnmet = evaluateRecruitmentRoute(item, "tp:alpha:beta", {
      observations: { accountAgeDays: observation(200), seedbonus: observation(10) },
      now: NOW,
    })
    expect(allUnmet?.eligibility.status).toBe("unmet")

    const anyMet = evaluateRecruitmentRoute(
      catalog([route({ requirements: any })]),
      "tp:alpha:beta",
      { observations: { accountAgeDays: observation(200) }, now: NOW }
    )
    expect(anyMet?.eligibility.status).toBe("met")

    const anyUnknown = evaluateRecruitmentRoute(
      catalog([route({ requirements: any })]),
      "tp:alpha:beta",
      { observations: { accountAgeDays: observation(100) }, now: NOW }
    )
    expect(anyUnknown?.eligibility.status).toBe("unknown")
  })
})

describe("availability and evidence", () => {
  it("keeps closed availability and stale community evidence visible", () => {
    const item = catalog([
      route({
        availability: "closed",
        availabilityRaw: "No/Closed",
        sourceUpdatedAt: "2024-01",
        sourceUpdatedRaw: "Jan 2024",
      }),
    ])
    const result = evaluateRecruitmentRoute(item, "tp:alpha:beta", {
      observations: { accountAgeDays: observation(5000) },
      now: NOW,
    })

    expect(result?.eligibility.status).toBe("met")
    expect(result?.availability.status).toBe("closed")
    expect(result?.availability.confirmed).toBe(false)
    expect(result?.evidence.sourceFreshness).toBe("stale")
    expect(result?.evidence.evidenceFreshness).toBe("unknown")
    expect(result?.evidence.lastVerifiedAt).toBeNull()
    expect(result?.evidence.sourceAccessedAt).not.toBe(result?.evidence.sourceUpdatedAt)
  })

  it("keeps limited availability explicitly unknown", () => {
    const item = catalog([route({ availability: "unknown", availabilityRaw: "Limited" })])
    const result = evaluateRecruitmentRoute(item, "tp:alpha:beta", {
      observations: { accountAgeDays: observation(5000) },
      now: NOW,
    })
    expect(result?.availability.status).toBe("unknown")
    expect(result?.availability.raw).toBe("Limited")
  })

  it("applies a dated override without mutating the original source record", () => {
    const base = route({
      availability: "closed",
      availabilityRaw: "No",
      requirementNotes: ["base note"],
      requirements: ageRequirement(365),
    })
    const item = catalog(
      [base],
      [
        override({
          availability: "open",
          requirements: ageRequirement(30),
          requirementNotes: ["override note"],
          note: "Checked the public invite page.",
        }),
      ]
    )
    const result = evaluateRecruitmentRoute(item, "tp:alpha:beta", {
      observations: { accountAgeDays: observation(100) },
      now: NOW,
    })

    expect(result?.eligibility.status).toBe("met")
    expect(result?.eligibility.requirementNotes).toEqual(["override note"])
    expect(result?.eligibility.originalRequirementNotes).toEqual(["base note"])
    expect(result?.availability).toMatchObject({
      status: "open",
      confirmed: true,
      source: "local-override",
      originalStatus: "closed",
    })
    expect(result?.evidence.evidenceFreshness).toBe("fresh")
    expect(result?.evidence.lastVerifiedAt).toBe("2026-10-21T12:00:00.000Z")
    expect(result?.override).toMatchObject({
      author: "Fixture Author",
      provenanceUrl: "https://example.invalid/route-check",
      note: "Checked the public invite page.",
    })

    expect(base.availability).toBe("closed")
    expect(base.requirementNotes).toEqual(["base note"])
    expect(base.requirements?.conditions[0]).toMatchObject({ requiredValue: 365 })
  })

  it("marks an old local verification stale without claiming a recruiter", () => {
    const item = catalog(
      [route()],
      [override({ verifiedAt: "2024-01-01T00:00:00.000Z", availability: "open" })]
    )
    const result = evaluateRecruitmentRoute(item, "tp:alpha:beta", {
      observations: { accountAgeDays: observation(500) },
      now: NOW,
    })
    expect(result?.evidence.evidenceFreshness).toBe("stale")
    expect(result?.invitation).toEqual({
      guaranteed: false,
      activeRecruiter: "unknown",
      admission: "unknown",
      note: "Meeting requirements never guarantees an active recruiter, an invitation or admission.",
    })
  })
})

describe("path traversal", () => {
  it("terminates on cycles and returns bounded paths", () => {
    const routes = catalog([
      route({ id: "a-b", sourceTrackerId: "a", destinationTrackerId: "b" }),
      route({ id: "b-a", sourceTrackerId: "b", destinationTrackerId: "a" }),
      route({ id: "b-c", sourceTrackerId: "b", destinationTrackerId: "c" }),
      route({ id: "c-d", sourceTrackerId: "c", destinationTrackerId: "d" }),
    ]).routes

    expect(findRecruitmentPaths(routes, "a", "d")).toEqual([
      { routeIds: ["a-b", "b-c", "c-d"], hops: 3 },
    ])
    expect(findRecruitmentPaths(routes, "a", "a")).toEqual([])
    expect(findRecruitmentPaths(routes, "d", "a")).toEqual([])
  })

  it("respects the hop bound", () => {
    const routes = catalog([
      route({ id: "a-b", sourceTrackerId: "a", destinationTrackerId: "b" }),
      route({ id: "b-c", sourceTrackerId: "b", destinationTrackerId: "c" }),
      route({ id: "c-d", sourceTrackerId: "c", destinationTrackerId: "d" }),
    ]).routes
    expect(findRecruitmentPaths(routes, "a", "d", 2)).toEqual([])
    expect(findRecruitmentPaths(routes, "a", "c", 2)).toEqual([
      { routeIds: ["a-b", "b-c"], hops: 2 },
    ])
  })
})
