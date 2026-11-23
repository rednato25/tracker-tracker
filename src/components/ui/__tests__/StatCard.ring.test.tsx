// src/components/ui/__tests__/StatCard.ring.test.tsx
//
// The login ring can carry one quiet line under the countdown. It exists for
// trackers that keep two dates (M-Team: last login and last activity), where a
// countdown that does not move needs the second date named beside it.

import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { StatCard } from "@/components/ui/StatCard"

const ACCENT = CHART_THEME.accent
const NOW = new Date("2026-08-30T12:00:00Z")
const NOTE = "Last login Aug 14, 2026. Last activity Aug 24, 2026."

describe("StatCard login ring", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders the note under the countdown when one is given", () => {
    render(
      <StatCard
        type="ring"
        lastAccessAt="2026-08-14"
        loginIntervalDays={40}
        accentColor={ACCENT}
        note={NOTE}
      />
    )

    // 14 Aug + 40 days = 23 Sep, which is 24 calendar days from 30 Aug.
    expect(screen.getByText("24")).toBeInTheDocument()
    expect(screen.getByText(NOTE)).toBeInTheDocument()
  })

  it("renders no note line when the tracker keeps a single date", () => {
    render(
      <StatCard type="ring" lastAccessAt="2026-08-14" loginIntervalDays={40} accentColor={ACCENT} />
    )

    expect(screen.queryByText(NOTE)).not.toBeInTheDocument()
    expect(screen.queryByText(/Last activity/)).not.toBeInTheDocument()
  })
})
