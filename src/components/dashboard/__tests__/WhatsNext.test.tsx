import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { WhatsNext } from "@/components/dashboard/WhatsNext"
import type { WhatsNextItem } from "@/lib/whats-next"

const items: WhatsNextItem[] = [
  {
    id: "promotion-waiting:1",
    kind: "promotion-waiting",
    trackerId: 1,
    trackerName: "AllMet",
    color: "#22c55e",
    title: "AllMet \u2192 Super User",
    detail: "All checks met \u00b7 waiting for the site",
    href: "/trackers/1#rank-goal",
    dueInDays: 0,
    margin: 0,
  },
  {
    id: "promotion-time:2",
    kind: "promotion-time",
    trackerId: 2,
    trackerName: "Yu-Scene",
    color: "#3b82f6",
    title: "Yu-Scene \u2192 Power User",
    detail: "in 3 days of account age",
    href: "/trackers/2#rank-goal",
    dueInDays: 3,
    margin: 0,
  },
]

function Harness({ onToggle }: { onToggle?: () => void }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <WhatsNext
      items={items}
      expanded={expanded}
      onToggleExpanded={() => {
        onToggle?.()
        setExpanded((current) => !current)
      }}
    />
  )
}

describe("WhatsNext", () => {
  it("renders each row with its tracker, detail and destination", () => {
    const { container } = render(
      <WhatsNext items={items} expanded onToggleExpanded={() => {}} />
    )
    expect(container.querySelectorAll("[data-whats-next-row]")).toHaveLength(2)
    expect(screen.getByText("AllMet \u2192 Super User")).toBeInTheDocument()
    expect(screen.getByText("in 3 days of account age")).toBeInTheDocument()
    expect(container.querySelector('[data-whats-next-kind="promotion-time"]')).not.toBeNull()
    expect(screen.getByRole("link", { name: /AllMet/ })).toHaveAttribute(
      "href",
      "/trackers/1#rank-goal"
    )
  })

  it("renders nothing when there is no next item", () => {
    const { container } = render(
      <WhatsNext items={[]} expanded onToggleExpanded={() => {}} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("collapses and expands its rows through the section toggle", async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const { container } = render(<Harness onToggle={onToggle} />)

    const toggle = screen.getByRole("button", { name: "What's next" })
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(container.querySelectorAll("[data-whats-next-row]")).toHaveLength(2)

    await user.click(toggle)
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(container.querySelectorAll("[data-whats-next-row]")).toHaveLength(0)

    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(container.querySelectorAll("[data-whats-next-row]")).toHaveLength(2)
  })
})
