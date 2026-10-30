import { describe, expect, it } from "vitest"
import raw from "@/data/pathways/trackers.json"
import { RECRUITMENT_CATALOG, RECRUITMENT_ROUTES } from "@/data/recruitment-catalog"
import {
  evaluateRecruitmentRoute,
  findRecruitmentPaths,
  type RecruitmentRouteRecord,
} from "@/lib/recruitment-routes"

const NOW = new Date("2026-10-30T12:00:00.000Z")

type UpstreamRoute = { days: number; reqs: string; active: string; updated: string }
type UpstreamData = {
  routeInfo: Record<string, Record<string, UpstreamRoute>>
  unlockInviteClass: Record<string, [number | null, string]>
}
const upstream = raw as unknown as UpstreamData

function route(source: string, destination: string): RecruitmentRouteRecord | undefined {
  return RECRUITMENT_ROUTES.find(
    (candidate) =>
      candidate.sourceTrackerId === source && candidate.destinationTrackerId === destination
  )
}

describe("trackerpathways route direction", () => {
  it("reads routeInfo[source][destination] as source -> destination", () => {
    const aitherToMidnight = route("Aither", "MidnightScene")
    expect(aitherToMidnight).toMatchObject({
      sourceTrackerId: "Aither",
      destinationTrackerId: "MidnightScene",
      minimumDays: 0,
      requirementNotes: ["Prometheus+, 3TB upload"],
    })
    expect(route("MidnightScene", "Aither")).toBeUndefined()
  })

  it("walks a path forward from the tracker you are on", () => {
    const direct = route("Aither", "MidnightScene")
    expect(direct).toBeDefined()
    expect(
      findRecruitmentPaths(RECRUITMENT_CATALOG.routes, "Aither", "MidnightScene", 1)
    ).toEqual([{ routeIds: [direct?.id], hops: 1 }])
    expect(
      findRecruitmentPaths(RECRUITMENT_CATALOG.routes, "MidnightScene", "Aither", 1)
    ).toEqual([])
  })

  it("keeps Zenith -> MidnightScene's 180-day wait and requirement", () => {
    expect(route("Zenith", "MidnightScene")).toMatchObject({
      minimumDays: 180,
      requirementNotes: ["6 months, 3TB upload"],
    })
  })

  it("takes the invite class and its wait from the source tracker", () => {
    const aitherRoute = route("Aither", "MidnightScene")
    expect(aitherRoute).toBeDefined()
    const evaluation = evaluateRecruitmentRoute(RECRUITMENT_CATALOG, aitherRoute?.id ?? "", {
      observations: {},
      now: NOW,
    })
    expect(evaluation?.sourceTrackerId).toBe("Aither")
    expect(evaluation?.eligibility.sourceRequirements.inviteGate?.trackerId).toBe("Aither")
    expect(evaluation?.eligibility.sourceRequirements.inviteGate?.text).toContain("Prometheus")
    expect(evaluation?.timeGate.effectiveDays).toBe(240)

    // MidnightScene has no unlockInviteClass entry; DarkPeers the destination
    // does. The step must not borrow the destination's gate.
    const intoDarkPeers = route("MidnightScene", "DarkPeers")
    expect(intoDarkPeers).toBeDefined()
    const reverseEvaluation = evaluateRecruitmentRoute(
      RECRUITMENT_CATALOG,
      intoDarkPeers?.id ?? "",
      { observations: {}, now: NOW }
    )
    expect(reverseEvaluation?.eligibility.sourceRequirements.inviteGate).toBeNull()
  })

  it("matches upstream routeInfo for three routes", () => {
    const pairs = [
      ["Aither", "MidnightScene"],
      ["Zenith", "MidnightScene"],
      ["MidnightScene", "Zenith"],
    ] as const
    for (const [source, destination] of pairs) {
      const rawRoute = upstream.routeInfo[source]?.[destination]
      expect(rawRoute, `${source} -> ${destination} is in upstream routeInfo`).toBeDefined()
      expect(route(source, destination)).toMatchObject({
        sourceTrackerId: source,
        destinationTrackerId: destination,
        minimumDays: rawRoute?.days,
        requirementNotes: [rawRoute?.reqs],
      })
    }
    expect(upstream.routeInfo.MidnightScene?.Aither).toBeUndefined()
  })
})
