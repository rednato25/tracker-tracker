import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AppHeader } from "@/components/layout/AppHeader"
import type { TrackerSummary } from "@/types/api"

vi.mock("next/navigation", () => ({
  usePathname: () => "/pathways",
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@/hooks/useUpdateCheck", () => ({
  useUpdateCheck: () => ({ latestVersion: null, updateAvailable: false, loading: false }),
}))
vi.mock("@/components/layout/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}))

/** The props of the last AddTrackerDialog render, which is the wiring under test. */
const state = vi.hoisted(() => ({
  dialogProps: {} as { existingSlugs?: string[]; onAdded?: (id: number) => void },
}))

vi.mock("@/components/AddTrackerDialog", () => ({
  AddTrackerDialog: (props: typeof state.dialogProps) => {
    state.dialogProps = props
    return null
  },
}))
vi.mock("@/components/layout/ChangelogDialog", () => ({
  ChangelogDialog: () => null,
}))

const row: TrackerSummary = {
  id: 1,
  name: "Aither",
  baseUrl: "https://aither.cc",
  registrySlug: "aither",
  platformType: "unit3d",
  isActive: true,
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

function renderHeader() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AppHeader />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  state.dialogProps = {}
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => [row] })
  vi.stubGlobal("fetch", fetchMock)
})

describe("AppHeader", () => {
  it("renders the three primary destinations and marks the active one", () => {
    renderHeader()
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/")
    const pathways = screen.getByRole("link", { name: "Pathways" })
    expect(pathways).toHaveAttribute("href", "/pathways")
    expect(pathways).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings")
  })

  it("opens the mobile menu with the same destinations", async () => {
    const user = userEvent.setup()
    renderHeader()
    await user.click(screen.getByRole("button", { name: "Open menu" }))
    expect(screen.getAllByRole("button", { name: "Add tracker" }).length).toBeGreaterThan(1)
    expect(screen.queryByRole("link", { name: "Search" })).not.toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Settings" }).length).toBeGreaterThan(0)
  })

  // The top navigation's dialog is the only Add Tracker a user can reach: the
  // sidebar that used to carry the filter is not mounted. Without this prop the
  // dialog offers the whole registry, including sites already in the vault.
  it("hands Add Tracker the registry slugs the vault already holds", async () => {
    renderHeader()

    await waitFor(() => expect(state.dialogProps.existingSlugs).toEqual(["aither"]))
  })

  it("refetches the vault after an add so the new tracker stops being offered", async () => {
    renderHeader()
    await waitFor(() => expect(state.dialogProps.existingSlugs).toEqual(["aither"]))
    const callsBefore = fetchMock.mock.calls.length

    act(() => state.dialogProps.onAdded?.(9))

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore))
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/api/trackers")
  })
})
