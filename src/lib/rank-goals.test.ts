import { describe, expect, it } from "vitest"
import type { TrackerUserClass } from "@/data/tracker-registry"
import {
  evaluatePersonalGoals,
  evaluateRankGoal,
  evaluateRequirementGroup,
  type RankGoalInput,
  type RankObservationMap,
  type RankRequirementGroup,
} from "@/lib/rank-goals"

const NOW = new Date("2026-10-24T12:00:00.000Z")

const classes: TrackerUserClass[] = [
  { name: "User", requirements: "Entry class" },
  { name: "Power User", requirements: "Upload 1 GiB and keep ratio above 1.0" },
  { name: "Elite", requirements: "Staff review plus 1 TiB uploaded" },
]

function obs(
  values: Partial<Record<keyof RankObservationMap, number | null>>,
  freshness: "fresh" | "stale" = "fresh"
): RankObservationMap {
  const out: RankObservationMap = {}
  for (const [key, value] of Object.entries(values)) {
    out[key as keyof RankObservationMap] = {
      value: value as number | null,
      freshness,
      source: "api",
      observedAt: "2026-10-24T11:00:00.000Z",
    }
  }
  return out
}

function input(overrides: Partial<RankGoalInput> = {}): RankGoalInput {
  return {
    userClasses: classes,
    currentRank: "User",
    observations: obs({ accountRatio: 2, uploadedBytes: 2_000 }),
    now: NOW,
    structuredGoals: {
      "Power User": {
        mode: "all",
        conditions: [
          { kind: "numeric", metric: "accountRatio", comparison: "gte", requiredValue: 1 },
          { kind: "numeric", metric: "uploadedBytes", comparison: "gte", requiredValue: 1000 },
        ],
      },
      Elite: {
        mode: "all",
        conditions: [
          { kind: "manual", label: "Staff approval" },
          { kind: "numeric", metric: "uploadedBytes", comparison: "gte", requiredValue: 1000 },
        ],
      },
    },
    ...overrides,
  }
}

describe("evaluateRankGoal", () => {
  it("uses the existing ladder for current and next rank and never promotes", () => {
    const result = evaluateRankGoal(input())
    expect(result.currentRank).toBe("User")
    expect(result.nextRank).toBe("Power User")
    expect(result.status).toBe("met")
    expect(result.eligible).toBe(true)
    expect(result.promotionApplied).toBe(false)
    expect(result.freeTextRequirement).toContain("Upload 1 GiB")
    expect(result.progress).toEqual({ met: 2, unmet: 0, unknown: 0, total: 2 })
  })

  it("reports one unmet condition without changing the observed rank", () => {
    const result = evaluateRankGoal(
      input({ observations: obs({ accountRatio: 0.99, uploadedBytes: 2000 }) })
    )
    expect(result.status).toBe("unmet")
    expect(result.eligible).toBe(false)
    expect(result.currentRank).toBe("User")
    expect(result.progress).toEqual({ met: 1, unmet: 1, unknown: 0, total: 2 })
    expect(result.structuredRequirement?.conditions[0]).toMatchObject({
      requiredValue: 1,
      observedValue: 0.99,
      status: "unmet",
    })
  })

  it("keeps an unknown condition unknown, and ALL prefers a known false", () => {
    const allUnknown = evaluateRankGoal(input({ observations: obs({ uploadedBytes: 2000 }) }))
    expect(allUnknown.status).toBe("unknown")
    expect(allUnknown.eligible).toBe(false)

    const group: RankRequirementGroup = {
      mode: "all",
      conditions: [
        { kind: "numeric", metric: "accountRatio", comparison: "gte", requiredValue: 1 },
        { kind: "manual", label: "Staff approval" },
      ],
    }
    const unknownWithUnmet = evaluateRequirementGroup(
      group,
      input({ observations: obs({ accountRatio: 0.5 }) })
    )
    expect(unknownWithUnmet.status).toBe("unmet")

    const anyGroup: RankRequirementGroup = {
      mode: "any",
      conditions: [
        { kind: "numeric", metric: "accountRatio", comparison: "gte", requiredValue: 1 },
        { kind: "manual", label: "Staff approval" },
      ],
    }
    expect(evaluateRequirementGroup(anyGroup, input()).status).toBe("met")
  })

  it("supports ANY with unknown values and nested groups", () => {
    const group: RankRequirementGroup = {
      mode: "any",
      conditions: [
        {
          mode: "all",
          conditions: [
            { kind: "numeric", metric: "accountRatio", comparison: "gte", requiredValue: 3 },
            { kind: "manual", label: "Staff approval" },
          ],
        },
        { kind: "numeric", metric: "uploadedBytes", comparison: "gte", requiredValue: 1000 },
        { kind: "numeric", metric: "seedbonus", comparison: "gte", requiredValue: 1 },
      ],
    }
    const result = evaluateRequirementGroup(group, input())
    expect(result.status).toBe("met")
    expect(result.progress.total).toBe(4)
  })

  it("distinguishes a confirmed zero from a missing value", () => {
    const zero = evaluateRankGoal(
      input({ observations: obs({ accountRatio: 2, uploadedBytes: 0 }) })
    )
    expect(zero.status).toBe("unmet")
    const missing = evaluateRankGoal(input({ observations: obs({ accountRatio: 2 }) }))
    expect(missing.status).toBe("unknown")
    expect(missing.structuredRequirement?.conditions[1]).toMatchObject({
      observedValue: null,
      status: "unknown",
    })
  })

  it("uses the injected clock for account-age boundaries", () => {
    const goal: RankRequirementGroup = {
      mode: "all",
      conditions: [
        { kind: "numeric", metric: "accountAgeDays", comparison: "gte", requiredValue: 30 },
      ],
    }
    const boundary = evaluateRankGoal(
      input({
        joinedAt: "2026-09-24T12:00:00.000Z",
        observations: {},
        structuredGoals: { "Power User": goal },
      })
    )
    expect(boundary.status).toBe("met")
    const future = evaluateRankGoal(
      input({
        joinedAt: "2026-10-25T12:00:00.000Z",
        observations: {},
        structuredGoals: { "Power User": goal },
      })
    )
    expect(future.status).toBe("unmet")
    expect(future.structuredRequirement?.conditions[0]).toMatchObject({ observedValue: 0 })
  })

  it("treats stale observations as unknown and keeps the observed value visible", () => {
    const goal: RankRequirementGroup = {
      mode: "all",
      conditions: [
        { kind: "numeric", metric: "accountRatio", comparison: "gte", requiredValue: 1 },
      ],
    }
    const result = evaluateRankGoal(
      input({
        observations: obs({ accountRatio: 5 }, "stale"),
        structuredGoals: { "Power User": goal },
      })
    )
    expect(result.status).toBe("unknown")
    expect(result.structuredRequirement?.conditions[0]).toMatchObject({
      observedValue: 5,
      status: "unknown",
      freshness: "stale",
    })
  })

  it("does not infer structured thresholds from free text or apply promotion", () => {
    const result = evaluateRankGoal(input({ structuredGoals: {} }))
    expect(result.status).toBe("no-structured-goal")
    expect(result.freeTextRequirement).toContain("Upload 1 GiB")
    expect(result.progress).toEqual({ met: 0, unmet: 0, unknown: 0, total: 0 })
    expect(result.eligible).toBe(false)
    expect(result.promotionApplied).toBe(false)
  })

  it("keeps per-torrent requirements separate from account ratio", () => {
    const goal: RankRequirementGroup = {
      mode: "all",
      conditions: [
        {
          kind: "numeric",
          metric: "accountRatio",
          comparison: "gte",
          requiredValue: 1,
          scope: "per-torrent",
        },
        { kind: "numeric", metric: "accountRatio", comparison: "gte", requiredValue: 1 },
      ],
    }
    const result = evaluateRankGoal(
      input({ observations: obs({ accountRatio: 2 }), structuredGoals: { "Power User": goal } })
    )
    expect(result.structuredRequirement?.conditions[0]).toMatchObject({ status: "unknown" })
    expect(result.structuredRequirement?.conditions[1]).toMatchObject({ status: "met" })
    expect(result.status).toBe("unknown")
  })

  it("handles exact boundaries, large values and unknown ranks deterministically", () => {
    const goal: RankRequirementGroup = {
      mode: "all",
      conditions: [
        { kind: "numeric", metric: "uploadedBytes", comparison: "gte", requiredValue: 1e15 },
      ],
    }
    const result = evaluateRankGoal(
      input({ observations: obs({ uploadedBytes: 1e15 }), structuredGoals: { "Power User": goal } })
    )
    expect(result.status).toBe("met")

    const outside = evaluateRankGoal(input({ currentRank: "Mystery" }))
    expect(outside.nextRank).toBeNull()
    expect(outside.currentRank).toBe("Mystery")
    expect(outside.status).toBe("unknown")
  })

  it("does not auto-select an appointed class or a branch", () => {
    const appointed = evaluateRankGoal(
      input({
        userClasses: [...classes, { name: "VIP", outsideLadder: "above" }],
        currentRank: "VIP",
      })
    )
    expect(appointed.status).toBe("appointed")
    expect(appointed.nextRank).toBeNull()

    const branchClasses: TrackerUserClass[] = [
      { name: "User" },
      { name: "Power User" },
      { name: "Movie", path: "movies" },
      { name: "TV", path: "tv" },
    ]
    const branch = evaluateRankGoal(
      input({
        userClasses: branchClasses,
        currentRank: "Power User",
        rankPaths: [
          { id: "movies", label: "Movies" },
          { id: "tv", label: "TV" },
        ],
      })
    )
    expect(branch.nextRank).toBeNull()
    expect(branch.nextRankReason).toMatch(/branch/i)
  })

  it("treats equality according to the stored operator", () => {
    const base: RankRequirementGroup = {
      mode: "all",
      conditions: [
        { kind: "numeric", metric: "uploadedBytes", comparison: "gte", requiredValue: 1000 },
      ],
    }
    const gte = evaluateRequirementGroup(
      base,
      input({ observations: obs({ uploadedBytes: 1000 }), structuredGoals: {} })
    )
    expect(gte.status).toBe("met")

    const gt = evaluateRequirementGroup(
      {
        mode: "all",
        conditions: [
          { kind: "numeric", metric: "uploadedBytes", comparison: "gt", requiredValue: 1000 },
        ],
      },
      input({ observations: obs({ uploadedBytes: 1000 }), structuredGoals: {} })
    )
    expect(gt.status).toBe("unmet")
  })

  it("evaluates personal goals with the same condition semantics", () => {
    const results = evaluatePersonalGoals(
      {
        "Keep ratio": {
          mode: "all",
          conditions: [
            { kind: "numeric", metric: "accountRatio", comparison: "gte", requiredValue: 1 },
          ],
        },
      },
      input()
    )
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe("Keep ratio")
    expect(results[0].result.status).toBe("met")
  })
})
