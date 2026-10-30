import { describe, expect, it } from "vitest"
import { RECRUITMENT_CATALOG, RECRUITMENT_ROUTES } from "@/data/recruitment-catalog"
import {
  buildOwnedTrackerCards,
  buildTrackerProfile,
} from "@/lib/recruitment-pathways"
import { findRecruitmentPaths } from "@/lib/recruitment-routes"
import { emptyRecruitmentState } from "@/lib/recruitment-state"
import type { TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-30T12:00:00.000Z")
const OLD_JOIN = "2025-01-01T00:00:00.000Z"
const MAM_JOIN = "2026-07-22T00:00:00.000Z"

function tracker(registrySlug: string, joinedAt = OLD_JOIN): TrackerSummary {
  return {
    id: registrySlug.length,
    name: registrySlug,
    registrySlug,
    joinedAt,
    lastPolledAt: NOW.toISOString(),
    latestStats: null,
  } as TrackerSummary
}

function profile(targetTrackerId: string, trackers: TrackerSummary[]) {
  return buildTrackerProfile({
    catalog: RECRUITMENT_CATALOG,
    targetTrackerId,
    trackers,
    savedRankGoals: {},
    state: emptyRecruitmentState(),
    now: NOW,
  })
}

describe("P38 pathways view models", () => {
  it("groups destinations into one card per owned tracker", () => {
    const { cards } = buildOwnedTrackerCards({
      catalog: RECRUITMENT_CATALOG,
      trackers: [
        tracker("alpharatio"),
        tracker("aither"),
        tracker("myanonamouse", MAM_JOIN),
      ],
      now: NOW,
    })

    expect(cards).toHaveLength(3)
    expect(cards.map((card) => card.sourceTrackerId)).toEqual(
      expect.arrayContaining(["AlphaRatio", "Aither", "MyAnonamouse"])
    )
    expect(cards.find((card) => card.sourceTrackerId === "AlphaRatio")?.destinations).toHaveLength(
      10
    )
    expect(cards.find((card) => card.sourceTrackerId === "Aither")?.destinations).toHaveLength(
      21
    )
    expect(cards.filter((card) => card.sourceTrackerId === "Aither")).toHaveLength(1)

    const mam = cards.find((card) => card.sourceTrackerId === "MyAnonamouse")
    expect(mam?.destinations.length ?? 0).toBeGreaterThan(6)
    expect(mam?.closedDestinationCount).toBe(2)
    expect(mam).toMatchObject({
      invitesOpen: false,
      inviteDaysRemaining: 80,
      invitesLabel: "Invites open in 80 days",
    })
    expect(cards.at(-1)?.sourceTrackerId).toBe("MyAnonamouse")
  })

  it("builds a target profile with invite class, invited-from and can-invite-to", () => {
    const aither = profile("Aither", [tracker("alpharatio")])

    expect(aither.gateText).toContain("Prometheus")
    expect(aither.gateDays).toBe(240)
    expect(aither.invitedFrom.some((route) => route.trackerId === "AlphaRatio")).toBe(true)
    expect(aither.invitedFrom.find((route) => route.trackerId === "Cinemageddon")?.closed).toBe(
      true
    )
    expect(aither.canInviteTo.some((route) => route.trackerId === "Anthelion")).toBe(true)
    expect(aither.recruitingStatus).toBe("open")
    expect(aither.checkedRaw).toBe("Sep 2026")
    expect(aither.fastest).not.toBeNull()
    expect(aither.fastest?.steps[0]?.sourceTrackerId).toBe("AlphaRatio")
  })

  it("says nobody invites to TV-Vault when Cinemageddon -> TV-Vault is not a route", () => {
    const tvVault = profile("TV-Vault", [])

    expect(
      RECRUITMENT_ROUTES.some(
        (route) =>
          route.sourceTrackerId === "Cinemageddon" &&
          route.destinationTrackerId === "TV-Vault"
      )
    ).toBe(false)
    expect(
      RECRUITMENT_ROUTES.some(
        (route) =>
          route.sourceTrackerId === "TV-Vault" &&
          route.destinationTrackerId === "Cinemageddon"
      )
    ).toBe(true)

    expect(tvVault.paths).toHaveLength(0)
    expect(tvVault.invitedFrom).toHaveLength(0)
    expect(tvVault.fastest).toBeNull()
    expect(tvVault.noRoute).toEqual({
      kind: "nobody",
      message:
        "Nobody in the data invites to TV-Vault. It may recruit through open signups or interviews.",
      sources: [],
    })
  })

  it("lists invited-from trackers when none of my trackers can reach the target", () => {
    const cine = profile("Cinemageddon", [tracker("aither")])
    expect(cine.paths).toHaveLength(0)
    expect(cine.noRoute?.kind).toBe("unreachable")
    if (cine.noRoute?.kind !== "unreachable") throw new Error("expected unreachable no-route")
    expect(cine.noRoute.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceTrackerId: "TV-Vault",
          reachable: false,
          path: null,
        }),
      ])
    )
  })

  it("keeps closed routes visible but out of the best path", () => {
    const closedDirect = RECRUITMENT_ROUTES.find(
      (route) =>
        route.sourceTrackerId === "Cinemageddon" && route.destinationTrackerId === "Aither"
    )
    expect(closedDirect?.availability).toBe("closed")
    expect(
      findRecruitmentPaths(RECRUITMENT_CATALOG.routes, "Cinemageddon", "Aither", 1)
    ).toEqual([])

    const openPath = findRecruitmentPaths(
      RECRUITMENT_CATALOG.routes,
      "Cinemageddon",
      "Aither",
      4
    )
    expect(openPath.length).toBeGreaterThan(0)
    for (const path of openPath) {
      expect(path.routeIds).not.toContain(closedDirect?.id)
    }

    const tvVault = profile("TV-Vault", [])
    expect(
      tvVault.canInviteTo.find((route) => route.trackerId === "Orpheus")?.closed
    ).toBe(true)
  })
})
