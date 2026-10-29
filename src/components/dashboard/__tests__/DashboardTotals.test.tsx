import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { DashboardTotals } from "@/components/dashboard/DashboardTotals"
import { computeAggregateStats } from "@/lib/dashboard"
import type { Snapshot, TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-28T12:00:00.000Z")
const GIB = 1024 ** 3

function tracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "Tracker",
    latestStats: {
      ratio: 2,
      ratioIsInfinite: false,
      uploadedBytes: String(2 * GIB),
      downloadedBytes: String(1 * GIB),
      bufferBytes: String(1 * GIB),
      seedingCount: 4,
      leechingCount: 0,
      requiredRatio: 1,
      warned: false,
      freeleechTokens: 0,
      hitAndRuns: 0,
      seedbonus: 10,
      shareScore: null,
      username: "owner",
      group: "Power User",
    },
    lastPolledAt: "2026-10-28T11:00:00.000Z",
    ...overrides,
  } as TrackerSummary
}

function snapshot(): Snapshot {
  return {
    polledAt: "2026-10-28T11:00:00.000Z",
    uploadedBytes: String(2 * GIB),
    downloadedBytes: String(1 * GIB),
    bufferBytes: String(1 * GIB),
    isManual: false,
  } as Snapshot
}

describe("DashboardTotals", () => {
  it("renders the five required tiles", () => {
    const items = [tracker()]
    const { container } = render(
      <DashboardTotals
        trackers={items}
        aggregateStats={computeAggregateStats(items)}
        attentionCount={1}
        snapshotMap={new Map([[1, [snapshot()]]])}
        now={NOW}
      />
    )
    expect(container.querySelectorAll("[data-total-tile]")).toHaveLength(5)
    expect(screen.getByText("Uploaded")).toBeInTheDocument()
    expect(screen.getByText("Downloaded")).toBeInTheDocument()
    expect(screen.getByText("Buffer")).toBeInTheDocument()
    expect(screen.getByText("Overall ratio")).toBeInTheDocument()
    expect(screen.getByText("Need attention")).toBeInTheDocument()
    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.getByText("Action required")).toBeInTheDocument()
  })

  it("shows unknown instead of zero when no tracker has a snapshot", () => {
    render(
      <DashboardTotals
        trackers={[tracker({ latestStats: null })]}
        aggregateStats={computeAggregateStats([tracker({ latestStats: null })])}
        attentionCount={0}
        snapshotMap={new Map()}
        now={NOW}
      />
    )
    expect(screen.getAllByText("—").length).toBeGreaterThan(0)
    expect(screen.queryByText("0 B")).not.toBeInTheDocument()
    expect(screen.getByText("0")).toBeInTheDocument()
    expect(screen.queryByText("00")).not.toBeInTheDocument()
    expect(screen.queryByText("All clear")).not.toBeInTheDocument()
    expect(screen.getByText("No known actions · coverage incomplete")).toBeInTheDocument()
  })
})
