import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
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

describe("WhatsNext", () => {
  it("renders each row with its tracker, detail and destination", () => {
    const { container } = render(<WhatsNext items={items} />)
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
    const { container } = render(<WhatsNext items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
