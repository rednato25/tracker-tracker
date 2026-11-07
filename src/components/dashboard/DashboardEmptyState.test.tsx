// src/components/dashboard/DashboardEmptyState.test.tsx
//
// The sidebar's "+ Add Tracker" keeps its dialog state local and the two components are
// siblings under AuthShell, so this empty state has to own its own dialog. The wiring worth
// pinning is what happens after a tracker is created: the dialog closes, the dashboard
// refetches, and we navigate to the new tracker, the same three steps the sidebar does.
//
// It also has to hand the dialog the vault's registry slugs. The register looks empty when
// every tracker is archived, and those rows would otherwise be offered again.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TrackerSummary } from "@/types/api"

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

type DialogProps = {
  open: boolean
  onAdded: (trackerId: number) => void
  existingSlugs?: string[]
}

const state = vi.hoisted(() => ({
  dialogProps: {} as { open?: boolean; existingSlugs?: string[] },
}))

vi.mock("@/components/AddTrackerDialog", () => ({
  AddTrackerDialog: (props: DialogProps) => {
    state.dialogProps = props
    return props.open ? (
      <div data-testid="add-tracker-dialog">
        <button type="button" onClick={() => props.onAdded(7)}>
          simulate tracker created
        </button>
      </div>
    ) : null
  },
}))

import { DashboardEmptyState } from "./DashboardEmptyState"

/** An archived row: invisible in the register, still in the vault. */
const archived: TrackerSummary = {
  id: 1,
  name: "Aither",
  baseUrl: "https://aither.cc",
  registrySlug: "aither",
  platformType: "unit3d",
  isActive: false,
  lastPolledAt: null,
  lastError: null,
  lastErrorAt: null,
  consecutiveFailures: 0,
  pausedAt: null,
  userPausedAt: null,
  color: "#00d4ff",
  qbtTag: null,
  mouseholeUrl: null,
  hasMouseholeToken: false,
  hideUnreadBadges: false,
  useProxy: false,
  countCrossSeedUnsatisfied: false,
  isFavorite: false,
  sortOrder: null,
  joinedAt: null,
  lastAccessAt: null,
  remoteUserId: null,
  platformMeta: null,
  createdAt: new Date().toISOString(),
  latestStats: null,
}

const fetchMock = vi.fn()

function renderEmptyState(onAdded: () => void | Promise<void> = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <DashboardEmptyState onAdded={onAdded} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  state.dialogProps = {}
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => [archived] })
  vi.stubGlobal("fetch", fetchMock)
})

describe("DashboardEmptyState", () => {
  it("explains the empty dashboard with a real heading", () => {
    renderEmptyState()

    expect(screen.getByRole("heading", { name: "Account register" })).toBeInTheDocument()
    expect(
      screen.getByText(/Add a private tracker account to record ratio, buffer, seeding, and rank/i)
    ).toBeInTheDocument()
  })

  it("opens its own add-tracker dialog from the Add First Tracker button", async () => {
    const user = userEvent.setup()
    renderEmptyState()

    expect(screen.queryByTestId("add-tracker-dialog")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Add first tracker/i }))

    expect(screen.getByTestId("add-tracker-dialog")).toBeInTheDocument()
  })

  it("closes, refreshes, and navigates to the tracker once one is added", async () => {
    const user = userEvent.setup()
    const onAdded = vi.fn()
    renderEmptyState(onAdded)

    await user.click(screen.getByRole("button", { name: /Add first tracker/i }))
    await user.click(screen.getByRole("button", { name: "simulate tracker created" }))

    expect(screen.queryByTestId("add-tracker-dialog")).not.toBeInTheDocument()
    expect(onAdded).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith("/trackers/7")
  })

  it("hides a tracker the vault already holds, even when no active one is left", async () => {
    renderEmptyState()

    await waitFor(() => expect(state.dialogProps.existingSlugs).toEqual(["aither"]))
  })
})
