import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { AttentionNeeded } from "@/components/dashboard/AttentionNeeded"
import type { TrackerAction } from "@/lib/actions"
import { formatDateTime } from "@/lib/formatters"
import type { TrackerSummary } from "@/types/api"

const AS_OF = "2026-10-24T12:00:00.000Z"

function tracker(id: number, name: string, isActive = true): TrackerSummary {
  return { id, name, isActive, color: "#000000" } as TrackerSummary
}

function action(overrides: Partial<TrackerAction>): TrackerAction {
  return {
    key: `ratio-below-account:tracker:1`,
    type: "ratio-below-account",
    status: "action-required",
    priority: "critical",
    trackerId: 1,
    trackerName: "Alpha",
    reason: "Ratio 0.50 is below the confirmed account minimum of 1.00.",
    nextAction: "Open the tracker and improve the ratio.",
    deadline: null,
    evidence: {
      value: 0.5,
      required: 1,
      source: "manual",
      freshness: "unknown",
    },
    dismissible: true,
    ...overrides,
  }
}

const confirmed = action({})
const verification = action({
  key: "stale-data:tracker:2",
  type: "stale-data",
  status: "needs-verification",
  priority: "high",
  trackerId: 2,
  trackerName: "Beta",
  reason: "The last successful poll is older than the expected interval.",
  nextAction: "Check the integration and retry.",
  evidence: { observedAt: "2026-10-24T08:00:00.000Z", source: "snapshot", freshness: "stale" },
})
const client = action({
  key: "client-error:client:9",
  type: "client-error",
  status: "action-required",
  priority: "high",
  trackerId: null,
  trackerName: "Synthetic qbt",
  clientId: 9,
  reason: "The download client reported an integration error.",
  nextAction: "Check the client connection and credentials.",
})

function renderView(overrides: {
  actions?: TrackerAction[]
  loading?: boolean
  error?: boolean
  clientsUnavailable?: boolean
} = {}) {
  return render(
    <AttentionNeeded
      trackers={[tracker(1, "Alpha"), tracker(2, "Beta"), tracker(3, "Gamma")]}
      actions={overrides.actions ?? [confirmed, verification, client]}
      loading={overrides.loading}
      error={overrides.error}
      clientsUnavailable={overrides.clientsUnavailable}
      asOf={AS_OF}
    />
  )
}

describe("AttentionNeeded", () => {
  it("separates confirmed actions from verification items and clear accounts", async () => {
    const user = userEvent.setup()
    renderView()

    expect(screen.getByTestId("attention-counts").textContent).toMatch(/2 actions required/)
    expect(screen.getByTestId("attention-counts").textContent).toMatch(/1 needs verification/)
    expect(screen.getByTestId("attention-counts").textContent).toMatch(/1 clear/)
    expect(screen.getByText(confirmed.reason)).toBeInTheDocument()
    expect(screen.queryByText(verification.reason)).not.toBeInTheDocument()
    expect(screen.queryByText("Gamma")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Unknown/ }))
    expect(screen.getByText(verification.reason)).toBeInTheDocument()
    expect(screen.queryByText(confirmed.reason)).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Healthy/ }))
    expect(screen.getByText("Gamma")).toBeInTheDocument()
    expect(screen.getByText(/No action or verification item is recorded/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /^All/ }))
    expect(screen.getByText(confirmed.reason)).toBeInTheDocument()
    expect(screen.getByText(verification.reason)).toBeInTheDocument()
    expect(screen.getByText("Gamma")).toBeInTheDocument()
  })

  it("puts trackers with a login deadline before other attention rows", () => {
    const ratio = action({
      key: "ratio-below-account:tracker:1",
      trackerId: 1,
      trackerName: "Alpha",
      reason: "The ratio is below the account minimum.",
    })
    const loginDue = action({
      key: "login-due:tracker:2",
      type: "login-due",
      priority: "medium",
      trackerId: 2,
      trackerName: "Beta",
      reason: "The login is due inside the seven-day window.",
      deadline: "2026-10-25",
    })
    renderView({ actions: [loginDue, ratio] })

    const loginReason = screen.getByText(loginDue.reason)
    const ratioReason = screen.getByText(ratio.reason)
    expect(
      loginReason.compareDocumentPosition(ratioReason) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("links tracker and client actions to existing destinations", () => {
    renderView()
    const alphaLinks = screen.getAllByRole("link", { name: /Alpha/ })
    expect(alphaLinks[0]).toHaveAttribute("href", "/trackers/1")
    expect(screen.getByRole("link", { name: /Synthetic qbt/ })).toHaveAttribute(
      "href",
      "/settings"
    )
    expect(
      screen.getByRole("link", { name: /Open the tracker and improve the ratio/ })
    ).toHaveAttribute("href", "/trackers/1")
  })

  it("withholds all-clear while loading, on error, or with unavailable client data", () => {
    const { rerender } = renderView({ loading: true, actions: [] })
    expect(screen.getByText(/Checking tracker actions/)).toBeInTheDocument()
    expect(screen.queryByText(/All clear/)).not.toBeInTheDocument()

    rerender(
      <AttentionNeeded
        trackers={[tracker(3, "Gamma")]}
        actions={[]}
        error
        asOf={AS_OF}
      />
    )
    expect(screen.getByText(/could not be loaded/)).toBeInTheDocument()
    expect(screen.queryByText(/All clear/)).not.toBeInTheDocument()

    rerender(
      <AttentionNeeded
        trackers={[tracker(3, "Gamma")]}
        actions={[]}
        clientsUnavailable
        asOf={AS_OF}
      />
    )
    expect(screen.getByText(/Client data is unavailable/)).toBeInTheDocument()
    expect(screen.queryByText(/All clear/)).not.toBeInTheDocument()
  })

  it("says verification remains instead of all-clear", () => {
    renderView({ actions: [verification] })
    expect(screen.getByText(/No confirmed problems/)).toBeInTheDocument()
    expect(screen.getByText(/still need/)).toBeInTheDocument()
    expect(screen.queryByText(/All clear/)).not.toBeInTheDocument()
  })

  it("shows all-clear only after the data is complete and no conditions remain", () => {
    const { rerender } = renderView({ actions: [confirmed] })
    expect(screen.queryByText(/All clear/)).not.toBeInTheDocument()
    rerender(
      <AttentionNeeded
        trackers={[tracker(1, "Alpha")]}
        actions={[]}
        asOf={AS_OF}
      />
    )
    expect(screen.getByText(/All clear/)).toBeInTheDocument()
  })

  it("formats the evidence timestamp with the app date format", async () => {
    const user = userEvent.setup()
    renderView({ actions: [verification] })
    await user.click(screen.getByRole("button", { name: /Unknown/ }))
    await user.click(screen.getByText("Evidence and source"))
    expect(
      screen.getByText(formatDateTime("2026-10-24T08:00:00.000Z"))
    ).toBeInTheDocument()
    expect(screen.queryByText("2026-10-24T08:00:00.000Z")).not.toBeInTheDocument()
  })
  it("shows evidence through progressive disclosure", async () => {
    const user = userEvent.setup()
    renderView()
    const details = screen.getAllByText("Evidence and source")[0]
    await user.click(details)
    expect(screen.getByText(/ratio-below-account:tracker:1/)).toBeInTheDocument()
    expect(screen.getAllByText(/manual/).length).toBeGreaterThan(0)
  })

  it("removes resolved rows and brings them back on recomputation", () => {
    const { rerender } = renderView({ actions: [confirmed] })
    expect(screen.getByText(confirmed.reason)).toBeInTheDocument()
    rerender(
      <AttentionNeeded
        trackers={[tracker(1, "Alpha")]}
        actions={[]}
        asOf={AS_OF}
      />
    )
    expect(screen.queryByText(confirmed.reason)).not.toBeInTheDocument()
    rerender(
      <AttentionNeeded
        trackers={[tracker(1, "Alpha")]}
        actions={[confirmed]}
        asOf={AS_OF}
      />
    )
    expect(screen.getByText(confirmed.reason)).toBeInTheDocument()
  })

  it("keeps the row key stable across text changes", () => {
    const { container, rerender } = renderView({ actions: [confirmed] })
    expect(container.querySelector("[data-action-key='ratio-below-account:tracker:1']")).toBeTruthy()
    rerender(
      <AttentionNeeded
        trackers={[tracker(1, "Alpha")]}
        actions={[{ ...confirmed, reason: "Updated wording" }]}
        asOf={AS_OF}
      />
    )
    expect(container.querySelector("[data-action-key='ratio-below-account:tracker:1']")).toBeTruthy()
  })
})
