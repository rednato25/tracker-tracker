import { describe, expect, it } from "vitest"
import { PILOT_RANK_DEFINITIONS } from "@/data/rank-goals"
import { torrentleech } from "@/data/trackers/torrentleech"
import { evaluateRankGoal, type RankObservationMap } from "@/lib/rank-goals"

const GiB = 1024 ** 3
const NOW = new Date("2026-10-25T12:00:00.000Z")
const pilot = PILOT_RANK_DEFINITIONS["torrentleech"]
if (!pilot) throw new Error("TorrentLeech pilot missing")
const goals = pilot.goals

function observations(overrides: Partial<Record<keyof RankObservationMap, number | null>> = {}): RankObservationMap {
  const base: RankObservationMap = {
    accountRatio: { value: 1.2, freshness: "fresh", source: "api", observedAt: NOW.toISOString() },
    uploadedBytes: { value: 250 * GiB, freshness: "fresh", source: "api", observedAt: NOW.toISOString() },
  }
  for (const [key, value] of Object.entries(overrides)) {
    base[key as keyof RankObservationMap] = {
      value: value as number | null,
      freshness: "fresh",
      source: "api",
      observedAt: NOW.toISOString(),
    }
  }
  return base
}

function goal(overrides: Partial<Parameters<typeof evaluateRankGoal>[0]> = {}) {
  return evaluateRankGoal({
    userClasses: torrentleech.userClasses,
    currentRank: "Registered",
    observations: observations(),
    now: NOW,
    joinedAt: "2026-10-10T12:00:00.000Z",
    structuredGoals: goals,
    ...overrides,
  })
}

describe("P10 TorrentLeech pilot", () => {
  it("encodes the published AND conditions with exact boundary semantics", () => {
    const result = goal()
    expect(result.nextRank).toBe("Power User")
    expect(result.status).toBe("met")
    expect(result.progress).toEqual({ met: 3, unmet: 0, unknown: 0, total: 3 })
    expect(result.freeTextRequirement).toContain("200 GB")
    expect(result.promotionApplied).toBe(false)

    const exactBoundaries = goal({
      joinedAt: "2026-10-11T12:00:00.000Z",
      observations: observations({
        accountRatio: 1.1,
        uploadedBytes: 200 * GiB,
      }),
    })
    expect(exactBoundaries.status).toBe("unmet")
    expect(exactBoundaries.structuredRequirement?.conditions[1]).toMatchObject({
      status: "unmet",
      requiredValue: 200 * GiB,
    })
  })

  it("keeps a missing transfer amount unknown and stale ratio unknown", () => {
    const missing = goal({ observations: observations({ accountRatio: 1.2, uploadedBytes: null }) })
    expect(missing.status).toBe("unknown")
    const stale = goal({
      observations: {
        accountRatio: {
          value: 5,
          freshness: "stale",
          source: "snapshot",
          observedAt: "2026-10-01T00:00:00.000Z",
        },
        uploadedBytes: { value: 250 * GiB, freshness: "fresh", source: "api" },
      },
    })
    expect(stale.status).toBe("unknown")
    expect(stale.structuredRequirement?.conditions[2]).toMatchObject({
      status: "unknown",
      freshness: "stale",
      observedValue: 5,
    })
  })

  it("records source consultation separately from the page edit date", () => {
    expect(pilot.source.accessedAt).toBe("2026-10-25")
    expect(pilot.source.sourceLastModified).toBe("2021-09-03")
    expect(pilot.source.accessedAt).not.toBe(pilot.source.sourceLastModified)
    expect(pilot.source.verification).toBe("published")
  })

  it("does not promote an appointed VIP or invent a manual goal", () => {
    const vip = goal({ currentRank: "VIP" })
    expect(vip.status).toBe("appointed")
    expect(vip.nextRank).toBeNull()
    expect(vip.promotionApplied).toBe(false)
  })
})

describe("P10 unresolved pilots", () => {
  it("keeps MyAnonaMouse and REDacted free text without structured thresholds", () => {
    for (const slug of ["myanonamouse", "redacted"]) {
      const definition = PILOT_RANK_DEFINITIONS[slug]
      expect(definition).toBeDefined()
      expect(definition.source.verification).toBe("unresolved")
      expect(definition.goals).toEqual({})
      expect(definition.unresolved.length).toBeGreaterThan(0)
      expect(definition.source.accessedAt).toBeNull()
    }
  })

  it("does not return structured eligibility for an unresolved pilot", () => {
    const definition = PILOT_RANK_DEFINITIONS.myanonamouse
    const result = evaluateRankGoal({
      userClasses: [
        { name: "User", requirements: "Existing registry text" },
        { name: "Power User", requirements: "Existing registry text" },
      ],
      currentRank: "User",
      observations: observations(),
      now: NOW,
      structuredGoals: definition.goals,
    })
    expect(result.nextRank).toBe("Power User")
    expect(result.status).toBe("no-structured-goal")
    expect(result.eligible).toBe(false)
    expect(result.freeTextRequirement).toBe("Existing registry text")
  })
})
