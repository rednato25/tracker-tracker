import { describe, expect, it, vi } from "vitest"
import SearchRedirectPage from "./page"

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }))

vi.mock("next/navigation", () => ({ redirect }))

describe("/search redirect", () => {
  it("redirects to the dashboard", () => {
    SearchRedirectPage()
    expect(redirect).toHaveBeenCalledWith("/")
  })
})
