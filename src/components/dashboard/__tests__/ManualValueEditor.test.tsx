import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import { ManualValueEditor } from "@/components/dashboard/ManualValueEditor"

const NOW = new Date("2026-10-31T12:00:00.000Z")

function props(overrides: Partial<ComponentProps<typeof ManualValueEditor>> = {}) {
  return {
    trackerName: "Upload.cx",
    metric: "seedSizeBytes" as const,
    label: "Seed size at least 5 TiB",
    manual: null,
    manualUsed: false,
    observed: false,
    canEnter: true,
    now: NOW,
    onSave: vi.fn().mockResolvedValue(undefined),
    onClear: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("ManualValueEditor", () => {
  it("saves the entered number with the chosen unit", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ManualValueEditor {...props({ onSave })} />)
    await user.click(screen.getByRole("button", { name: "Enter value" }))
    await user.type(screen.getByLabelText("Value for Seed size at least 5 TiB on Upload.cx"), "2")
    await user.selectOptions(
      screen.getByLabelText("Unit for Seed size at least 5 TiB on Upload.cx"),
      "TiB"
    )
    await user.click(screen.getByRole("button", { name: "Save value" }))
    expect(onSave).toHaveBeenCalledWith({
      value: 2 * 1024 ** 4,
      unit: "TiB",
      enteredAt: "2026-10-31",
    })
  })

  it("shows the entry date and marks a value older than 14 days", () => {
    render(
      <ManualValueEditor
        {...props({
          manual: { value: 2 * 1024 ** 4, unit: "TiB", enteredAt: "2026-10-10" },
          manualUsed: true,
        })}
      />
    )
    expect(screen.getByText(/Entered by you · 21 days ago/)).toBeInTheDocument()
    expect(screen.getByText(/Needs checking/)).toBeInTheDocument()
    expect(screen.getByText("Manual value")).toBeInTheDocument()
  })

  it("clears a manual value", async () => {
    const user = userEvent.setup()
    const onClear = vi.fn().mockResolvedValue(undefined)
    render(
      <ManualValueEditor
        {...props({
          manual: { value: 2 * 1024 ** 4, unit: "TiB", enteredAt: "2026-10-30" },
          manualUsed: true,
          onClear,
        })}
      />
    )
    await user.click(screen.getByRole("button", { name: "Clear" }))
    expect(onClear).toHaveBeenCalled()
  })

  it("says observed values win when a manual value is overridden", () => {
    render(
      <ManualValueEditor
        {...props({
          manual: { value: 2 * 1024 ** 4, unit: "TiB", enteredAt: "2026-10-30" },
          observed: true,
        })}
      />
    )
    expect(screen.getByText("Observed value wins")).toBeInTheDocument()
  })

  it("does not offer entry when an observed value exists", () => {
    render(<ManualValueEditor {...props({ observed: true })} />)
    expect(screen.queryByRole("button", { name: "Enter value" })).not.toBeInTheDocument()
  })
})
