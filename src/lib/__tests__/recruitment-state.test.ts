import { describe, expect, it } from "vitest"
import {
  emptyRecruitmentState,
  normalizeRecruitmentState,
  parseSavedRankGoals,
  RECRUITMENT_GOAL_LINKS_MAX,
  RECRUITMENT_HIDDEN_PATHS_MAX,
  recruitmentPathKey,
  serializeRecruitmentState,
} from "@/lib/recruitment-state"

const VALID_LINK = {
  routeId: "tp:torrentleech:broadcasthenet",
  conditionId: "source-age",
  sourceTrackerSlug: "torrentleech",
  goalTrackerSlug: "torrentleech",
  targetRank: "Power User",
  metric: "accountAgeDays",
  comparison: "gte",
  requiredValue: 14,
}

describe("normalizeRecruitmentState", () => {
  it("starts empty for missing, corrupt or non-object state", () => {
    expect(normalizeRecruitmentState(null)).toEqual(emptyRecruitmentState())
    expect(normalizeRecruitmentState("not json")).toEqual(emptyRecruitmentState())
    expect(normalizeRecruitmentState([])).toEqual(emptyRecruitmentState())
    expect(normalizeRecruitmentState({ desiredTrackerSlug: "missing" }).desiredTrackerSlug).toBeNull()
  })

  it("migrates a saved registry target to its trackerpathways ID", () => {
    const state = normalizeRecruitmentState({
      desiredTrackerSlug: "torrentleech",
      hiddenPathKeys: [
        "tp:alpharatio:broadcasthenet",
        "tp:alpharatio:broadcasthenet",
        "",
        "x".repeat(600),
      ],
    })
    expect(state.desiredTrackerSlug).toBe("TorrentLeech")
    expect(state.hiddenPathKeys).toEqual(["tp:alpharatio:broadcasthenet"])
  })

  it("caps hidden paths and goal links", () => {
    const hidden = Array.from({ length: RECRUITMENT_HIDDEN_PATHS_MAX + 5 }, (_, index) =>
      recruitmentPathKey([`route-${index}`])
    )
    const links = Array.from({ length: RECRUITMENT_GOAL_LINKS_MAX + 5 }, (_, index) => ({
      ...VALID_LINK,
      routeId: `route-${index}`,
      conditionId: `condition-${index}`,
    }))
    const state = normalizeRecruitmentState({ hiddenPathKeys: hidden, goalLinks: links })
    expect(state.hiddenPathKeys).toHaveLength(RECRUITMENT_HIDDEN_PATHS_MAX)
    expect(state.goalLinks).toHaveLength(RECRUITMENT_GOAL_LINKS_MAX)
  })

  it("keeps only well-formed goal links with known tracker slugs", () => {
    const state = normalizeRecruitmentState({
      goalLinks: [
        VALID_LINK,
        { ...VALID_LINK, conditionId: "second" },
        { ...VALID_LINK, conditionId: "third", metric: "invented" },
        { ...VALID_LINK, conditionId: "fourth", goalTrackerSlug: "not-a-tracker" },
        { ...VALID_LINK, conditionId: "fifth", requiredValue: Number.NaN },
      ],
    })
    expect(state.goalLinks).toHaveLength(2)
    expect(state.goalLinks.map((link) => link.conditionId)).toEqual(["source-age", "second"])
  })

  it("keeps a pinned route per known target and drops invalid pins", () => {
    const state = normalizeRecruitmentState({
      pinnedRoutes: {
        Aither: "tp:AlphaRatio:Aither",
        TorrentLeech: "",
        "not-a-tracker": "tp:AlphaRatio:Aither",
      },
    })
    expect(state.pinnedRoutes).toEqual({ Aither: "tp:AlphaRatio:Aither" })
  })

  it("round-trips through serialization without adding token-like secrets", () => {
    const state = normalizeRecruitmentState({
      desiredTrackerSlug: "torrentleech",
      hiddenPathKeys: ["tp:alpharatio:broadcasthenet"],
      goalLinks: [VALID_LINK],
      pinnedRoutes: { Aither: "tp:AlphaRatio:Aither" },
    })
    const serialized = serializeRecruitmentState(state)
    expect(normalizeRecruitmentState(serialized)).toEqual(state)
    expect(serialized).not.toContain("token")
  })
})

describe("parseSavedRankGoals", () => {
  it("keeps valid target ranks and discards malformed entries", () => {
    expect(
      parseSavedRankGoals(
        JSON.stringify({
          "1": { targetRank: "Power User" },
          "0": { targetRank: "Bad" },
          "2": { targetRank: "" },
          "3": { targetRank: 42 },
        })
      )
    ).toEqual({ "1": { targetRank: "Power User" } })
  })

  it("returns an empty map for corrupt JSON", () => {
    expect(parseSavedRankGoals("{")).toEqual({})
    expect(parseSavedRankGoals(null)).toEqual({})
  })
})
