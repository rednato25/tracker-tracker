import { describe, expect, it } from "vitest"
import { RECRUITMENT_CATALOG } from "@/data/recruitment-catalog"
import { TRACKER_REGISTRY } from "@/data/tracker-registry"
import { emptyRecruitmentState } from "@/lib/recruitment-state"
import { buildWishlistPaths } from "@/lib/recruitment-wishlist"
import type { TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-30T12:00:00.000Z")

function tracker(registrySlug: string): TrackerSummary {
  const entry = TRACKER_REGISTRY.find((candidate) => candidate.slug === registrySlug)
  return {
    id: registrySlug.length,
    name: entry?.name ?? registrySlug,
    registrySlug,
    joinedAt: "2025-01-01T00:00:00.000Z",
    lastPolledAt: NOW.toISOString(),
    latestStats: { group: "PowerUser" },
  } as TrackerSummary
}

describe("P67 step 3 - routes through a tracker I am on", () => {
  it("drops the longer route whose middle hop is an owned tracker", () => {
    const result = buildWishlistPaths({
      catalog: RECRUITMENT_CATALOG,
      desiredTrackerSlug: "Upload.cx",
      trackers: [tracker("yuscene"), tracker("seedpool")],
      savedRankGoals: {},
      state: emptyRecruitmentState(),
      now: NOW,
      maxHops: 4,
      maxPathsPerSource: 200,
      maxTotal: 500,
    })

    // The shorter route starting from seedpool survives.
    expect(
      result.paths.some(
        (path) => path.steps[0]?.sourceTrackerId === "seedpool" && path.steps.length === 1
      )
    ).toBe(true)
    // YuScene -> seedpool -> Upload.cx is the longer duplicate and is gone.
    expect(
      result.paths.some((path) =>
        path.steps.slice(1).some((step) => step.sourceTrackerId === "seedpool")
      )
    ).toBe(false)
    for (const path of result.paths) {
      expect(path.steps.slice(1).every((step) => step.ownedTrackerId === null)).toBe(true)
    }
  })
})
