// src/lib/__tests__/pathways-p67.test.ts
//
// P67: the trackerpathways dataset spells several trackers differently from
// the registry, lists destinations the user already owns, and repeats one
// source gate on every row. These tests use the pinned production snapshot and
// real registry names, not fixtures.

import { describe, expect, it } from "vitest"
import { RECRUITMENT_CATALOG } from "@/data/recruitment-catalog"
import {
  PATHWAYS_TRACKER_ALIASES,
  PATHWAYS_UNMATCHED_REGISTRY_SLUGS,
} from "@/data/pathways/aliases"
import {
  pathwaysTrackerIdForRegistrySlug,
  registryNameForPathwaysTracker,
} from "@/data/pathways/catalog"
import { TRACKER_REGISTRY } from "@/data/tracker-registry"
import { buildOwnedTrackerCards } from "@/lib/recruitment-pathways"
import type { TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-30T12:00:00.000Z")
const OLD_JOIN = "2025-01-01T00:00:00.000Z"

function tracker(registrySlug: string, overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  const entry = TRACKER_REGISTRY.find((candidate) => candidate.slug === registrySlug)
  return {
    id: registrySlug.length,
    name: entry?.name ?? registrySlug,
    registrySlug,
    joinedAt: OLD_JOIN,
    lastPolledAt: NOW.toISOString(),
    latestStats: { group: "PowerUser" },
    ...overrides,
  } as TrackerSummary
}

function cardsFor(slugs: string[]) {
  return buildOwnedTrackerCards({
    catalog: RECRUITMENT_CATALOG,
    trackers: slugs.map((slug) => tracker(slug)),
    now: NOW,
  })
}

describe("P67 step 1 - explicit name matching", () => {
  it("covers every production registry tracker, explicitly naming the snapshot gaps", () => {
    const unmatched = TRACKER_REGISTRY.filter(
      (entry) =>
        !pathwaysTrackerIdForRegistrySlug(entry.slug) &&
        !PATHWAYS_UNMATCHED_REGISTRY_SLUGS.includes(entry.slug)
    )
    expect(unmatched.map((entry) => entry.slug)).toEqual([])

    const expectedGaps = TRACKER_REGISTRY.filter((entry) =>
      PATHWAYS_UNMATCHED_REGISTRY_SLUGS.includes(entry.slug)
    )
    expect(expectedGaps).toHaveLength(PATHWAYS_UNMATCHED_REGISTRY_SLUGS.length)
  })

  it("maps the observed spellings to the registry slug", () => {
    expect(PATHWAYS_TRACKER_ALIASES.YuScene).toBe("yuscene")
    expect(PATHWAYS_TRACKER_ALIASES["OnlyEncodes+"]).toBe("onlyencodes")
    expect(PATHWAYS_TRACKER_ALIASES.DigitalCore).toBe("digitalcore")
    expect(PATHWAYS_TRACKER_ALIASES["DigitalCore.Club"]).toBe("digitalcore")
    expect(PATHWAYS_TRACKER_ALIASES.MyAnonamouse).toBe("myanonamouse")
    expect(PATHWAYS_TRACKER_ALIASES.OldToonsWorld).toBe("oldtoons")
  })

  it("displays the registry name on every card for a tracker I am on", () => {
    const { cards } = cardsFor(["yuscene", "onlyencodes", "digitalcore", "myanonamouse"])
    const byId = new Map(cards.map((card) => [card.sourceTrackerId, card]))

    expect(byId.get("YuScene")?.sourceName).toBe("Yu-Scene")
    expect(byId.get("OnlyEncodes+")?.sourceName).toBe("OnlyEncodes")
    expect(byId.get("DigitalCore.Club")?.sourceName).toBe("DigitalCore.Club")
    expect(byId.get("MyAnonamouse")?.sourceName).toBe("MyAnonaMouse")
    expect(registryNameForPathwaysTracker("YuScene")).toBe("Yu-Scene")
  })

  it("never reports a mapped production tracker as unmatched when it is owned", () => {
    const { unsupportedOwnedTrackers } = cardsFor(
      TRACKER_REGISTRY.map((entry) => entry.slug)
    )
    expect(unsupportedOwnedTrackers.map((owned) => owned.registrySlug).sort()).toEqual(
      [...PATHWAYS_UNMATCHED_REGISTRY_SLUGS].sort()
    )
  })
})

describe("P67 step 2 - destinations already owned", () => {
  it("removes every owned destination and names each one once", () => {
    const result = cardsFor(["yuscene", "seedpool", "uploadcx", "zenith"])
    const yuScene = result.cards.find((card) => card.sourceTrackerId === "YuScene")

    expect(yuScene?.destinations.map((destination) => destination.destinationTrackerId)).not.toEqual(
      expect.arrayContaining(["seedpool", "Upload.cx", "Zenith"])
    )
    expect(new Set(result.alreadyMemberNames)).toEqual(
      new Set(["seedpool", "Upload.cx", "Zenith", "Yu-Scene"])
    )
  })

  it("never lists an owned tracker as any card's destination", () => {
    const owned = ["yuscene", "seedpool", "uploadcx", "zenith"]
    const ownedSlugs = new Set(owned)
    const result = cardsFor(owned)
    for (const card of result.cards) {
      for (const destination of card.destinations) {
        const slug = PATHWAYS_TRACKER_ALIASES[destination.destinationTrackerId]
        expect(slug === undefined || !ownedSlugs.has(slug)).toBe(true)
      }
    }
  })
})

describe("P67 step 4 - gate once per card", () => {
  it("hoists a gate shared by every destination on the card", () => {
    const { cards } = cardsFor(["yuscene"])
    const card = cards.find((candidate) => candidate.sourceTrackerId === "YuScene")

    expect(card?.sharedGate).toMatchObject({
      requiredClasses: ["SuperUser"],
      written: ["Super User"],
      currentClass: "PowerUser",
      status: "not-yet",
    })
    expect(card?.sharedGate?.detail).toContain("you are PowerUser")
  })

  it("does not hoist a gate when a destination names a different class", () => {
    const catalog = {
      ...RECRUITMENT_CATALOG,
      routes: RECRUITMENT_CATALOG.routes.map((route) =>
        route.sourceTrackerId === "YuScene" && route.destinationTrackerId === "DarkPeers"
          ? { ...route, requirementNotes: ["ExtremeUser: 1 year"] }
          : route
      ),
    }
    const { cards } = buildOwnedTrackerCards({
      catalog,
      trackers: [tracker("yuscene")],
      now: NOW,
    })
    const card = cards.find((candidate) => candidate.sourceTrackerId === "YuScene")

    expect(card?.sharedGate).toBeNull()
  })
})

describe("P67 step 5 - closed routes hidden", () => {
  it("keeps closed destinations in the data and counts them separately", () => {
    const { cards } = cardsFor(["yuscene"])
    const card = cards.find((candidate) => candidate.sourceTrackerId === "YuScene")
    const closed = card?.destinations.filter((destination) => destination.closed) ?? []

    expect(closed.length).toBeGreaterThan(0)
    expect(card?.closedDestinationCount).toBe(closed.length)
  })
})
