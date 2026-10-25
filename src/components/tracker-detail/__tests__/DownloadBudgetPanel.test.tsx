import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { DownloadBudgetPanel } from "@/components/tracker-detail/DownloadBudgetPanel"
import type { TrackerLatestStats } from "@/types/api"

const GiB = 1024 ** 3
const stats: TrackerLatestStats = {
  ratio: 2,
  ratioIsInfinite: false,
  seedingCount: 4,
  leechingCount: 0,
  requiredRatio: 1,
  warned: false,
  freeleechTokens: 0,
  hitAndRuns: 0,
  seedbonus: 0,
  shareScore: 0,
  username: "test",
  group: "User",
  uploadedBytes: String(1000 * GiB),
  downloadedBytes: String(500 * GiB),
  bufferBytes: String(500 * GiB),
}

function renderPanel(overrides: { stats?: TrackerLatestStats | null; lastPolledAt?: string | null; registrySlug?: string | null } = {}) {
  return render(
    <DownloadBudgetPanel
      trackerId={1}
      registrySlug={overrides.registrySlug ?? "torrentleech"}
      stats={overrides.stats === undefined ? stats : overrides.stats}
      lastPolledAt={overrides.lastPolledAt === undefined ? new Date().toISOString() : overrides.lastPolledAt}
    />
  )
}

describe("DownloadBudgetPanel", () => {
  it("shows the formula result in human terms", async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.type(screen.getByLabelText("Proposed size (GiB)"), "80")
    await user.selectOptions(screen.getByLabelText("Accounting assumption"), "1")
    await user.clear(screen.getByLabelText("Charged reserve (GiB)"))
    await user.type(screen.getByLabelText("Charged reserve (GiB)"), "100")
    expect(await screen.findByText(/Projected ratio/)).toBeInTheDocument()
    expect(screen.getByText(/1\.72/)).toBeInTheDocument()
    expect(screen.getByText(/400(?:\.00)? GiB/)).toBeInTheDocument()
    expect(screen.getByText(/does not certify H&R/)).toBeInTheDocument()
  })

  it("keeps unknown accounting unavailable and freeleech explicitly scenario-only", async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.type(screen.getByLabelText("Proposed size (GiB)"), "80")
    expect(await screen.findByText("Unavailable")).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText("Accounting assumption"), "0")
    expect(await screen.findByText("Scenario only")).toBeInTheDocument()
    expect(screen.getAllByText(/Zero-charge scenario/).length).toBeGreaterThan(0)
  })

  it("discloses a target below the tracker minimum", async () => {
    const user = userEvent.setup()
    renderPanel()
    const target = screen.getByLabelText("Target ratio (yours)")
    await user.clear(target)
    await user.type(target, "0.5")
    expect(await screen.findByText(/below the known tracker minimum/)).toBeInTheDocument()
  })

  it("adds, edits and removes planning entries with cumulative results", async () => {
    const user = userEvent.setup()
    renderPanel()
    const size = screen.getByLabelText("Proposed size (GiB)")
    await user.type(size, "40")
    await user.selectOptions(screen.getByLabelText("Accounting assumption"), "1")
    await user.click(screen.getByRole("button", { name: "Add to scenario" }))
    await user.type(size, "60")
    await user.selectOptions(screen.getByLabelText("Accounting assumption"), "0.5")
    await user.click(screen.getByRole("button", { name: "Add to scenario" }))
    expect(await screen.findByText(/Cumulative:/)).toBeInTheDocument()
    expect(screen.getAllByText(/GiB/).length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0])
    expect(size).toHaveValue("40")
    await user.click(screen.getAllByRole("button", { name: "Remove" })[1])
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1)
  })

  it("marks stale data and unavailable observations", () => {
    renderPanel({ lastPolledAt: "2026-01-01T00:00:00.000Z" })
    expect(screen.getByText(/stale/)).toBeInTheDocument()
    renderPanel({ stats: null })
    expect(screen.getByText(/Accounted upload\/download data is unavailable/)).toBeInTheDocument()
  })
})
