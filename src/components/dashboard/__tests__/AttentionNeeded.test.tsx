import { render, screen } from "@testing-library/react"
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
  it("lists open items together and counts clear trackers instead of listing them", () => {
    renderView()

    expect(screen.getByTestId("attention-counts")).toHaveTextContent("2 to fix, 1 to check")
    expect(screen.getByText(confirmed.reason)).toBeInTheDocument()
    expect(screen.getByText(verification.reason)).toBeInTheDocument()
    expect(screen.getByText(client.reason)).toBeInTheDocument()
    expect(screen.getAllByText("Needs action")).toHaveLength(2)
    expect(screen.getByText("Needs checking")).toBeInTheDocument()
    // Gamma has nothing open: counted, not listed.
    expect(screen.queryByText("Gamma")).not.toBeInTheDocument()
    expect(screen.getByText("The other 1 tracker is clear.")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("shows no internal keys, types or source fields", () => {
    const { container } = renderView()
    const text = container.textContent ?? ""
    for (const internal of [
      "ratio-below-account",
      "stale-data",
      "priority",
      "freshness",
      "snapshot",
      "Evidence",
    ]) {
      expect(text).not.toContain(internal)
    }
  })

  it("says how old an item is, measured from the page time", () => {
    renderView({ actions: [verification] })
    // AS_OF is 12:00, the observation 08:00.
    expect(screen.getByText("Updated 4h ago")).toBeInTheDocument()
    expect(screen.queryByText(/2026-10-24T08:00:00/)).not.toBeInTheDocument()
  })

  it("folds the same item on several trackers into one row naming them all", () => {
    const stale = (id: number, name: string) =>
      action({ ...verification, key: `stale-data:tracker:${id}`, trackerId: id, trackerName: name })
    const { container } = render(
      <AttentionNeeded
        trackers={[tracker(1, "Alpha"), tracker(2, "Beta"), tracker(3, "Gamma"), tracker(4, "Delta")]}
        actions={[stale(1, "Alpha"), stale(2, "Beta"), stale(3, "Gamma")]}
        asOf={AS_OF}
      />
    )
    expect(container.querySelectorAll("[data-action-key]")).toHaveLength(1)
    expect(screen.getAllByText(verification.reason)).toHaveLength(1)
    for (const [name, id] of [["Alpha", 1], ["Beta", 2], ["Gamma", 3]] as const) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", `/trackers/${id}`)
    }
    expect(screen.getByTestId("attention-counts")).toHaveTextContent("3 to check")
    expect(screen.getByText("The other 1 tracker is clear.")).toBeInTheDocument()
    // Each tracker's own poll time differs, so a folded row shows none.
    expect(screen.queryByText(/^Updated/)).not.toBeInTheDocument()
  })

  it("shows a proven deadline instead of the observation time", () => {
    renderView({
      actions: [action({ ...verification, key: "login-due:tracker:2", deadline: "2026-10-25" })],
    })
    expect(screen.getByText("Due 2026-10-25")).toBeInTheDocument()
    expect(screen.queryByText(/^Updated/)).not.toBeInTheDocument()
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

  it("claims all clear only once the data is complete", () => {
    const { rerender } = renderView({ loading: true, actions: [] })
    expect(screen.getByText("Loading…")).toBeInTheDocument()
    expect(screen.queryByText(/clear/)).not.toBeInTheDocument()

    rerender(<AttentionNeeded trackers={[tracker(3, "Gamma")]} actions={[]} error asOf={AS_OF} />)
    expect(screen.getByText(/Couldn't load/)).toBeInTheDocument()
    expect(screen.queryByText(/clear/)).not.toBeInTheDocument()

    rerender(
      <AttentionNeeded trackers={[tracker(3, "Gamma")]} actions={[]} clientsUnavailable asOf={AS_OF} />
    )
    expect(screen.getByText(/may be incomplete/)).toBeInTheDocument()
    expect(screen.queryByText(/^All 1 tracker clear/)).not.toBeInTheDocument()

    rerender(<AttentionNeeded trackers={[tracker(3, "Gamma")]} actions={[]} asOf={AS_OF} />)
    expect(screen.getByText(`All 1 tracker clear as of ${formatDateTime(AS_OF)}.`)).toBeInTheDocument()
    expect(screen.getByTestId("attention-counts")).toHaveTextContent("Nothing to fix")
  })

  it("leaves archived trackers out of the clear count", () => {
    render(
      <AttentionNeeded
        trackers={[tracker(1, "Alpha"), tracker(4, "Archived", false)]}
        actions={[]}
        asOf={AS_OF}
      />
    )
    expect(screen.getByText(/^All 1 tracker clear/)).toBeInTheDocument()
  })

  it("removes resolved rows and brings them back on recomputation", () => {
    const { rerender } = renderView({ actions: [confirmed] })
    expect(screen.getByText(confirmed.reason)).toBeInTheDocument()
    rerender(<AttentionNeeded trackers={[tracker(1, "Alpha")]} actions={[]} asOf={AS_OF} />)
    expect(screen.queryByText(confirmed.reason)).not.toBeInTheDocument()
    rerender(<AttentionNeeded trackers={[tracker(1, "Alpha")]} actions={[confirmed]} asOf={AS_OF} />)
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
