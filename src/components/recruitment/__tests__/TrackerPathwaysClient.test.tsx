import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TrackerPathwaysClient } from "@/components/recruitment/TrackerPathwaysClient"
import { PATHWAYS_TRACKERS } from "@/data/pathways/catalog"
import type { RecruitmentCatalog } from "@/lib/recruitment-routes"
import { RECRUITMENT_ROUTE_FORMAT_VERSION } from "@/lib/recruitment-routes"
import { emptyRecruitmentState } from "@/lib/recruitment-state"
import type { TrackerSummary } from "@/types/api"

const fetchMock = vi.fn()

const CATALOG: RecruitmentCatalog = {
  formatVersion: RECRUITMENT_ROUTE_FORMAT_VERSION,
  source: {
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
  },
  routes: [
    {
      id: "tp:TorrentLeech:BroadcasTheNet",
      sourceTrackerId: "TorrentLeech",
      destinationTrackerId: "BroadcasTheNet",
      sourceRegistrySlug: "torrentleech",
      destinationRegistrySlug: "broadcasthenet",
      requirements: null,
      requirementNotes: [],
      minimumDays: 30,
      availability: "open",
      availabilityRaw: "Yes",
      sourceUpdatedAt: "2026-09",
      sourceUpdatedRaw: "Sep 2026",
    },
    {
      id: "tp:AlphaRatio:BroadcasTheNet",
      sourceTrackerId: "AlphaRatio",
      destinationTrackerId: "BroadcasTheNet",
      sourceRegistrySlug: "alpharatio",
      destinationRegistrySlug: "broadcasthenet",
      requirements: null,
      requirementNotes: [],
      minimumDays: 0,
      availability: "open",
      availabilityRaw: "Yes",
      sourceUpdatedAt: "2026-09",
      sourceUpdatedRaw: "Sep 2026",
    },
  ],
  sourceGates: [
    { trackerId: "TorrentLeech", days: 30, text: "Power User: 4 weeks" },
    { trackerId: "AlphaRatio", days: 0, text: "Sphinx: invite forum" },
  ],
  overrides: [],
}

const OPEN_CATALOG: RecruitmentCatalog = {
  ...CATALOG,
  sourceGates: [],
}

const REQUIREMENT_CATALOG: RecruitmentCatalog = {
  ...OPEN_CATALOG,
  routes: [
    {
      ...CATALOG.routes[0],
      minimumDays: 0,
      requirementNotes: ["3TB upload"],
    },
  ],
}

const DIRECT_CATALOG: RecruitmentCatalog = {
  ...OPEN_CATALOG,
  routes: [
    {
      ...CATALOG.routes[1],
      id: "tp:AlphaRatio:ReadyDest",
      destinationTrackerId: "ReadyDest",
      destinationRegistrySlug: null,
      minimumDays: 0,
      requirementNotes: [],
    },
    {
      ...CATALOG.routes[0],
      id: "tp:TorrentLeech:SlowDest",
      destinationTrackerId: "SlowDest",
      destinationRegistrySlug: null,
      minimumDays: 30,
      requirementNotes: [],
    },
    {
      ...CATALOG.routes[0],
      id: "tp:TorrentLeech:ReadyDest",
      destinationTrackerId: "ReadyDest",
      destinationRegistrySlug: null,
      minimumDays: 100,
      requirementNotes: [],
    },
    {
      ...CATALOG.routes[1],
      id: "tp:AlphaRatio:TorrentLeech",
      destinationTrackerId: "TorrentLeech",
      destinationRegistrySlug: "torrentleech",
    },
    {
      ...CATALOG.routes[0],
      id: "tp:TorrentLeech:ClosedDest",
      destinationTrackerId: "ClosedDest",
      destinationRegistrySlug: null,
      availability: "closed",
      availabilityRaw: "No",
    },
  ],
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
  it("uses the Tracker pathways name", () => {
    render(
      <TrackerPathwaysClient
        trackers={[tracker()]}
        initialState={stateFor(null)}
        catalog={CATALOG}
      />
    )
    expect(screen.getByRole("heading", { name: "Tracker pathways" })).toBeInTheDocument()
    const directHeading = screen.getByRole("heading", {
      name: "Where your trackers can take you",
    })
    expect(directHeading).toBeInTheDocument()
    const getTo = screen.getByText("Get to a tracker")
    expect(
      directHeading.compareDocumentPosition(getTo) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(screen.queryByText(/Your trackers \(/)).not.toBeInTheDocument()
    expect(screen.getByText("BroadcasTheNet")).toBeInTheDocument()
  })

  it("marks an owned tracker missing from trackerpathways data and shows nothing else", () => {
    render(
      <TrackerPathwaysClient
        trackers={[
          tracker({
            registrySlug: "not-in-pathways",
            name: "Mystery Tracker",
          }),
        ]}
        initialState={stateFor(null)}
        catalog={CATALOG}
      />
    )
    expect(screen.getByText(/Not in trackerpathways data: Mystery Tracker\./)).toBeInTheDocument()
    expect(screen.getByText("No one-step destinations from your trackers yet.")).toBeInTheDocument()
    expect(screen.queryByText("Power User")).not.toBeInTheDocument()
    expect(screen.queryByText(/direct route/)).not.toBeInTheDocument()
  })

  it("shows the best path first with route chips and keeps other routes collapsed", () => {
    const { container } = render(
      <TrackerPathwaysClient
        trackers={[
          tracker({ id: 1, name: "TorrentLeech", joinedAt: recentJoin }),
          tracker({ id: 2, name: "AlphaRatio", registrySlug: "alpharatio" }),
        ]}
        initialState={stateFor("BroadcasTheNet")}
        catalog={OPEN_CATALOG}
      />
    )
    expect(screen.getByText("Best path")).toBeInTheDocument()
    const chips = [...container.querySelectorAll("[data-route-chip]")].map((chip) =>
      chip.textContent?.trim()
    )
    expect(chips).toEqual(["AlphaRatio", "BroadcasTheNet"])
    expect(screen.getAllByText("Ready now")).toHaveLength(2)
    expect(screen.queryByText("AlphaRatio → BroadcasTheNet")).not.toBeInTheDocument()
    const other = screen.getByText("Other routes (1)")
    expect(other.closest("details")).not.toHaveAttribute("open")
  })

  it("lists one-step destinations once, ready first, then days left", () => {
    const { container } = render(
      <TrackerPathwaysClient
        trackers={[
          tracker({
            id: 1,
            name: "TorrentLeech",
            registrySlug: "torrentleech",
            joinedAt: recentJoin,
          }),
          tracker({ id: 2, name: "AlphaRatio", registrySlug: "alpharatio" }),
        ]}
        initialState={stateFor(null)}
        catalog={DIRECT_CATALOG}
      />
    )
    const rows = [...container.querySelectorAll("[data-direct-route]")]
    expect(rows.map((row) => row.getAttribute("data-direct-route"))).toEqual([
      "ReadyDest",
      "SlowDest",
    ])
    expect(rows[0]).toHaveTextContent("from AlphaRatio")
    expect(rows[0]).toHaveTextContent("Ready now")
    expect(rows[1]).toHaveTextContent("from TorrentLeech")
    expect(rows[1]).toHaveTextContent(/days left/)
    expect(container.querySelectorAll('[data-direct-route="ReadyDest"]')).toHaveLength(1)
    expect(container.querySelector('[data-direct-route="TorrentLeech"]')).toBeNull()
    expect(container.querySelector('[data-direct-route="ClosedDest"]')).toBeNull()
  })

  it("renders one line per step and keeps details to the two dates", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <TrackerPathwaysClient
        trackers={[
          tracker({ id: 1, name: "TorrentLeech", joinedAt: recentJoin }),
          tracker({ id: 2, name: "AlphaRatio", registrySlug: "alpharatio" }),
        ]}
        initialState={stateFor("BroadcasTheNet")}
        catalog={OPEN_CATALOG}
      />
    )
    expect(
      screen.getByText("From AlphaRatio to BroadcasTheNet · Ready now")
    ).toBeInTheDocument()
    expect(container.querySelector("[data-step-requirement-bars]")).toBeNull()
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
        trackers={[tracker({ joinedAt: recentJoin })]}
        initialState={stateFor("BroadcasTheNet")}
        catalog={REQUIREMENT_CATALOG}
      />
    )
    expect(screen.getByText("Wait done, needs 3TB upload")).toBeInTheDocument()
    expect(
      screen.getByText("From TorrentLeech to BroadcasTheNet · Wait done, needs 3TB upload")
    ).toBeInTheDocument()
  })

  it("shows the no-route state and the trackerpathways link", () => {
    const target = PATHWAYS_TRACKERS.find((item) => item.name === "Aither")
    expect(target).toBeDefined()
    render(
      <TrackerPathwaysClient
        trackers={[tracker()]}
        initialState={stateFor(target?.id ?? null)}
        catalog={CATALOG}
      />
    )
    expect(screen.getByText("No known route from your trackers.")).toBeInTheDocument()
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
    expect(screen.getAllByText(/days left/).length).toBeGreaterThan(0)
  })

  it("saves a target and exposes the previous target as a switchable chip", async () => {
    const user = userEvent.setup()
    render(
      <TrackerPathwaysClient
        trackers={[tracker()]}
        initialState={stateFor("BroadcasTheNet")}
        catalog={CATALOG}
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
