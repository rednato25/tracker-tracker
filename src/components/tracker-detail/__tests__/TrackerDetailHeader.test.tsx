import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { TrackerDetailHeader } from "@/components/tracker-detail/TrackerDetailHeader"
import type { RankGoalSummary } from "@/lib/rank-summary"
import type { TrackerSummary } from "@/types/api"

vi.mock("next/image", () => ({
  default: ({ alt }: { alt?: string }) => <span role="img" aria-label={alt} />,
}))

const tracker: TrackerSummary = {
  id: 1,
  name: "TorrentLeech",
  baseUrl: "https://tl.invalid",
  registrySlug: "torrentleech",
  platformType: "unit3d",
  isActive: true,
  lastPolledAt: new Date().toISOString(),
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
  latestStats: null,
}

function renderHeader(
  onMarkLoginToday = vi.fn(),
  rankSummary: RankGoalSummary | null = null
) {
  return {
    onMarkLoginToday,
    ...render(
      <TrackerDetailHeader
        tracker={tracker}
        stats={null}
        registryEntry={undefined}
        accentColor="#6d56eb"
        polling={false}
        onPollNow={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenCredentials={vi.fn()}
        onDebugPoll={vi.fn()}
        debugLoading={false}
        badgeSlots={[]}
        onTogglePause={vi.fn()}
        pauseLoading={false}
        onMarkLoginToday={onMarkLoginToday}
        markLoginLoading={false}
        settingsSaves={0}
        rankSummary={rankSummary}
      />
    ),
  }
}

describe("TrackerDetailHeader actions", () => {
  it("keeps Poll now and Pause visible and hides secondary actions in one menu", async () => {
    const user = userEvent.setup()
    const { container } = renderHeader()
    expect(screen.getByRole("button", { name: "Poll now" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
    expect(screen.getByText("Unit3D")).toBeInTheDocument()
    expect(container.querySelector("[data-health-label]")).toHaveTextContent("Offline")

    const menu = container.querySelector("details")
    expect(menu).not.toBeNull()
    expect(menu).not.toHaveAttribute("open")
    await user.click(within(menu as HTMLElement).getByText("More actions"))
    expect(menu).toHaveAttribute("open")
    expect(screen.getByText("Debug poll")).toBeInTheDocument()
    expect(screen.getByText("Credentials")).toBeInTheDocument()
    expect(screen.getByText("Settings")).toBeInTheDocument()
  })

  it("confirms a login write and names the date", async () => {
    const user = userEvent.setup()
    const onMarkLoginToday = vi.fn()
    const { container } = renderHeader(onMarkLoginToday)
    const menu = container.querySelector("details") as HTMLElement
    await user.click(within(menu).getByText("More actions"))
    await user.click(screen.getByText("Mark login today"))

    const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date())
    expect(screen.getByText(date)).toBeInTheDocument()
    expect(screen.getByText(/This records a login on/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Record login" }))
    expect(onMarkLoginToday).toHaveBeenCalledTimes(1)
  })

  it("shows current, target and remaining distance in the header", () => {
    const summary: RankGoalSummary = {
      trackerId: 1,
      trackerName: "TorrentLeech",
      color: "#6d56eb",
      currentRank: "Power User",
      currentRankHidden: false,
      targetRank: "Super User",
      targetInvalid: false,
      automaticNextRank: null,
      status: "goal",
      metCount: 2,
      unmetCount: 1,
      unknownCount: 0,
      unmet: [],
      unknown: [],
      bars: [],
      totalChecks: 3,
      distanceText: "Super User: ratio above 2.00",
      nextRankRequirements: null,
      linkLabel: "Open rank goal",
      linkHref: "/trackers/1#rank-goal",
    }
    renderHeader(vi.fn(), summary)
    const block = screen.getByLabelText("Rank target summary")
    expect(within(block).getByText("Current")).toBeInTheDocument()
    expect(within(block).getByText("Power User")).toBeInTheDocument()
    expect(within(block).getByText("Super User")).toBeInTheDocument()
    expect(within(block).getByText("ratio above 2.00")).toBeInTheDocument()
  })
})
