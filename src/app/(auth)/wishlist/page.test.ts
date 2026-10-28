import { describe, expect, it, vi } from "vitest"
import WishlistRedirectPage from "./page"

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }))

vi.mock("next/navigation", () => ({ redirect }))

describe("/wishlist redirect", () => {
  it("redirects to /pathways", () => {
    WishlistRedirectPage()
    expect(redirect).toHaveBeenCalledWith("/pathways")
  })
})
