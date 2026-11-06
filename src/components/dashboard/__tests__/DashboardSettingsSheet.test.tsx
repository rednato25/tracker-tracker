// src/components/dashboard/__tests__/DashboardSettingsSheet.test.tsx
//
// P66: the What's next panel is behind a dashboard setting. The switch must be
// visible, on by default, and write the key the dashboard reads.

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { DashboardSettingsSheet } from "@/components/dashboard/DashboardSettingsSheet"
import { useChartPreferences } from "@/components/dashboard/useChartPreferences"
import type { useDashboardSettings } from "@/components/dashboard/useDashboardSettings"
import { DASHBOARD_SETTINGS_DEFAULTS } from "@/types/api"

type Update = ReturnType<typeof useDashboardSettings>["update"]

function Sheet({ update }: { update: Update }) {
  const chartPrefs = useChartPreferences()
  return (
    <DashboardSettingsSheet
      open
      onClose={() => {}}
      chartPrefs={chartPrefs}
      dashSettings={{
        settings: DASHBOARD_SETTINGS_DEFAULTS,
        loaded: true,
        update,
      }}
    />
  )
}

describe("DashboardSettingsSheet What's next switch", () => {
  it("shows Show What's next on by default", () => {
    render(<Sheet update={vi.fn() as Update} />)

    const toggle = screen.getByRole("switch", { name: "Show What's next" })
    expect(toggle).toHaveAttribute("aria-checked", "true")
    expect(toggle).not.toBeDisabled()
  })

  it("writes showWhatsNext when switched off", async () => {
    const user = userEvent.setup()
    const update = vi.fn() as Update
    render(<Sheet update={update} />)

    await user.click(screen.getByRole("switch", { name: "Show What's next" }))

    expect(update).toHaveBeenCalledWith("showWhatsNext", false)
  })
})
