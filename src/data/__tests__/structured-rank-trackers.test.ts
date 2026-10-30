import { describe, expect, it } from "vitest"
import { getTrackerBySlug } from "@/data/tracker-registry"
import {
  evaluateRequirementGroup,
  rankDefinitionForSlug,
  type RankGoalInput,
  type RankGroupResult,
  type RankObservationMap,
} from "@/lib/rank-goals"

const NOW = new Date("2026-10-30T12:00:00.000Z")
const GiB = 1024 ** 3
const TiB = 1024 ** 4

type Values = Partial<Record<keyof RankObservationMap, number>>

function observations(values: Values): RankObservationMap {
  return Object.fromEntries(
    Object.entries(values).map(([metric, value]) => [
      metric,
      {
        value,
        freshness: "fresh" as const,
        source: "api" as const,
        observedAt: NOW.toISOString(),
      },
    ])
  ) as RankObservationMap
}

function inputFor(slug: string, values: Values): RankGoalInput {
  const entry = getTrackerBySlug(slug)
  if (!entry) throw new Error(`registry entry missing for ${slug}`)
  return {
    userClasses: entry.userClasses,
    rankPaths: entry.rankPaths,
    currentRank: null,
    observations: observations(values),
    now: NOW,
    joinedAt: null,
    structuredGoals: rankDefinitionForSlug(slug)?.goals ?? {},
  }
}

function evaluate(slug: string, target: string, values: Values): RankGroupResult {
  const input = inputFor(slug, values)
  const goal = input.structuredGoals?.[target]
  if (!goal) throw new Error(`${slug} has no structured goal for ${target}`)
  return evaluateRequirementGroup(goal, input, target)
}

describe("P35 structured rank requirements", () => {
  it("MyAnonaMouse: Power User meets the published age, upload and ratio thresholds", () => {
    const result = evaluate("myanonamouse", "Power User", {
      accountAgeDays: 28,
      uploadedBytes: 25 * GiB,
      accountRatio: 2,
    })
    expect(result.status).toBe("met")
  })

  it("OnlyEncodes: Explorer meets numeric thresholds and seed-size classes stay unknown", () => {
    const explorer = evaluate("onlyencodes", "Explorer", {
      accountAgeDays: 30,
      uploadedBytes: 1 * TiB,
      accountRatio: 0.4,
    })
    expect(explorer.status).toBe("met")

    const trailblazer = evaluate("onlyencodes", "Trailblazer", {
      accountAgeDays: 60,
      uploadedBytes: 5 * TiB,
      accountRatio: 0.4,
    })
    expect(trailblazer.status).toBe("unknown")
    expect(trailblazer.progress).toEqual({ met: 3, unmet: 0, unknown: 1, total: 4 })
  })

  it("RetroToon World: Toon Hero meets the FAQ thresholds and Toon Legend needs more upload", () => {
    const hero = evaluate("retrotoon", "Toon Hero", {
      accountAgeDays: 60,
      uploadedBytes: 50 * GiB,
      accountRatio: 1.05,
    })
    expect(hero.status).toBe("met")

    const legend = evaluate("retrotoon", "Toon Legend", {
      accountAgeDays: 180,
      uploadedBytes: 50 * GiB,
      accountRatio: 2.05,
    })
    expect(legend.status).toBe("unmet")
  })

  it("Upload.cx: Member meets numeric thresholds and Master needs seed checks", () => {
    const member = evaluate("uploadcx", "Member", {
      accountAgeDays: 14,
      uploadedBytes: 1 * TiB,
      accountRatio: 0.6,
    })
    expect(member.status).toBe("met")

    const master = evaluate("uploadcx", "Master", {
      accountAgeDays: 120,
      uploadedBytes: 50 * TiB,
      accountRatio: 1.1,
    })
    expect(master.status).toBe("unknown")
    expect(master.progress).toEqual({ met: 3, unmet: 0, unknown: 2, total: 5 })
  })
})
