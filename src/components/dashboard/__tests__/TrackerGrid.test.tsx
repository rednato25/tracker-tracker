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
    targetReached: false,
    automaticNextRank: null,
    nextRankName: null,
    nextIsTextOnly: false,
    highestAutomatic: false,
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
    expect(screen.getByText("Member since 1 Jan 2025")).toBeInTheDocument()
    expect(screen.getByText(/as of Oct 28, 2026/)).toBeInTheDocument()
    expect(screen.getByText("Power User")).toBeInTheDocument()
    expect(screen.getByText("Elite")).toBeInTheDocument()
    expect(screen.getByText("1 of 2 met")).toBeInTheDocument()
    expect(screen.queryByText(/upload left/)).not.toBeInTheDocument()
    expect(screen.getAllByLabelText("Checks: 3 of 4").length).toBeGreaterThan(0)
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

  it("shows member since and the duration, with no health word when healthy", () => {
    render(
      <TrackerGrid
        trackers={[tracker({ joinedAt: "2026-10-02" })]}
        summaries={[summary()]}
        now={NOW}
      />
    )
    expect(screen.getByText("Member since 2 Oct 2026")).toBeInTheDocument()
    expect(screen.getByText("26 days")).toBeInTheDocument()
    expect(screen.queryByText("Healthy")).not.toBeInTheDocument()
    expect(document.querySelector("[data-card-status]")).toBeNull()
  })

  it("shows years and calendar months once the account is older than a year", () => {
    render(
      <TrackerGrid
        trackers={[tracker({ joinedAt: "2021-08-01" })]}
        summaries={[summary()]}
        now={NOW}
      />
    )
    expect(screen.getByText("Member since 1 Aug 2021")).toBeInTheDocument()
    expect(screen.getByText("5 years, 2 months")).toBeInTheDocument()
  })

  it("marks a stale card with the register's star and a written status", () => {
    render(
      <TrackerGrid
        trackers={[tracker({ lastPolledAt: "2026-10-28T08:00:00.000Z" })]}
        summaries={[summary()]}
        now={NOW}
      />
    )
    expect(screen.getByText("Stale")).toBeInTheDocument()
    expect(screen.queryByText("Healthy")).not.toBeInTheDocument()
    expect(screen.getAllByLabelText("stale snapshot").length).toBeGreaterThan(0)
  })

  it("writes Paused and Login expired instead of the healthy word", () => {
    const { rerender } = render(
      <TrackerGrid
        trackers={[tracker({ userPausedAt: "2026-10-28T10:00:00.000Z" })]}
        summaries={[summary()]}
        now={NOW}
      />
    )
    expect(screen.getByText("Paused")).toBeInTheDocument()
    expect(screen.queryByText("Healthy")).not.toBeInTheDocument()

    rerender(
      <TrackerGrid
        trackers={[
          tracker({
            pausedAt: "2026-10-28T10:00:00.000Z",
            lastError: "Login expired, update credentials",
            lastErrorAt: "2026-10-28T10:00:00.000Z",
          }),
        ]}
        summaries={[summary()]}
        now={NOW}
      />
    )
    expect(screen.getByText("Login expired")).toBeInTheDocument()
    expect(screen.queryByText("Paused")).not.toBeInTheDocument()
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
    expect(screen.getByText("+2 more requirements")).toBeInTheDocument()
    expect(screen.getAllByLabelText("Checks: 3 of 4").length).toBeGreaterThan(0)
  })

  it("says Highest automatic class reached instead of No structured requirement", () => {
    render(
      <TrackerGrid
        trackers={[tracker({ latestStats: { ...tracker().latestStats!, group: "TL GOD" } })]}
        summaries={[
          summary({
            currentRank: "TL GOD",
            targetRank: null,
            automaticNextRank: null,
            highestAutomatic: true,
            bars: [],
            status: "no-target",
          }),
        ]}
        now={NOW}
      />
    )
    expect(screen.getByText("Highest automatic class reached")).toBeInTheDocument()
    expect(screen.queryByText("No structured requirement to show.")).not.toBeInTheDocument()
  })

  it("offers the next automatic class without dropping a reached saved target", () => {
    render(
      <TrackerGrid
        trackers={[tracker({ latestStats: { ...tracker().latestStats!, group: "Super User" } })]}
        summaries={[
          summary({
            currentRank: "Super User",
            targetRank: "Power User",
            targetReached: true,
            automaticNextRank: "Extreme User",
            distanceText: "Extreme User: 1.00 TiB upload left",
          }),
        ]}
        now={NOW}
      />
    )
    expect(screen.getByText("Super User")).toBeInTheDocument()
    expect(screen.getByText("Extreme User")).toBeInTheDocument()
    expect(screen.getByText("Automatic")).toBeInTheDocument()
    expect(screen.getByText("Target reached: Power User")).toBeInTheDocument()
  })

  it("marks an unsaved automatic next class as automatic", () => {
    render(
      <TrackerGrid
        trackers={[tracker()]}
        summaries={[
          summary({
            targetRank: null,
            automaticNextRank: "Elite",
            status: "no-target",
          }),
        ]}
        now={NOW}
      />
    )
    expect(screen.getByText("Power User")).toBeInTheDocument()
    expect(screen.getByText("Elite")).toBeInTheDocument()
    expect(screen.getByText("Automatic")).toBeInTheDocument()
    expect(screen.getByText("1 of 2 met")).toBeInTheDocument()
    expect(screen.queryByText(/upload left/)).not.toBeInTheDocument()
  })

  it("names a text-only next class and labels its rule text", () => {
    render(
      <TrackerGrid
        trackers={[tracker({ registrySlug: "v3x", name: "V3X" })]}
        summaries={[
          summary({
            targetRank: null,
            automaticNextRank: "Second rÃ´le",
            nextRankName: "Second rÃ´le",
            nextIsTextOnly: true,
            nextRankRequirements: "Level 10, 11 088 XP",
            bars: [],
            status: "unsupported",
          }),
        ]}
        now={NOW}
      />
    )
    expect(screen.getByText("From tracker rules (not tracked automatically)")).toBeInTheDocument()
    expect(screen.getByText("Second rÃ´le: Level 10, 11 088 XP")).toBeInTheDocument()
  })

  it("shows the failed-poll pause, next retry and plain error", () => {
    const pausedAt = "2026-10-28T10:00:00.000Z"
    const { container } = render(
      <TrackerGrid
        trackers={[
          tracker({
            pausedAt,
            lastErrorAt: pausedAt,
            consecutiveFailures: 5,
            lastError: "Request timed out",
            latestStats: null,
          }),
        ]}
        summaries={[summary({ bars: [], targetRank: null, status: "no-target" })]}
        now={NOW}
      />
    )
    const block = container.querySelector("[data-failed-poll-pause]") as HTMLElement
    expect(block).toHaveTextContent("Paused after 5 failed polls")
    expect(block).toHaveTextContent(/next retry \d{2}:\d{2}/)
    expect(block).toHaveTextContent("Timeout")
  })

  it("stops a login-expired pause without a next retry", () => {
    const pausedAt = "2026-10-28T10:00:00.000Z"
    const { container } = render(
      <TrackerGrid
        trackers={[
          tracker({
            pausedAt,
            lastErrorAt: pausedAt,
            consecutiveFailures: 6,
            lastError: "Login expired, update credentials",
            latestStats: null,
          }),
        ]}
        summaries={[summary({ bars: [], targetRank: null, status: "no-target" })]}
        now={NOW}
      />
    )
    const block = container.querySelector("[data-failed-poll-pause]") as HTMLElement
    expect(block).toHaveTextContent("Paused after 6 failed polls")
    expect(block).toHaveTextContent("Login expired, update credentials")
    expect(block).not.toHaveTextContent(/next retry/)
  })

  it("never shows an automatic retry for a manual pause", () => {
    const { container } = render(
      <TrackerGrid
        trackers={[
          tracker({
            userPausedAt: "2026-10-28T10:00:00.000Z",
            pausedAt: null,
          }),
        ]}
        summaries={[summary()]}
        now={NOW}
      />
    )
    expect(container.querySelector("[data-failed-poll-pause]")).toBeNull()
  })

  it("writes the strict requirement and shortfall marker at equality", () => {
    const { container } = render(
      <TrackerGrid
        trackers={[tracker()]}
        summaries={[
          summary({
            bars: [
              {
                ...summary().bars[0],
                id: "ratio",
                label: "Ratio above 2.0",
                current: "2.00",
                required: "2.00",
                currentValue: 2,
                requiredValue: 2,
                comparison: "gt",
                status: "unmet",
              },
            ],
            metCount: 0,
            unmetCount: 1,
            totalChecks: 1,
          }),
        ]}
        now={NOW}
      />
    )
    expect(screen.getByText("Needs above 2.00, now 2.00")).toBeInTheDocument()
    expect(container.querySelector("[data-shortfall-marker]")).not.toBeNull()
    expect(container.querySelector("[data-bar-fill]")?.getAttribute("style")).toContain("width: 0%")
  })
})
