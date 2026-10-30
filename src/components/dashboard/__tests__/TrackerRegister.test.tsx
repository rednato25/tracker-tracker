import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TrackerRegister } from "@/components/dashboard/TrackerRegister"
import { computeAggregateStats } from "@/lib/dashboard"
import type { TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-27T12:00:00.000Z")
function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key)
    },
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage())
})

const GIB = 1024 ** 3
const TIB = 1024 ** 4

function tracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "AlphaRatio",
    baseUrl: "https://alpharatio.invalid",
    registrySlug: "alpharatio",
    platformType: "unit3d",
    isActive: true,
    lastPolledAt: "2026-10-27T11:00:00.000Z",
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
      ratio: 2,
      ratioIsInfinite: false,
      uploadedBytes: String(1 * TIB),
      downloadedBytes: String(500 * GIB),
      bufferBytes: String(500 * GIB),
      seedingCount: 3,
      leechingCount: 0,
      requiredRatio: 1,
      warned: false,
      freeleechTokens: 0,
      hitAndRuns: 0,
      seedbonus: 1234,
      shareScore: null,
      username: "owner-name",
      group: "Power User",
    },
    ...overrides,
  }
}

describe("TrackerRegister transfer metrics", () => {
  it("renders populated uploaded, downloaded and tracker bonus values", () => {
    render(<TrackerRegister trackers={[tracker()]} now={NOW} />)
    expect(screen.getAllByText(/1\.00 TiB/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/500\.00 GiB/).length).toBeGreaterThan(0)
    expect(screen.getAllByText("1,234").length).toBeGreaterThan(0)
    expect(screen.getByText(/Transfer values and bonus are from the latest stored snapshot/)).toBeInTheDocument()
    expect(screen.getByText("Transfer")).toBeInTheDocument()
    expect(screen.getByText("Upload")).toBeInTheDocument()
    expect(screen.getByText("Download")).toBeInTheDocument()
    expect(screen.getByText("Bonus")).toBeInTheDocument()
    expect(screen.getAllByText("Checks").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Healthy").length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText("Checks: 3 of 4").length).toBeGreaterThan(0)
    expect(screen.queryByLabelText("stale snapshot")).not.toBeInTheDocument()
  })

  it("distinguishes confirmed zero from missing values", () => {
    render(
      <TrackerRegister
        trackers={[
          tracker({
            latestStats: {
              ...tracker().latestStats!,
              uploadedBytes: "0",
              downloadedBytes: "0",
              seedbonus: 0,
            },
          }),
        ]}
        now={NOW}
      />
    )
    expect(screen.getAllByText("0 MiB").length).toBeGreaterThan(0)
    expect(screen.getAllByText("0").length).toBeGreaterThan(0)
  })

  it("shows missing values with the snapshot distinction and never presents unsupported as zero", () => {
    render(<TrackerRegister trackers={[tracker({ latestStats: null })]} now={NOW} />)
    expect(screen.getAllByTitle("No snapshot yet; this value is missing.").length).toBeGreaterThan(0)
    expect(screen.queryByText("0 MiB")).not.toBeInTheDocument()

    render(
      <TrackerRegister
        trackers={[
          tracker({
            latestStats: {
              ...tracker().latestStats!,
              uploadedBytes: null,
              downloadedBytes: null,
              seedbonus: null,
            },
          }),
        ]}
        now={NOW}
      />
    )
    expect(screen.getAllByTitle("Not reported in the latest snapshot.").length).toBeGreaterThan(0)
  })

  it("marks a stale snapshot while keeping the stored values and age explanation", () => {
    render(
      <TrackerRegister
        trackers={[tracker({ lastPolledAt: "2026-10-27T08:00:00.000Z" })]}
        now={NOW}
      />
    )
    expect(screen.getAllByLabelText("stale snapshot").length).toBeGreaterThan(0)
    expect(screen.getAllByTitle(/is stale \(older than 2 hours\)/).length).toBeGreaterThan(0)
    expect(screen.getAllByTitle(/Snapshot polled .* ago/).length).toBeGreaterThan(0)
  })

  it("marks unknown snapshot age without pretending the values are fresh", () => {
    render(<TrackerRegister trackers={[tracker({ lastPolledAt: null })]} now={NOW} />)
    expect(screen.getAllByLabelText("snapshot age unknown").length).toBeGreaterThan(0)
    expect(screen.getAllByTitle(/freshness cannot be confirmed/).length).toBeGreaterThan(0)
  })

  it("replaces the status counts with account totals and attention", () => {
    const base = tracker()
    const trackers = [
      base,
      tracker({
        id: 2,
        name: "Beta",
        latestStats: { ...base.latestStats!, uploadedBytes: "0", downloadedBytes: "0" },
      }),
    ]
    render(
      <TrackerRegister
        trackers={trackers}
        aggregateStats={computeAggregateStats(trackers)}
        attentionCount={3}
        now={NOW}
      />
    )
    expect(screen.getByText("Total uploaded")).toBeInTheDocument()
    expect(screen.getByText("Total downloaded")).toBeInTheDocument()
    expect(screen.getByText("Overall ratio")).toBeInTheDocument()
    expect(screen.getByText("Need attention")).toBeInTheDocument()
    expect(screen.getAllByText("03").length).toBeGreaterThan(0)
  })

  it("labels totals from only trackers with a snapshot and marks included stale data", () => {
    const withStats = tracker()
    const stale = tracker({ id: 2, name: "Stale", lastPolledAt: "2026-10-27T08:00:00.000Z" })
    const missing = tracker({ id: 3, name: "Missing", latestStats: null, lastPolledAt: null })
    render(
      <TrackerRegister
        trackers={[withStats, stale, missing]}
        aggregateStats={computeAggregateStats([withStats, stale, missing])}
        now={NOW}
      />
    )
    expect(screen.getByText("Totals from 2 of 3 trackers with a snapshot.")).toBeInTheDocument()
    expect(screen.getAllByLabelText("stale snapshot").length).toBeGreaterThan(0)
  })

  it("does not expose username or sum bonus across independent tracker rows", () => {
    const other = tracker({
      id: 2,
      name: "BetaRatio",
      latestStats: { ...tracker().latestStats!, seedbonus: 2, username: "other-name" },
    })
    render(<TrackerRegister trackers={[tracker(), other]} now={NOW} />)
    expect(screen.queryByText("owner-name")).not.toBeInTheDocument()
    expect(screen.queryByText("other-name")).not.toBeInTheDocument()
    expect(screen.getAllByText("1,234").length).toBeGreaterThan(0)
    expect(screen.getAllByText("2").length).toBeGreaterThan(0)
    expect(screen.queryByText("1,236")).not.toBeInTheDocument()
  })

  it("can hide its totals when the dashboard owns the totals row", () => {
    render(<TrackerRegister trackers={[tracker()]} now={NOW} showTotals={false} />)
    expect(screen.queryByText("Total uploaded")).not.toBeInTheDocument()
    expect(screen.getByText("Account register")).toBeInTheDocument()
  })

  it("sorts the register by ratio, buffer, login due and rank", async () => {
    const user = userEvent.setup()
    const rows = [
      tracker({
        id: 1,
        name: "Alpha",
        registrySlug: "torrentleech",
        latestStats: { ...tracker().latestStats!, ratio: 1, bufferBytes: String(3 * TIB), group: "Registered" },
      }),
      tracker({
        id: 2,
        name: "Beta",
        registrySlug: "torrentleech",
        latestStats: { ...tracker().latestStats!, ratio: 3, bufferBytes: String(1 * TIB), group: "Power User" },
      }),
      tracker({
        id: 3,
        name: "Gamma",
        registrySlug: "torrentleech",
        latestStats: { ...tracker().latestStats!, ratio: 2, bufferBytes: String(2 * TIB), group: "Super User" },
      }),
    ]
    const { container } = render(<TrackerRegister trackers={rows} now={NOW} />)
    const table = container.querySelector("[data-register-table]") as HTMLElement
    const order = () =>
      within(table)
        .getAllByRole("link")
        .map((link) => link.textContent?.match(/Alpha|Beta|Gamma/)?.[0])

    await user.click(within(table).getByRole("button", { name: "Sort by Ratio" }))
    expect(order()).toEqual(["Alpha", "Gamma", "Beta"])
    expect(screen.getByRole("columnheader", { name: "Ratio" })).toHaveAttribute(
      "aria-sort",
      "ascending"
    )

    await user.click(within(table).getByRole("button", { name: "Sort by Ratio" }))
    expect(order()).toEqual(["Beta", "Gamma", "Alpha"])
    expect(screen.getByRole("columnheader", { name: "Ratio" })).toHaveAttribute(
      "aria-sort",
      "descending"
    )

    await user.click(within(table).getByRole("button", { name: "Sort by Buffer" }))
    expect(order()).toEqual(["Beta", "Gamma", "Alpha"])
    expect(screen.getByRole("columnheader", { name: "Buffer" })).toHaveAttribute(
      "aria-sort",
      "ascending"
    )

    await user.click(within(table).getByRole("button", { name: "Sort by Rank" }))
    expect(order()).toEqual(["Alpha", "Beta", "Gamma"])

    await user.click(within(table).getByRole("button", { name: "Sort by Login due" }))
    expect(screen.getByRole("columnheader", { name: "Login due" })).toHaveAttribute(
      "aria-sort",
      "ascending"
    )
  })
})
