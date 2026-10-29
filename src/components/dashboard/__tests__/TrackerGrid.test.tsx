import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { TrackerGrid } from "@/components/dashboard/TrackerGrid"
import type { RankGoalSummary } from "@/lib/rank-summary"
import type { TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-28T12:00:00.000Z")
const TIB = 1024 ** 4

function tracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "TorrentLeech",
    baseUrl: "https://tl.invalid",
    registrySlug: "torrentleech",
    platformType: "unit3d",
    isActive: true,
    lastPolledAt: "2026-10-28T11:00:00.000Z",
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    color: "#6d56eb",
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
    },
    ...overrides,
  }
}

function summary(overrides: Partial<RankGoalSummary> = {}): RankGoalSummary {
  return {
    trackerId: 1,
    trackerName: "TorrentLeech",
    color: "#6d56eb",
    currentRank: "Power User",
    currentRankHidden: false,
    targetRank: "Elite",
    targetInvalid: false,
    automaticNextRank: null,
    status: "goal",
    metCount: 1,
    unmetCount: 1,
    unknownCount: 0,
    unmet: [],
    unknown: [],
    bars: [
      {
        id: "uploaded",
        label: "Uploaded",
        current: "2.00 TiB",
        required: "3.00 TiB",
        currentValue: 2 * TIB,
        requiredValue: 3 * TIB,
        comparison: "gte",
        status: "unmet",
        metric: "uploadedBytes",
      },
      {
        id: "accountAgeDays",
        label: "Account age",
        current: "300 days",
        required: "30 days",
        currentValue: 300,
        requiredValue: 30,
        comparison: "gte",
        status: "met",
        metric: "accountAgeDays",
      },
    ],
    totalChecks: 2,
    distanceText: "Elite: 1.00 TiB upload left",
    nextRankRequirements: null,
    linkLabel: "Open rank goal",
    linkHref: "/trackers/1#rank-goal",
    ...overrides,
  }
}

describe("TrackerGrid", () => {
  it("renders the stat grid and rank target bars as current / required", () => {
    render(<TrackerGrid trackers={[tracker()]} summaries={[summary()]} now={NOW} />)
    expect(screen.getByRole("heading", { name: "Trackers" })).toBeInTheDocument()
    expect(screen.getByText("TorrentLeech")).toBeInTheDocument()
    expect(screen.getByText("Power User")).toBeInTheDocument()
    expect(screen.getByText("2.00 TiB")).toBeInTheDocument()
    expect(screen.getByText("1.00 TiB")).toBeInTheDocument()
    expect(screen.getByText("8")).toBeInTheDocument()
    expect(screen.getByText("1,234")).toBeInTheDocument()
    expect(screen.getByText("2.00 TiB / 3.00 TiB")).toBeInTheDocument()
    expect(screen.getByText("300 days / 30 days")).toBeInTheDocument()
    expect(screen.getAllByText("Unmet").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Met").length).toBeGreaterThan(0)
    expect(document.querySelectorAll("[data-threshold-tick]").length).toBeGreaterThan(0)
    expect(screen.getByRole("link", { name: /TorrentLeech/ })).toHaveAttribute(
      "href",
      "/trackers/1"
    )
  })

  it("keeps a tracker with no stats explicitly unknown", () => {
    render(
      <TrackerGrid
        trackers={[tracker({ latestStats: null })]}
        summaries={[summary({ bars: [], status: "unsupported" })]}
        now={NOW}
      />
    )
    expect(screen.getAllByText("—").length).toBeGreaterThan(0)
    expect(
      screen.getByText("No next-class requirements are published for this tracker.")
    ).toBeInTheDocument()
  })

  it("caps the visible rank bars and reports the remainder", () => {
    const bars = Array.from({ length: 5 }, (_, index) => ({
      ...summary().bars[0],
      id: `bar-${index}`,
      label: `Requirement ${index}`,
    }))
    render(
      <TrackerGrid
        trackers={[tracker()]}
        summaries={[summary({ bars })]}
        now={NOW}
      />
    )
    expect(screen.getByText("Requirement 2")).toBeInTheDocument()
    expect(screen.queryByText("Requirement 3")).not.toBeInTheDocument()
    expect(screen.getByText("+2 more checks")).toBeInTheDocument()
  })
})
