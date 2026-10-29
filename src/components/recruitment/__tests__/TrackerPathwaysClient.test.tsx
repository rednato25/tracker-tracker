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
    expect(screen.getByText("Your trackers (1)")).toBeInTheDocument()
    expect(screen.getByText("Your trackers (1)").closest("details")).not.toHaveAttribute("open")
    expect(screen.getByText("Get to a tracker")).toBeInTheDocument()
    const getTo = screen.getByText("Get to a tracker")
    const owned = screen.getByText("Your trackers (1)").closest("details") as HTMLElement
    expect(getTo.compareDocumentPosition(owned) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText(/1 direct/)).toBeInTheDocument()
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
    expect(screen.getByText("Mystery Tracker")).toBeInTheDocument()
    expect(screen.getByText("Not in trackerpathways data")).toBeInTheDocument()
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
        catalog={CATALOG}
      />
    )
    expect(screen.getByText("Best path")).toBeInTheDocument()
    const chips = [...container.querySelectorAll("[data-route-chip]")].map((chip) =>
      chip.textContent?.trim()
    )
    expect(chips).toEqual(["AlphaRatio", "BroadcasTheNet"])
    expect(screen.getAllByText("Ready now")).toHaveLength(1)
    expect(screen.queryByText("AlphaRatio → BroadcasTheNet")).not.toBeInTheDocument()
    const other = screen.getByText("Other routes (1)")
    expect(other.closest("details")).not.toHaveAttribute("open")
  })

  it("shows requirement bars on the best-path step by default", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <TrackerPathwaysClient
        trackers={[tracker({ joinedAt: recentJoin })]}
        initialState={stateFor("BroadcasTheNet")}
        catalog={CATALOG}
      />
    )
    const details = container.querySelector("details")
    expect(details).not.toBeNull()
    expect(details).not.toHaveAttribute("open")
    const bars = container.querySelector("[data-step-requirement-bars]")
    expect(bars).not.toBeNull()
    expect(details?.contains(bars)).toBe(false)
    expect(bars?.querySelector('[data-step-requirement-bar="time-on-source"]')).not.toBeNull()
    expect(bars?.querySelector("[data-threshold-tick]")).not.toBeNull()
    expect(screen.getAllByText("Unmet").length).toBeGreaterThan(0)
    expect(screen.getAllByText(/\/ 30 days/).length).toBeGreaterThan(0)

    await user.click(details?.querySelector("summary") as HTMLElement)
    expect(details).toHaveAttribute("open")
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
        catalog={CATALOG}
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
