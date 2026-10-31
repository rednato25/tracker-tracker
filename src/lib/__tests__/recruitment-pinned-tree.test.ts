// src/lib/__tests__/recruitment-pinned-tree.test.ts
//
// P54: pinned routes share branches when they share steps.

import { describe, expect, it } from "vitest"
import { buildPinnedRouteTrees, type PinnedRoutePathInput } from "@/lib/recruitment-pinned-tree"

function step(
  sourceTrackerId: string,
  destinationTrackerId: string,
  waitDays: number | null = 0
) {
  return { sourceTrackerId, destinationTrackerId, waitDays }
}

function path(
  targetTrackerId: string,
  ...steps: ReturnType<typeof step>[]
): PinnedRoutePathInput {
  return { targetTrackerId, steps }
}

describe("buildPinnedRouteTrees", () => {
  it("merges shared prefixes into one branch", () => {
    const view = buildPinnedRouteTrees([
      path("Gamma", step("Start", "Mid", 1), step("Mid", "Gamma", 2)),
      path("Delta", step("Start", "Mid", 1), step("Mid", "Delta", 3)),
    ])

    expect(view.trees).toHaveLength(1)
    const root = view.trees[0].root
    expect(root.children.map((node) => node.trackerId)).toEqual(["Mid"])

    const mid = root.children[0]
    expect(mid.children.map((node) => node.trackerId)).toEqual(["Gamma", "Delta"])
    expect(mid.unlocks).toBe(2)
  })

  it("shows the total wait to reach every node", () => {
    const view = buildPinnedRouteTrees([
      path("Gamma", step("Start", "Mid", 1), step("Mid", "Gamma", 2)),
    ])

    const mid = view.trees[0].root.children[0]
    expect(mid.totalDays).toBe(1)
    expect(mid.children[0].totalDays).toBe(3)
  })

  it("counts every pinned target below an intermediate node", () => {
    const view = buildPinnedRouteTrees([
      path("Gamma", step("Start", "Mid", 1), step("Mid", "Gamma", 2)),
      path("Delta", step("Start", "Mid", 1), step("Mid", "Delta", 3)),
      path("Epsilon", step("Start", "Epsilon", 4)),
    ])

    const root = view.trees[0].root
    expect(root.unlocks).toBe(3)
    expect(root.children[0].unlocks).toBe(2)
    expect(root.children[1].unlocks).toBe(1)
  })

  it("picks the soonest node with a pinned target on or below it", () => {
    const view = buildPinnedRouteTrees([
      path("Gamma", step("Start", "Slow", 5), step("Slow", "Gamma", 1)),
      path("Delta", step("Start", "Mid", 1), step("Mid", "Fast", 0), step("Fast", "Delta", 2)),
    ])

    expect(view.nextStep).toEqual({
      trackerId: "Mid",
      sourceTrackerId: "Start",
      totalDays: 1,
    })
  })

  it("picks the next step across starting trackers", () => {
    const view = buildPinnedRouteTrees([
      path("Gamma", step("Alpha", "Slow", 8), step("Slow", "Gamma", 1)),
      path("Delta", step("Beta", "Quick", 2), step("Quick", "Delta", 1)),
    ])

    expect(view.nextStep).toEqual({
      trackerId: "Quick",
      sourceTrackerId: "Beta",
      totalDays: 2,
    })
  })
})
