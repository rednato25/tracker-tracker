import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { AppHeader } from "@/components/layout/AppHeader"

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
vi.mock("@/components/AddTrackerDialog", () => ({
  AddTrackerDialog: () => null,
}))
vi.mock("@/components/layout/ChangelogDialog", () => ({
  ChangelogDialog: () => null,
}))

describe("AppHeader", () => {
  it("renders the three primary destinations and marks the active one", () => {
    render(<AppHeader />)
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/")
    const pathways = screen.getByRole("link", { name: "Pathways" })
    expect(pathways).toHaveAttribute("href", "/pathways")
    expect(pathways).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings")
  })

  it("opens the mobile menu with the same destinations", async () => {
    const user = userEvent.setup()
    render(<AppHeader />)
    await user.click(screen.getByRole("button", { name: "Open menu" }))
    expect(screen.getAllByRole("button", { name: "Add tracker" }).length).toBeGreaterThan(1)
    expect(screen.queryByRole("link", { name: "Search" })).not.toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Settings" }).length).toBeGreaterThan(0)
  })
})
