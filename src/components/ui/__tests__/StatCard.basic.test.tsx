import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StatCard } from "@/components/ui/StatCard"

describe("StatCard basic metric hue", () => {
  it("renders the value in the supplied metric color", () => {
    render(<StatCard label="Uploaded" value="1.00 TiB" valueColor="var(--color-upload)" />)
    expect(screen.getByText("1.00 TiB")).toHaveStyle({ color: "var(--color-upload)" })
  })
})
