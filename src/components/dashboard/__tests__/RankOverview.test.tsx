import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import { RankOverview } from "@/components/dashboard/RankOverview"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-30T12:00:00.000Z")
const TIB = 1024 ** 4
const noopSave = vi.fn(async () => {})

const BASE_STATS: TrackerLatestStats = {
  ratio: 2.4,
  ratioIsInfinite: false,
  uploadedBytes: String(2 * TIB),
  downloadedBytes: String(1 * TIB),
  bufferBytes: String(1 * TIB),
  seedingCount: 8,
  leechingCount: 1,
  requiredRatio: 1,
  warned: false,
  freeleechTokens: 0,
  hitAndRuns: 0,
  seedbonus: 1234,
  shareScore: null,
  username: "owner",
  group: "Power User",
}

function tracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "TorrentLeech",
    baseUrl: "https://tl.invalid",
    registrySlug: "torrentleech",
    platformType: "unit3d",
    isActive: true,
    lastPolledAt: "2026-10-30T11:00:00.000Z",
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
    joinedAt: "2026-01-01T00:00:00.000Z",
    lastAccessAt: null,
    remoteUserId: null,
    platformMeta: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    latestStats: BASE_STATS,
    ...overrides,
  }
}

function overview(props: Partial<ComponentProps<typeof RankOverview>> = {}) {
  return (
    <RankOverview
      trackers={[tracker()]}
      savedGoals={{ "1": { targetRank: "Super User" } }}
      checks={{}}
      onSaveCheck={noopSave}
      now={NOW}
      {...props}
    />
  )
}

describe("RankOverview", () => {
  it("shows the current class, target and every condition in its own row", () => {
    render(overview())
    expect(screen.getByRole("heading", { name: "Ranks" })).toBeInTheDocument()
    expect(screen.getAllByText("Power User").length).toBeGreaterThan(0)
    expect(screen.getByText("Target: Super User")).toBeInTheDocument()
    expect(screen.getByText("At least 12 weeks registered")).toBeInTheDocument()
    expect(screen.getByText("302 days")).toBeInTheDocument()
    expect(screen.getByText("84 days")).toBeInTheDocument()
    expect(screen.getAllByText("Met").length).toBeGreaterThan(0)
    expect(document.querySelectorAll("[data-rank-condition]")).toHaveLength(3)
  })

  it("shows the registry source, verification status and a link to the tracker site", () => {
    render(overview())
    expect(screen.getByRole("link", { name: "Open TorrentLeech site" })).toHaveAttribute(
      "href",
      "https://www.torrentleech.org"
    )
    expect(screen.getByText("Published source")).toBeInTheDocument()
    expect(screen.getByText("TorrentLeech Wiki - User Classes")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /user_classes/ })).toHaveAttribute(
      "target",
      "_blank"
    )
    expect(screen.getAllByText(/12 weeks registered/).length).toBeGreaterThan(0)
  })

  it("names the tracker API and offers Enter value for an unknown condition", async () => {
    const user = userEvent.setup()
    const onEnterValue = vi.fn()
    render(
      overview({
        trackers: [tracker({ latestStats: { ...BASE_STATS, uploadedBytes: null } })],
        savedGoals: { "1": { targetRank: "Power User" } },
        onEnterValue,
      })
    )
    expect(
      screen.getAllByText("TorrentLeech's API doesn't report uploaded bytes.").length
    ).toBeGreaterThan(0)
    const enter = screen.getAllByRole("button", { name: "Enter value" })[0]
    await user.click(enter)
    expect(onEnterValue).toHaveBeenCalledWith(1, expect.any(String))
  })

  it("shows registry text when no structured conditions are published", () => {
    render(
      overview({
        trackers: [
          tracker({
            id: 2,
            name: "Aither",
            registrySlug: "aither",
            latestStats: { ...BASE_STATS, group: "Phobos" },
          }),
        ],
        savedGoals: {},
      })
    )
    expect(screen.getByText("Next automatic class: Harmonia")).toBeInTheDocument()
    expect(
      screen.getByText("No structured conditions are published for this class.")
    ).toBeInTheDocument()
    expect(screen.getByText(/Registry text:/)).toBeInTheDocument()
    expect(screen.getByText("No registry source")).toBeInTheDocument()
  })

  it("counts checked, wrong and unchecked trackers at the top", () => {
    render(
      overview({
        trackers: [tracker(), tracker({ id: 2, name: "DreadVault", registrySlug: "dreadvault" })],
        checks: {
          "1": { verdict: "wrong", note: null, checkedAt: "2026-10-30" },
        },
      })
    )
    const summary = document.querySelector("[data-rank-check-summary]")
    expect(summary?.textContent).toContain("Checked 1")
    expect(summary?.textContent).toContain("Wrong 1")
    expect(summary?.textContent).toContain("Not checked 1")
  })

  it("saves a verdict with an optional note and the date checked", async () => {
    const save = vi.fn(async () => {})
    const user = userEvent.setup()
    render(overview({ onSaveCheck: save }))

    await user.click(screen.getByRole("button", { name: "Matches the site" }))
    await user.type(screen.getByLabelText("Note for TorrentLeech"), "Same thresholds")
    const date = screen.getByLabelText("Date checked for TorrentLeech") as HTMLInputElement
    await user.clear(date)
    await user.type(date, "2026-10-29")
    await user.click(screen.getByRole("button", { name: "Save check" }))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save).toHaveBeenCalledWith(1, {
      verdict: "matches",
      note: "Same thresholds",
      checkedAt: "2026-10-29",
    })
  })

  it("shows a saved wrong check and clears it", async () => {
    const save = vi.fn(async () => {})
    const user = userEvent.setup()
    render(
      overview({
        checks: {
          "1": { verdict: "wrong", note: "Upload is 300 GiB", checkedAt: "2026-10-28" },
        },
        onSaveCheck: save,
      })
    )
    expect(screen.getByText("Checked Oct 28, 2026")).toBeInTheDocument()
    expect(screen.getByLabelText("Note for TorrentLeech")).toHaveValue("Upload is 300 GiB")
    await user.click(screen.getByRole("button", { name: "Clear" }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(1, null))
  })

  it("hides staff and off-ladder classes behind Show all classes", async () => {
    const user = userEvent.setup()
    render(overview())

    expect(screen.getByText("Registered")).toBeInTheDocument()
    expect(screen.queryByText("VIP")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Show all classes" }))
    const vip = screen.getByText("VIP")
    expect(vip.closest("[data-rank-class]")).toHaveAttribute("data-outside-ladder", "above")
    expect(screen.getByText("off-ladder")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Show earned classes" }))
    expect(screen.queryByText("VIP")).not.toBeInTheDocument()
  })

  it("copies the whole overview as Markdown", async () => {
    const writeText = vi.fn(async (_text: string) => {})
    const user = userEvent.setup()
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    })
    render(
      overview({
        checks: {
          "1": { verdict: "wrong", note: "Site says 200 GiB", checkedAt: "2026-10-30" },
        },
      })
    )

    await user.click(screen.getByRole("button", { name: "Copy as Markdown" }))
    expect(writeText).toHaveBeenCalledTimes(1)
    const markdown = writeText.mock.calls[0][0] as string
    expect(markdown).toContain("## TorrentLeech")
    expect(markdown).toContain("| At least 12 weeks registered |")
    expect(markdown).toContain("My check: Wrong \u2014 Site says 200 GiB")
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument()
  })

  it("reports a failed save instead of pretending it worked", async () => {
    const save = vi.fn(async () => {
      throw new Error("nope")
    })
    const user = userEvent.setup()
    render(overview({ onSaveCheck: save }))

    await user.click(screen.getByRole("button", { name: "Wrong" }))
    await user.click(screen.getByRole("button", { name: "Save check" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save this check. Try again."
    )
  })
})