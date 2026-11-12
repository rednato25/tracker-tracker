import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RankGoalPanel } from "@/components/tracker-detail/RankGoalPanel"
import { dreadvault } from "@/data/trackers/dreadvault"
import { torrentleech } from "@/data/trackers/torrentleech"
import type { PlatformMeta, TrackerLatestStats } from "@/types/api"

const GiB = 1024 ** 3
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const RECENT_POLL = new Date(Date.now() - HOUR_MS).toISOString()
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


function renderPanel(
  registrySlug = "torrentleech",
  polledAt = RECENT_POLL,
  statsOverride: TrackerLatestStats = stats,
  platformMeta: PlatformMeta | null = null,
  joinedAt = JOINED_AT
) {
  return render(
    <RankGoalPanel
      trackerId={1}
      trackerName="TorrentLeech"
      registrySlug={registrySlug}
      userClasses={torrentleech.userClasses}
      currentRank="Registered"
      stats={statsOverride}
      joinedAt={joinedAt}
      lastPolledAt={polledAt}
      accentColor="#2ecc71"
      platformType="unit3d"
      platformMeta={platformMeta}
    />
  )
}

let rankGoalsResponse: string | null = null

beforeEach(() => {
  rankGoalsResponse = null
  vi.restoreAllMocks()
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/settings" && init?.method === "PATCH") {
        return Promise.resolve(new Response("{}", { status: 200 }))
      }
      return Promise.resolve(
        new Response(JSON.stringify({ rankGoals: rankGoalsResponse }), { status: 200 })
      )
    })
  )
})

describe("RankGoalPanel", () => {
  it("marks a stopped profile read and keeps the stale values visible", async () => {
    rankGoalsResponse = JSON.stringify({ "1": { targetRank: "Power User" } })
    render(
      <RankGoalPanel
        trackerId={1}
        trackerName="Upload.cx"
        registrySlug="uploadcx"
        userClasses={torrentleech.userClasses}
        currentRank="Registered"
        stats={stats}
        joinedAt={JOINED_AT}
        lastPolledAt={RECENT_POLL}
        accentColor="#2ecc71"
        platformType="unit3d"
        platformMeta={{
          profileRead: {
            fetchedAt: new Date(Date.now() - 3 * HOUR_MS).toISOString(),
            attemptedAt: new Date(Date.now() - HOUR_MS).toISOString(),
            status: "session_expired",
            values: { seedSizeBytes: 6 * GiB },
          },
        }}
      />
    )

    await waitFor(() => expect(screen.getByText("Session expired.")).toBeInTheDocument())
    expect(screen.getByText(/last values are out of date/)).toBeInTheDocument()
  })

  it("tells the user to turn on profile reading when the ladder needs seed values", async () => {
    render(
      <RankGoalPanel
        trackerId={1}
        trackerName="DreadVault"
        registrySlug="dreadvault"
        userClasses={dreadvault.userClasses}
        currentRank={null}
        stats={stats}
        joinedAt={JOINED_AT}
        lastPolledAt={RECENT_POLL}
        accentColor="#2ecc71"
        platformType="unit3d"
        platformMeta={null}
        profileReadingEnabled={false}
      />
    )
    await waitFor(() =>
      expect(document.querySelector("[data-profile-hint]")).toHaveTextContent(
        /Read profile page daily/
      )
    )
  })

  it("leaves the stopped-read notice alone instead of adding a second hint", async () => {
    render(
      <RankGoalPanel
        trackerId={1}
        trackerName="DreadVault"
        registrySlug="dreadvault"
        userClasses={dreadvault.userClasses}
        currentRank={null}
        stats={stats}
        joinedAt={JOINED_AT}
        lastPolledAt={RECENT_POLL}
        accentColor="#2ecc71"
        platformType="unit3d"
        profileReadingEnabled
        hasProfileCookie
        platformMeta={{
          profileRead: {
            fetchedAt: new Date(Date.now() - 3 * HOUR_MS).toISOString(),
            attemptedAt: new Date(Date.now() - HOUR_MS).toISOString(),
            status: "session_expired",
            values: {},
          },
        }}
      />
    )
    await waitFor(() => expect(screen.getByText("Session expired.")).toBeInTheDocument())
    expect(document.querySelector("[data-profile-hint]")).toBeNull()
  })

  it("shows verified values and never estimates an upload date from the trend", async () => {
    rankGoalsResponse = JSON.stringify({ "1": { targetRank: "Power User" } })
    renderPanel()
    await waitFor(() => expect(screen.getByText(/3 of \d+/)).toBeInTheDocument())
    // DESIGN.md: no ETA from transfer trends.
    expect(document.body.textContent ?? "").not.toMatch(/estimate|trend/i)
    expect(document.querySelectorAll("[data-rank-condition-bar]").length).toBeGreaterThan(0)
    expect(document.querySelectorAll("[data-threshold-tick]").length).toBeGreaterThan(0)
  })

  it("keeps an unsupported tracker on its existing ladder text", async () => {
    renderPanel("unknown-tracker")
    expect(
      screen.getByText(/No next-class requirements are published|From tracker rules/)
    ).toBeInTheDocument()
  })

  it("explains unavailable structured progress for unresolved pilots", async () => {
    renderPanel("aither")
    expect(
      screen.getByText(/From tracker rules|No next-class requirements/)
    ).toBeInTheDocument()
  })

  it("shows an explicit no-target state and a non-persisted next-rank suggestion", async () => {
    renderPanel()
    expect(
      await screen.findByRole("button", { name: "Use Power User as target" })
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Target rank")).toHaveValue("")
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({ method: "PATCH" })
    )
  })

  it("saves a selected target and preserves another tracker goal", async () => {
    rankGoalsResponse = JSON.stringify({ "99": { targetRank: "Power User" } })
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(screen.getByLabelText("Target rank")).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText("Target rank"), "Super User")
    await waitFor(() => {
      const patch = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "PATCH")
      expect(patch).toBeDefined()
      const body = JSON.parse(String(patch?.[1]?.body)) as {
        rankGoals: Record<string, { targetRank: string }>
      }
      expect(body.rankGoals["1"]).toEqual({ targetRank: "Super User" })
      expect(body.rankGoals["99"]).toEqual({ targetRank: "Power User" })
    })
  })

  it("clears only this tracker goal and reloads without a target", async () => {
    rankGoalsResponse = JSON.stringify({
      "1": { targetRank: "Power User" },
      "99": { targetRank: "Power User" },
    })
    const user = userEvent.setup()
    const first = renderPanel()
    await waitFor(() => expect(screen.getByLabelText("Target rank")).toHaveValue("Power User"))
    await user.click(screen.getByRole("button", { name: "Clear target" }))
    await waitFor(() => {
      const patch = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "PATCH")
      const body = JSON.parse(String(patch?.[1]?.body)) as {
        rankGoals: Record<string, { targetRank: string }>
      }
      expect(body.rankGoals["1"]).toBeUndefined()
      expect(body.rankGoals["99"]).toEqual({ targetRank: "Power User" })
    })
    expect(screen.getByLabelText("Target rank")).toHaveValue("")
    first.unmount()
    rankGoalsResponse = JSON.stringify({ "99": { targetRank: "Power User" } })
    renderPanel()
    await waitFor(() => expect(screen.getByLabelText("Target rank")).toHaveValue(""))
    expect(screen.getByRole("button", { name: /^Use .* as target$/ })).toBeInTheDocument()
  })

  it("keeps a stale ratio unknown without blaming the unresolved upload unit", async () => {
    rankGoalsResponse = JSON.stringify({ "1": { targetRank: "Power User" } })
    renderPanel("torrentleech", new Date(Date.now() - 25 * HOUR_MS).toISOString())
    const ratioLabel = (await screen.findAllByText("Ratio above 1.1"))[0]
    const row = ratioLabel.closest("li")
    expect(row).not.toBeNull()
    if (!row) return
    expect(within(row).getByText("Unknown")).toBeInTheDocument()
    expect(within(row).queryByText(/stale/i)).not.toBeInTheDocument()
  })

  it("states in one line whether the rules were checked, with a formatted date", async () => {
    rankGoalsResponse = JSON.stringify({ "1": { targetRank: "Power User" } })
    const { container } = renderPanel()
    await waitFor(() => expect(container.querySelector("[data-rank-source]")).not.toBeNull())
    const source = container.querySelector("[data-rank-source]")?.textContent ?? ""
    expect(source).toMatch(
      /Rules checked against the site on [A-Z][a-z]{2} \d{1,2}, \d{4}\.|These rules have not been checked against the site yet\./
    )
    expect(source).toMatch(/Ranks view/)
    expect(document.body.textContent ?? "").not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
  })
  it("writes the strict requirement and draws a shortfall marker at equality", async () => {
    rankGoalsResponse = JSON.stringify({ "1": { targetRank: "Power User" } })
    renderPanel("torrentleech", RECENT_POLL, { ...stats, ratio: 1.1 })
    const ratioLabel = (await screen.findAllByText("Ratio above 1.1"))[0]
    const row = ratioLabel.closest("li")
    expect(row).not.toBeNull()
    if (!row) return
    expect(within(row).getByText("Needs above 1.10, now 1.10")).toBeInTheDocument()
    expect(row.querySelector("[data-shortfall-marker]")).not.toBeNull()
    expect(row.querySelector("[data-bar-fill]")?.getAttribute("style")).toContain("width: 0%")
  })

  it("renders one compact row per condition and no debug details", async () => {
    rankGoalsResponse = JSON.stringify({ "1": { targetRank: "Power User" } })
    const { container } = renderPanel()
    await waitFor(() => expect(container.querySelectorAll("[data-rank-condition]")).toHaveLength(3))
    expect(screen.queryByText("Details")).not.toBeInTheDocument()
    expect(container.querySelector("[data-rank-details]")).toBeNull()
    expect(container.textContent ?? "").not.toMatch(/source=|freshness=|unresolved:/)
    for (const row of container.querySelectorAll("[data-rank-condition]")) {
      expect(row.querySelector("[data-rank-condition-bar]")).not.toBeNull()
      expect(row.textContent).toMatch(/ \/ /)
    }
  })

  it("shows an unmet account-age wait in neutral text instead of red", async () => {
    rankGoalsResponse = JSON.stringify({ "1": { targetRank: "Super User" } })
    const joined = new Date(Date.now() - 70 * DAY_MS).toISOString()
    const { container } = renderPanel(
      "torrentleech",
      RECENT_POLL,
      {
        ...stats,
        uploadedBytes: String(2 * 1024 * GiB),
        ratio: 3,
      },
      null,
      joined
    )
    const ageLabel = (await screen.findAllByText("At least 12 weeks registered"))[0]
    const row = ageLabel.closest("li")
    expect(row).not.toBeNull()
    if (!row) return
    expect(row).toHaveAttribute("data-time-only", "true")
    const status = within(row).getByText(/in 1[234] days/)
    expect(status.className).toContain("text-secondary")
    expect(status.className).not.toContain("text-danger")
    expect(row.querySelector("[data-bar-fill]")?.className).toContain("bg-secondary")
    expect(row.querySelector("[data-bar-fill]")?.className).not.toContain("bg-danger")
    expect(container.querySelector("[data-rank-goal-panel]")).toBeInTheDocument()
  })

  it("keeps red for an actionable unmet condition", async () => {
    rankGoalsResponse = JSON.stringify({ "1": { targetRank: "Super User" } })
    const joined = new Date(Date.now() - 90 * DAY_MS).toISOString()
    renderPanel(
      "torrentleech",
      RECENT_POLL,
      { ...stats, uploadedBytes: String(250 * GiB), ratio: 3 },
      null,
      joined
    )
    const uploadLabel = (await screen.findAllByText("More than 1 TiB uploaded"))[0]
    const row = uploadLabel.closest("li")
    expect(row).not.toBeNull()
    if (!row) return
    expect(row).toHaveAttribute("data-time-only", "false")
    const status = within(row).getByText("Not met")
    expect(status.className).toContain("text-danger")
    expect(row.querySelector("[data-bar-fill]")?.className).toContain("bg-danger")
  })

  it("puts Enter value inline next to Unknown", async () => {
    rankGoalsResponse = JSON.stringify({ "1": { targetRank: "Shadow Walker" } })
    const user = userEvent.setup()
    const { container } = render(
      <RankGoalPanel
        trackerId={1}
        trackerName="DreadVault"
        registrySlug="dreadvault"
        userClasses={dreadvault.userClasses}
        currentRank="User"
        stats={{ ...stats, group: "User" }}
        joinedAt={JOINED_AT}
        lastPolledAt={RECENT_POLL}
        accentColor="#2ecc71"
        platformType="unit3d"
        platformMeta={null}
        onSaveManualValue={vi.fn().mockResolvedValue(undefined)}
        onClearManualValue={vi.fn().mockResolvedValue(undefined)}
      />
    )
    const seedSize = (await screen.findAllByText("Seed size ≥ 5 TiB"))[0]
    const row = seedSize.closest("li")
    expect(row).not.toBeNull()
    if (!row) return
    expect(within(row).getByText("Unknown")).toBeInTheDocument()
    const enter = within(row).getByText("Enter value")
    expect(enter.tagName).toBe("BUTTON")
    await user.click(enter)
    expect(
      within(row).getByLabelText("Value for Seed size ≥ 5 TiB on DreadVault")
    ).toBeInTheDocument()
    expect(container.querySelector("[data-rank-details]")).toBeNull()
  })
})
