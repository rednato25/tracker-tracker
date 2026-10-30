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
    expect(
      container
        .querySelector('[data-total-tile="need-attention"]')
        ?.getAttribute("data-total-tone")
    ).toBe("danger")
  })

  it("shows unknown instead of zero when no tracker has a snapshot", () => {
    const items = [tracker({ latestStats: null })]
    const { container } = render(
      <DashboardTotals
        trackers={items}
        aggregateStats={computeAggregateStats(items)}
        attentionCount={0}
        snapshotMap={new Map()}
        now={NOW}
      />
    )
    expect(screen.getAllByText("\u2014").length).toBeGreaterThan(0)
    expect(screen.queryByText("0 B")).not.toBeInTheDocument()
    expect(screen.getByText("0")).toBeInTheDocument()
    expect(screen.queryByText("00")).not.toBeInTheDocument()
    expect(screen.queryByText("All clear")).not.toBeInTheDocument()
    expect(screen.getByText("0 actions \u00b7 1 offline")).toBeInTheDocument()
    expect(
      container
        .querySelector('[data-total-tile="need-attention"]')
        ?.getAttribute("data-total-tone")
    ).toBe("warn")
  })

  it("names offline, stale and unverified coverage instead of claiming all clear", () => {
    const healthy = tracker()
    const offline = tracker({
      id: 2,
      name: "Offline",
      latestStats: null,
      lastPolledAt: null,
    })
    const stale = tracker({
      id: 3,
      name: "Stale",
      lastPolledAt: "2026-10-28T08:00:00.000Z",
    })
    const { container } = render(
      <DashboardTotals
        trackers={[healthy, offline, stale]}
        aggregateStats={computeAggregateStats([healthy, offline, stale])}
        attentionCount={0}
        snapshotMap={new Map()}
        now={NOW}
      />
    )
    expect(screen.getByText("0 actions \u00b7 1 offline \u00b7 1 stale")).toBeInTheDocument()
    expect(
      container
        .querySelector('[data-total-tile="need-attention"]')
        ?.getAttribute("data-total-tone")
    ).toBe("warn")
  })

  it("counts an unresolved verification item as incomplete coverage", () => {
    const items = [tracker()]
    const { container } = render(
      <DashboardTotals
        trackers={items}
        aggregateStats={computeAggregateStats(items)}
        attentionCount={0}
        verificationCount={1}
        snapshotMap={new Map([[1, [snapshot()]]])}
        now={NOW}
      />
    )
    expect(screen.getByText("0 actions \u00b7 1 needs verification")).toBeInTheDocument()
    expect(
      container
        .querySelector('[data-total-tile="need-attention"]')
        ?.getAttribute("data-total-tone")
    ).toBe("warn")
  })

  it("stays green only when coverage is complete", () => {
    const items = [tracker()]
    const { container } = render(
      <DashboardTotals
        trackers={items}
        aggregateStats={computeAggregateStats(items)}
        attentionCount={0}
        snapshotMap={new Map([[1, [snapshot()]]])}
        now={NOW}
      />
    )
    expect(screen.getByText("All clear")).toBeInTheDocument()
    expect(
      container
        .querySelector('[data-total-tile="need-attention"]')
        ?.getAttribute("data-total-tone")
    ).toBe("success")
  })
})
