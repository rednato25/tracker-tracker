import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TrackerPathwaysClient } from "@/components/recruitment/TrackerPathwaysClient"
import { PATHWAYS_TRACKERS } from "@/data/pathways/catalog"
import type { RecruitmentCatalog, RecruitmentRouteRecord } from "@/lib/recruitment-routes"
import { RECRUITMENT_ROUTE_FORMAT_VERSION } from "@/lib/recruitment-routes"
import { emptyRecruitmentState } from "@/lib/recruitment-state"
import type { TrackerSummary } from "@/types/api"

const fetchMock = vi.fn()

function route(
  sourceTrackerId: string,
  destinationTrackerId: string,
  overrides: Partial<RecruitmentRouteRecord> = {}
): RecruitmentRouteRecord {
  return {
    id: `tp:${sourceTrackerId}:${destinationTrackerId}`,
    sourceTrackerId,
    destinationTrackerId,
    sourceRegistrySlug: sourceTrackerId.toLowerCase(),
    destinationRegistrySlug: destinationTrackerId.toLowerCase(),
    requirements: null,
    requirementNotes: [],
    minimumDays: 0,
    availability: "open",
    availabilityRaw: "Yes",
    sourceUpdatedAt: "2026-09",
    sourceUpdatedRaw: "Sep 2026",
    ...overrides,
  }
}

const BASE_SOURCE: RecruitmentCatalog["source"] = {
  id: "fixture",
  name: "fixture",
  url: "https://example.invalid",
  license: "MIT",
  licenseUrl: "https://example.invalid/license",
  copyright: "fixture",
  version: "fixture-v1",
  snapshotUrl: "https://example.invalid/routes.json",
  accessedAt: "2026-10-26T00:00:00.000Z",
  attribution: "Fixture routes.",
}

const P38_CATALOG: RecruitmentCatalog = {
  formatVersion: RECRUITMENT_ROUTE_FORMAT_VERSION,
  source: BASE_SOURCE,
  routes: [
    route("TorrentLeech", "BroadcasTheNet", { minimumDays: 30 }),
    route("AlphaRatio", "BroadcasTheNet"),
    ...Array.from({ length: 7 }, (_, index) =>
      route("TorrentLeech", `Dest${index + 1}`, {
        requirementNotes: ["Invite forum access"],
      })
    ),
    route("AlphaRatio", "SecondDest", { requirementNotes: ["3TB upload"] }),
    route("TorrentLeech", "ClosedDest", {
      availability: "closed",
      availabilityRaw: "No",
    }),
    route("BroadcasTheNet", "Dest1", { requirementNotes: ["Elite+"] }),
    route("BroadcasTheNet", "ClosedDest", {
      availability: "closed",
      availabilityRaw: "No",
    }),
  ],
  sourceGates: [
    { trackerId: "TorrentLeech", days: 30, text: "Power User: 4 weeks" },
    { trackerId: "AlphaRatio", days: 0, text: "Sphinx: invite forum" },
    { trackerId: "BroadcasTheNet", days: 90, text: "Elite: 6 months, ratio>=2" },
  ],
  overrides: [],
}

const OPEN_CATALOG: RecruitmentCatalog = {
  ...P38_CATALOG,
  sourceGates: [],
}

const REQUIREMENT_CATALOG: RecruitmentCatalog = {
  ...OPEN_CATALOG,
  routes: OPEN_CATALOG.routes.map((item) =>
    item.sourceTrackerId === "AlphaRatio" && item.destinationTrackerId === "BroadcasTheNet"
      ? { ...item, requirementNotes: ["3TB upload"] }
      : item
  ),
}

function tracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "TorrentLeech",
    baseUrl: "https://tl.invalid",
    registrySlug: "torrentleech",
    platformType: "unit3d",
    isActive: true,
    lastPolledAt: "2026-10-26T10:00:00.000Z",
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    color: "#123456",
    qbtTag: null,
    mouseholeUrl: null,
    hasMouseholeToken: false,
    useProxy: false,
    countCrossSeedUnsatisfied: false,
    hideUnreadBadges: false,
    isFavorite: false,
    sortOrder: 1,
    joinedAt: "2025-01-01T00:00:00.000Z",
    lastAccessAt: null,
    remoteUserId: null,
    platformMeta: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    latestStats: {
      ratio: 2.5,
      ratioIsInfinite: false,
      uploadedBytes: "1000000000",
      downloadedBytes: "400000000",
      bufferBytes: "600000000",
      seedingCount: 3,
      leechingCount: 0,
      requiredRatio: 1,
      warned: false,
      freeleechTokens: 0,
      hitAndRuns: 0,
      seedbonus: 100,
      shareScore: null,
      username: "owner",
      group: "Power User",
    },
    ...overrides,
  }
}

const recentJoin = new Date(Date.now() - 5 * 86_400_000).toISOString()

function stateFor(desiredTrackerSlug: string | null) {
  return { ...emptyRecruitmentState(), desiredTrackerSlug }
}

const bothTrackers = [
  tracker({ id: 1, name: "TorrentLeech", joinedAt: recentJoin }),
  tracker({ id: 2, name: "AlphaRatio", registrySlug: "alpharatio" }),
]

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as { state: unknown }
      return { ok: true, status: 200, json: async () => ({ state: body.state }) }
    }
    return { ok: true, status: 200, json: async () => ({}) }
  })
})

describe("TrackerPathwaysClient", () => {
  it("uses the Tracker pathways name and the dashboard header row", () => {
    render(
      <TrackerPathwaysClient
        trackers={[tracker()]}
        initialState={stateFor(null)}
        catalog={P38_CATALOG}
      />
    )
    expect(screen.getByRole("heading", { name: "Tracker pathways" })).toBeInTheDocument()
    const directHeading = screen.getByRole("heading", {
      name: "Where your trackers can take you",
    })
    const getTo = screen.getByText("Get to a tracker")
    expect(
      directHeading.compareDocumentPosition(getTo) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(screen.queryByText(/Your trackers \(/)).not.toBeInTheDocument()
  })

  it("groups destinations into one card per owned tracker with first 6 and +N more", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <TrackerPathwaysClient
        trackers={bothTrackers}
        initialState={stateFor(null)}
        catalog={P38_CATALOG}
      />
    )

    const cards = [...container.querySelectorAll("[data-owned-card]")]
    expect(cards.map((card) => card.getAttribute("data-owned-card"))).toEqual([
      "AlphaRatio",
      "TorrentLeech",
    ])

    const alpha = container.querySelector('[data-owned-card="AlphaRatio"]') as HTMLElement
    expect(within(alpha).getAllByRole("listitem")).toHaveLength(2)
    expect(alpha).toHaveTextContent("Invites open now")

    const tl = container.querySelector('[data-owned-card="TorrentLeech"]') as HTMLElement
    expect(within(tl).getAllByRole("listitem")).toHaveLength(6)
    expect(tl).toHaveTextContent("Invites open in")
    expect(tl).toHaveTextContent("25 days")

    await user.click(within(tl).getByRole("button", { name: "+3 more" }))
    expect(within(tl).getAllByRole("listitem")).toHaveLength(9)
    const closed = tl.querySelector('[data-destination-row="ClosedDest"]')
    expect(closed).toHaveAttribute("data-closed", "true")
    expect(closed).toHaveTextContent("Closed")
  })

  it("opens a target profile with invite class, invited-from and can-invite-to", () => {
    const { container } = render(
      <TrackerPathwaysClient
        trackers={bothTrackers}
        initialState={stateFor("BroadcasTheNet")}
        catalog={P38_CATALOG}
      />
    )

    const profile = container.querySelector(
      '[data-target-profile="BroadcasTheNet"]'
    ) as HTMLElement
    expect(profile).toBeInTheDocument()
    expect(profile).toHaveTextContent("Elite: 6 months, ratio>=2")
    expect(profile).toHaveTextContent("Open")
    expect(profile).toHaveTextContent("Checked Sep 2026")

    const invitedFrom = within(profile).getByText("Invited from").closest("section") as HTMLElement
    expect(within(invitedFrom).getByText("AlphaRatio")).toBeInTheDocument()
    expect(within(invitedFrom).getByText("TorrentLeech")).toBeInTheDocument()

    const canInviteTo = within(profile)
      .getByText("Can invite to")
      .closest("section") as HTMLElement
    expect(within(canInviteTo).getByText("Dest1")).toBeInTheDocument()
    expect(
      canInviteTo.querySelector('[data-profile-route="tp:BroadcasTheNet:ClosedDest"]')
    ).toHaveAttribute("data-closed", "true")
    expect(screen.getByText("Best path")).toBeInTheDocument()
  })

  it("shows the best path on top with route chips", () => {
    const { container } = render(
      <TrackerPathwaysClient
        trackers={bothTrackers}
        initialState={stateFor("BroadcasTheNet")}
        catalog={OPEN_CATALOG}
      />
    )
    const chips = [...container.querySelectorAll("[data-route-chip]")].map((chip) =>
      chip.textContent?.trim()
    )
    expect(chips).toEqual(["AlphaRatio", "BroadcasTheNet"])
    expect(screen.getByText("Best path")).toBeInTheDocument()
    expect(screen.getByText("Other routes (1)").closest("details")).not.toHaveAttribute("open")
  })

  it("renders one line per step and keeps details to the two dates", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <TrackerPathwaysClient
        trackers={bothTrackers}
        initialState={stateFor("BroadcasTheNet")}
        catalog={OPEN_CATALOG}
      />
    )
    expect(
      screen.getByText("From AlphaRatio to BroadcasTheNet · Ready now")
    ).toBeInTheDocument()
    expect(screen.queryByText("Structured requirements")).not.toBeInTheDocument()
    expect(screen.queryByText(/Availability:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/community evidence/)).not.toBeInTheDocument()

    const details = container.querySelector("details")
    expect(details).not.toBeNull()
    expect(details).not.toHaveAttribute("open")
    await user.click(details?.querySelector("summary") as HTMLElement)
    expect(details).toHaveAttribute("open")
    expect(details).toHaveTextContent("Source updated Sep 2026 · last verified never")
    expect(details?.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
  })

  it("shows Wait done with the requirement instead of Ready now", () => {
    render(
      <TrackerPathwaysClient
        trackers={[
          tracker({
            id: 2,
            name: "AlphaRatio",
            registrySlug: "alpharatio",
            joinedAt: recentJoin,
          }),
        ]}
        initialState={stateFor("BroadcasTheNet")}
        catalog={REQUIREMENT_CATALOG}
      />
    )
    expect(screen.getByText("Wait done, needs 3TB upload")).toBeInTheDocument()
    expect(
      screen.getByText("From AlphaRatio to BroadcasTheNet · Wait done, needs 3TB upload")
    ).toBeInTheDocument()
  })

  it("shows the no-route profile and the trackerpathways link", () => {
    const target = PATHWAYS_TRACKERS.find((item) => item.name === "Aither")
    expect(target).toBeDefined()
    render(
      <TrackerPathwaysClient
        trackers={[tracker()]}
        initialState={stateFor(target?.id ?? null)}
        catalog={P38_CATALOG}
      />
    )
    expect(
      screen.getByText(
        "Nobody in the data invites to Aither. It may recruit through open signups or interviews."
      )
    ).toBeInTheDocument()
    expect(screen.getByText("No invite routes in the data.")).toBeInTheDocument()
    expect(
      screen.getByRole("link", {
        name: "Tracker missing? It isn't in the trackerpathways data yet.",
      })
    ).toHaveAttribute("href", "https://github.com/handokota/trackerpathways")
  })

  it("keeps source details hidden by default", () => {
    const { container } = render(
      <TrackerPathwaysClient
        trackers={[tracker({ joinedAt: recentJoin })]}
        initialState={stateFor("BroadcasTheNet")}
        catalog={OPEN_CATALOG}
      />
    )
    const details = container.querySelectorAll("details")
    expect(details.length).toBeGreaterThan(0)
    expect(details[0]).not.toHaveAttribute("open")
  })

  it("marks an owned tracker missing from trackerpathways data", () => {
    render(
      <TrackerPathwaysClient
        trackers={[
          tracker({
            registrySlug: "not-in-pathways",
            name: "Mystery Tracker",
          }),
        ]}
        initialState={stateFor(null)}
        catalog={P38_CATALOG}
      />
    )
    expect(screen.getByText(/Not in trackerpathways data: Mystery Tracker\./)).toBeInTheDocument()
    expect(
      screen.getByText("No invite routes from your trackers in the data yet.")
    ).toBeInTheDocument()
  })

  it("saves a target and exposes the previous target as a switchable chip", async () => {
    const user = userEvent.setup()
    render(
      <TrackerPathwaysClient
        trackers={[tracker()]}
        initialState={stateFor("BroadcasTheNet")}
        catalog={P38_CATALOG}
      />
    )

    await user.click(screen.getByRole("button", { name: "Choose a tracker" }))
    await user.type(screen.getByRole("combobox", { name: "Search trackerpathways" }), "Aither")
    await user.click(screen.getByRole("option", { name: "Aither" }))

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")
      expect(put).toBeDefined()
      expect(JSON.parse(String(put?.[1]?.body))).toMatchObject({
        state: { desiredTrackerSlug: "Aither" },
      })
    })

    const chip = screen.getByRole("button", { name: "BroadcasTheNet" })
    expect(chip).toBeInTheDocument()
    await user.click(chip)
    await waitFor(() => {
      const puts = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT")
      expect(JSON.parse(String(puts.at(-1)?.[1]?.body))).toMatchObject({
        state: { desiredTrackerSlug: "BroadcasTheNet" },
      })
    })
  })
})
