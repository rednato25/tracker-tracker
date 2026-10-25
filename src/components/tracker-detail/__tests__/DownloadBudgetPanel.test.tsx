import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
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
    await user.type(screen.getByLabelText("Download size (GiB)"), "80")
    await user.selectOptions(screen.getByLabelText("How is it charged?"), "1")
    await user.click(screen.getByText(/Advanced: committed traffic and reserve/))
    await user.clear(screen.getByLabelText("Reserve (GiB)"))
    await user.type(screen.getByLabelText("Reserve (GiB)"), "100")
    expect(await screen.findByText(/Projected ratio/)).toBeInTheDocument()
    expect(screen.getByText(/1\.72/)).toBeInTheDocument()
    expect(screen.getByText(/320(?:\.00)? GiB/)).toBeInTheDocument()
    expect(screen.getByText(/Seeding and H&R obligations remain separate/)).toBeInTheDocument()
  })

  it("keeps unknown accounting unavailable and freeleech explicitly scenario-only", async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.type(screen.getByLabelText("Download size (GiB)"), "80")
    expect(await screen.findByText(/Choose how this download is charged/)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText("How is it charged?"), "0")
    expect(await screen.findByText("Scenario only")).toBeInTheDocument()
    expect(screen.getByText(/Freeleech is a scenario/)).toBeInTheDocument()
  })

  it("discloses a target below the tracker minimum", async () => {
    const user = userEvent.setup()
    renderPanel()
    const target = screen.getByLabelText("Your target ratio")
    await user.clear(target)
    await user.type(target, "0.5")
    expect(await screen.findByText(/below the known tracker minimum/)).toBeInTheDocument()
  })

  it("adds, edits and removes planning entries with cumulative results", async () => {
    const user = userEvent.setup()
    renderPanel()
    const size = screen.getByLabelText("Download size (GiB)")
    await user.type(size, "40")
    await user.selectOptions(screen.getByLabelText("How is it charged?"), "1")
    await user.click(screen.getByRole("button", { name: "Add to simulation" }))
    await user.clear(size)
    await user.type(size, "60")
    await user.selectOptions(screen.getByLabelText("How is it charged?"), "0.5")
    await user.click(screen.getByRole("button", { name: "Add to simulation" }))
    expect(await screen.findByText(/Saved simulation/)).toBeInTheDocument()
    expect(screen.getByText(/Remaining allowance:/)).toBeInTheDocument()
    expect(screen.getAllByText(/GiB/).length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0])
    expect(size).toHaveValue("40")
    await user.click(screen.getAllByRole("button", { name: "Remove" })[1])
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1)
  })

  it("reproduces the reported queue: 235 charged, 1.08 ratio and 65 GiB remaining", async () => {
    const user = userEvent.setup()
    renderPanel({
      stats: {
        ...stats,
        uploadedBytes: String(900 * GiB),
        downloadedBytes: String(600 * GiB),
      },
    })
    const add = async (sizeGiB: string, charge: string) => {
      const field = screen.getByLabelText("Download size (GiB)")
      await user.clear(field)
      await user.type(field, sizeGiB)
      await user.selectOptions(screen.getByLabelText("How is it charged?"), charge)
      await user.click(screen.getByRole("button", { name: "Add to simulation" }))
    }
    await add("50", "0")
    await add("15", "0")
    await add("155", "1")
    await add("80", "1")
    expect(await screen.findByText(/Projected ratio:/)).toHaveTextContent(/1\.08/)
    expect(screen.getByText(/Remaining allowance:/)).toHaveTextContent(/65(?:\.0+)? GiB/)
    expect(
      screen.getAllByText(/Charged download:/).some((el) => /235(?:\.0+)? GiB/.test(el.textContent ?? ""))
    ).toBe(true)
    expect(
      screen.getAllByText(/Total downloaded:/).some((el) => /835(?:\.0+)? GiB/.test(el.textContent ?? ""))
    ).toBe(true)
  })

  it("marks stale data and unavailable observations", () => {
    renderPanel({ lastPolledAt: "2026-01-01T00:00:00.000Z" })
    expect(screen.getByText(/stale/)).toBeInTheDocument()
    renderPanel({ stats: null })
    expect(screen.getAllByText(/Account data is unavailable/).length).toBeGreaterThan(0)
  })
})
