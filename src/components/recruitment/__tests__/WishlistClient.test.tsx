import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { WishlistClient } from "@/components/recruitment/WishlistClient"
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
      requirements: {
        mode: "all",
        conditions: [
          {
            kind: "numeric",
            id: "source-age",
            metric: "accountAgeDays",
            comparison: "gte",
            requiredValue: 14,
            label: "At least 14 days registered",
          },
        ],
      },
      requirementNotes: [],
      minimumDays: null,
      availability: "open",
      availabilityRaw: "Yes",
      sourceUpdatedAt: "2026-09",
      sourceUpdatedRaw: "Sep 2026",
    },
  ],
  sourceGates: [],
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
    joinedAt: "2026-09-01T00:00:00.000Z",
    lastAccessAt: null,
    remoteUserId: null,
    platformMeta: null,
    createdAt: "2026-09-01T00:00:00.000Z",
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

describe("WishlistClient", () => {
  it("saves a selected destination without contacting a tracker", async () => {
    const user = userEvent.setup()
    render(
      <WishlistClient
        trackers={[tracker()]}
        initialState={stateFor(null)}
        savedRankGoals={{}}
        catalog={CATALOG}
      />
    )

    expect(screen.getByText("Choose a destination")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Desired tracker" }))
    await user.click(screen.getByRole("option", { name: "BroadcasTheNet" }))

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")
      expect(put).toBeDefined()
      expect(JSON.parse(String(put?.[1]?.body))).toMatchObject({
        state: { desiredTrackerSlug: "BroadcasTheNet" },
      })
    })
  })

  it("offers a destination that is not in the tracker registry", async () => {
    const unregistered = PATHWAYS_TRACKERS.find((tracker) => !tracker.registrySlug)
    expect(unregistered).toBeDefined()
    if (!unregistered) return
    const user = userEvent.setup()
    render(
      <WishlistClient
        trackers={[]}
        initialState={stateFor(null)}
        savedRankGoals={{}}
        catalog={CATALOG}
      />
    )
    await user.click(screen.getByRole("button", { name: "Desired tracker" }))
    await user.click(screen.getByRole("option", { name: unregistered.name }))
    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")
      expect(JSON.parse(String(put?.[1]?.body))).toMatchObject({
        state: { desiredTrackerSlug: unregistered.id },
      })
    })
  })

  it("shows known requirements met and links a compatible saved goal", async () => {
    const user = userEvent.setup()
    render(
      <WishlistClient
        trackers={[tracker()]}
        initialState={stateFor("BroadcasTheNet")}
        savedRankGoals={{ "1": { targetRank: "Power User" } }}
        catalog={CATALOG}
      />
    )

    expect(screen.getAllByText("Known requirements met").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Your account").length).toBeGreaterThan(0)
    await user.click(
      screen.getByRole("button", { name: /Link to TorrentLeech Power User goal/ })
    )

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")
      const body = JSON.parse(String(put?.[1]?.body)) as {
        state: { goalLinks: { conditionId: string; targetRank: string }[] }
      }
      expect(body.state.goalLinks[0]).toMatchObject({
        conditionId: "source-age",
        targetRank: "Power User",
      })
    })
  })

  it("hides and restores a route path", async () => {
    const user = userEvent.setup()
    render(
      <WishlistClient
        trackers={[tracker()]}
        initialState={stateFor("BroadcasTheNet")}
        savedRankGoals={{}}
        catalog={CATALOG}
      />
    )

    await user.click(screen.getByRole("button", { name: "Hide route" }))
    expect(await screen.findByText("Matching routes are hidden")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Show 1 hidden route/ }))
    expect(await screen.findByText(/1 route to BroadcasTheNet/)).toBeInTheDocument()
  })

  it("explains no known route without claiming no route exists", () => {
    render(
      <WishlistClient
        trackers={[tracker({ registrySlug: "alpharatio" })]}
        initialState={stateFor("BroadcasTheNet")}
        savedRankGoals={{}}
        catalog={CATALOG}
      />
    )

    expect(screen.getByText("No known route")).toBeInTheDocument()
    expect(
      screen.getByText(/This does not mean no route exists/)
    ).toBeInTheDocument()
  })

  it("keeps scenario steps visibly separate from owned-account evaluation", () => {
    const catalog: RecruitmentCatalog = {
      ...CATALOG,
      routes: [
        CATALOG.routes[0],
        {
          ...CATALOG.routes[0],
          id: "tp:BroadcasTheNet:Aither",
          sourceTrackerId: "BroadcasTheNet",
          destinationTrackerId: "Aither",
        },
        {
          ...CATALOG.routes[0],
          id: "tp:Aither:BroadcasTheNet",
          sourceTrackerId: "Aither",
          destinationTrackerId: "BroadcasTheNet",
        },
      ],
    }
    render(
      <WishlistClient
        trackers={[tracker()]}
        initialState={stateFor("Aither")}
        savedRankGoals={{}}
        catalog={catalog}
      />
    )
    expect(screen.getAllByText("Scenario").length).toBeGreaterThan(0)
    expect(screen.getByText(/Scenario only/)).toBeInTheDocument()
  })
})
