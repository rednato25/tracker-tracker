import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { TabBar } from "@/components/ui/TabBar"

const TABS = [
  { key: "general", label: "General" },
  { key: "notifications", label: "Notifications" },
] as const

describe("TabBar", () => {
  it("wraps on narrow settings layouts", () => {
    render(<TabBar tabs={[...TABS]} activeTab="general" onChange={vi.fn()} wrap />)
    const tablist = screen.getByRole("tablist")
    expect(tablist).toHaveClass("flex-wrap")
    expect(tablist).not.toHaveClass("overflow-x-auto")
  })

  it("keeps the scrolling track by default", () => {
    render(<TabBar tabs={[...TABS]} activeTab="general" onChange={vi.fn()} />)
    expect(screen.getByRole("tablist")).toHaveClass("overflow-x-auto")
  })

  it("switches tabs", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TabBar tabs={[...TABS]} activeTab="general" onChange={onChange} wrap />)
    await user.click(screen.getByRole("tab", { name: "Notifications" }))
    expect(onChange).toHaveBeenCalledWith("notifications")
  })
})
