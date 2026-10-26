import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RankGoalPanel } from "@/components/tracker-detail/RankGoalPanel"
import { torrentleech } from "@/data/trackers/torrentleech"
import type { Snapshot, TrackerLatestStats } from "@/types/api"

const GiB = 1024 ** 3
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const RECENT_POLL = new Date(Date.now() - HOUR_MS).toISOString()
const EARLIER_POLL = new Date(Date.now() - 25 * DAY_MS).toISOString()
const JOINED_AT = new Date(Date.now() - 16 * DAY_MS).toISOString()

const stats: TrackerLatestStats = {
  ratio: 1.2,
  ratioIsInfinite: false,
  seedingCount: 4,
  leechingCount: 0,
  requiredRatio: 1,
  warned: false,
  freeleechTokens: 2,
  hitAndRuns: 0,
  seedbonus: 10,
  shareScore: 1,
  username: "test",
  group: "Registered",
  uploadedBytes: String(250 * GiB),
  downloadedBytes: "1000",
  bufferBytes: "0",
}

const snapshots = [
  {
    polledAt: EARLIER_POLL,
    uploadedBytes: String(100 * GiB),
    downloadedBytes: "0",
    bufferBytes: "0",
    ratio: 1.2,
    ratioIsInfinite: false,
    seedingCount: 4,
    leechingCount: 0,
    seedbonus: null,
    hitAndRuns: 0,
    requiredRatio: 1,
    warned: false,
    freeleechTokens: null,
    shareScore: null,
    username: "test",
    group: "Registered",
    isManual: false,
  },
  {
    polledAt: RECENT_POLL,
    uploadedBytes: String(250 * GiB),
    downloadedBytes: "0",
    bufferBytes: "0",
    ratio: 1.2,
    ratioIsInfinite: false,
    seedingCount: 4,
    leechingCount: 0,
    seedbonus: null,
    hitAndRuns: 0,
    requiredRatio: 1,
    warned: false,
    freeleechTokens: null,
    shareScore: null,
    username: "test",
    group: "Registered",
    isManual: false,
  },
] as Snapshot[]

function renderPanel(registrySlug = "torrentleech") {
  return render(
    <RankGoalPanel
      trackerId={1}
      registrySlug={registrySlug}
      userClasses={torrentleech.userClasses}
      currentRank="Registered"
      stats={stats}
      snapshots={snapshots}
      joinedAt={JOINED_AT}
      lastPolledAt={RECENT_POLL}
      accentColor="#2ecc71"
    />
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/settings" && init?.method === "PATCH") {
        return Promise.resolve(new Response("{}", { status: 200 }))
      }
      return Promise.resolve(
        new Response(JSON.stringify({ rankGoals: null }), { status: 200 })
      )
    })
  )
})

describe("RankGoalPanel", () => {
  it("shows verified values, an unknown upload unit and no eligibility", async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByText(/2 met · 0 unmet · 1 unknown/)).toBeInTheDocument())
    expect(screen.getByText(/Upload requirement is unknown/)).toBeInTheDocument()
    expect(screen.queryByText(/promotion still depends/)).not.toBeInTheDocument()
    expect(screen.getByText(/Upload estimate:/)).toHaveTextContent(/unit unresolved/)
    expect(screen.getByText(/Observed current rank: Registered/)).toBeInTheDocument()
  })

  it("keeps an unsupported tracker on its existing ladder text", async () => {
    renderPanel("unknown-tracker")
    expect(screen.getByText(/Structured rank progress is unavailable/)).toBeInTheDocument()
  })

  it("explains unavailable structured progress for unresolved pilots", async () => {
    renderPanel("myanonamouse")
    expect(screen.getByText(/Structured rank progress is unavailable/)).toBeInTheDocument()
  })

  it("persists a selected target rank", async () => {
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(screen.getByLabelText("Target rank")).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText("Target rank"), "Super User")
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/settings",
        expect.objectContaining({ method: "PATCH" })
      )
    )
  })
})
