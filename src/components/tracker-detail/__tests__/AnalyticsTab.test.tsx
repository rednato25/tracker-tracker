import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AnalyticsTab } from "@/components/tracker-detail/AnalyticsTab"
import type { Snapshot, TrackerSummary } from "@/types/api"

vi.mock("@/components/tracker-detail/AnalyticsCharts", () => ({
  AnalyticsCharts: () => null,
}))
vi.mock("@/components/tracker-detail/PollLog", () => ({
  PollLog: () => null,
}))

const tracker = {
  id: 1,
  name: "Zenith",
  baseUrl: "https://zenith.invalid",
  registrySlug: "zenith",
  platformType: "unit3d",
  isActive: true,
  color: "#22c55e",
  lastPolledAt: "2026-08-14T12:00:00.000Z",
  lastError: null,
  lastErrorAt: null,
  userPausedAt: null,
} as TrackerSummary

const snapshots = [
  {
    polledAt: "2026-08-01T12:00:00.000Z",
    group: "User",
  },
  {
    polledAt: "2026-08-14T12:00:00.000Z",
    group: "Explorer",
  },
] as Snapshot[]

describe("AnalyticsTab promotion history", () => {
  it("renders the promotion history in the data tab", () => {
    const { container } = render(
      <AnalyticsTab
        tracker={tracker}
        snapshots={snapshots}
        stats={null}
        latestSnapshot={null}
        gazelleMeta={null}
        accentColor="#22c55e"
        days={30}
        onDaysChange={vi.fn()}
        delta={null}
        userClasses={[{ name: "User" }, { name: "Explorer" }]}
        statCardSlots={[]}
        progressSlots={[]}
      />
    )

    const history = container.querySelector("[data-promotion-history]")
    expect(history).not.toBeNull()
    expect(history).toHaveTextContent("Promotion history")
    expect(history).toHaveTextContent("User")
    expect(history).toHaveTextContent("Explorer")
    expect(history?.querySelector('[data-direction="promotion"]')).not.toBeNull()
    expect(screen.getByText("Promotion history")).toBeInTheDocument()
  })
})
