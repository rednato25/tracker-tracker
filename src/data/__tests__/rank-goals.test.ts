import { describe, expect, it } from "vitest"
import { getTrackerBySlug, type TrackerRegistryEntry } from "@/data/tracker-registry"
import {
  evaluateRankGoal,
  type RankObservationMap,
  rankDefinitionFor,
  rankDefinitionForSlug,
} from "@/lib/rank-goals"

const GiB = 1024 ** 3
const NOW = new Date("2026-10-25T12:00:00.000Z")
const torrentleech = getTrackerBySlug("torrentleech")
const pilot = rankDefinitionFor(torrentleech)
if (!pilot) throw new Error("TorrentLeech registry rank definition missing")
const goals = pilot.goals

function observations(
  overrides: Partial<Record<keyof RankObservationMap, number | null>> = {}
): RankObservationMap {
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
    userClasses: torrentleech?.userClasses ?? [],
    currentRank: "Registered",
    observations: observations(),
    now: NOW,
    joinedAt: "2026-10-10T12:00:00.000Z",
    structuredGoals: goals,
    ...overrides,
  })
}

describe("registry-backed TorrentLeech rank requirements", () => {
  it("keeps the ladder result but evaluates the conservative upload unit", () => {
    const result = goal()
    expect(result.nextRank).toBe("Power User")
    expect(result.status).toBe("met")
    expect(result.progress).toEqual({ met: 3, unmet: 0, unknown: 0, total: 3 })
    expect(result.eligible).toBe(true)
    expect(result.freeTextRequirement).toContain("200 GB")
    expect(result.promotionApplied).toBe(false)
    const uploadCondition = result.structuredRequirement?.conditions[1]
    expect(uploadCondition).toMatchObject({
      status: "met",
      requiredValue: 200 * GiB,
      unitReading: "conservative",
    })
  })

  it("keeps missing transfer unknown and stale ratio unknown", () => {
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

  it("keeps a text-only class unsupported", () => {
    const textOnly: TrackerRegistryEntry = {
      ...(torrentleech as TrackerRegistryEntry),
      rankRequirementsSource: undefined,
      rankProgression: undefined,
      userClasses: [{ name: "User", requirements: "Text only" }],
    }
    expect(rankDefinitionFor(textOnly)).toBeNull()
  })

  it("structures the clear MAM and REDacted prose", () => {
    const mam = rankDefinitionForSlug("myanonamouse")
    const red = rankDefinitionForSlug("redacted")
    expect(mam?.goals["Power User"]).toBeDefined()
    expect(mam?.goals["Power User"]?.conditions.some((c) => "unitReading" in c)).toBe(true)
    expect(red?.goals["Member"]).toBeDefined()
    expect(red?.goals["Torrent Master"]).toBeDefined()
  })
})
