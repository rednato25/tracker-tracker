import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RankOverview } from "@/components/dashboard/RankOverview"
import { UNKNOWN_COLLECTED } from "@/lib/rank-overview"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-30T12:00:00.000Z")
const TIB = 1024 ** 4

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

describe("RankOverview", () => {
  it("shows the current class, target and every condition in its own row", () => {
    render(
      <RankOverview
        trackers={[tracker()]}
        savedGoals={{ "1": { targetRank: "Super User" } }}
        now={NOW}
      />
    )
    expect(screen.getByRole("heading", { name: "Ranks" })).toBeInTheDocument()
    expect(screen.getByText("Power User")).toBeInTheDocument()
    expect(screen.getByText("Target: Super User")).toBeInTheDocument()
    expect(screen.getByText("At least 12 weeks registered")).toBeInTheDocument()
    expect(screen.getByText("302 days")).toBeInTheDocument()
    expect(screen.getByText("84 days")).toBeInTheDocument()
    expect(screen.getAllByText("Met").length).toBeGreaterThan(0)
    expect(document.querySelectorAll("[data-rank-condition]")).toHaveLength(3)
  })

  it("writes why an unknown condition has no current value", () => {
    render(
      <RankOverview
        trackers={[
          tracker({
            latestStats: { ...BASE_STATS, uploadedBytes: null },
          }),
        ]}
        savedGoals={{ "1": { targetRank: "Power User" } }}
        now={NOW}
      />
    )
    expect(screen.getAllByText(UNKNOWN_COLLECTED).length).toBeGreaterThan(0)
    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0)
  })

  it("shows registry text when no structured conditions are published", () => {
    render(
      <RankOverview
        trackers={[
          tracker({
            id: 2,
            name: "Aither",
            registrySlug: "aither",
            latestStats: { ...BASE_STATS, group: "Phobos" },
          }),
        ]}
        savedGoals={{}}
        now={NOW}
      />
    )
    expect(screen.getByText("Next automatic class: Harmonia")).toBeInTheDocument()
    expect(screen.getByText("No structured conditions are published for this class.")).toBeInTheDocument()
    expect(screen.getByText(/Registry text:/)).toBeInTheDocument()
  })
})
