import { describe, expect, it } from "vitest"
import { isCriticalQuietEvent, isQuietHours, type QuietHoursConfig } from "@/lib/quiet-hours"

const base: QuietHoursConfig = {
  enabled: true,
  start: "22:00",
  end: "07:00",
  timezone: "UTC",
  criticalBypass: false,
}

describe("quiet hours", () => {
  it("supports windows crossing midnight", () => {
    expect(isQuietHours(base, new Date("2026-10-24T23:30:00Z"))).toBe(true)
    expect(isQuietHours(base, new Date("2026-10-25T06:59:00Z"))).toBe(true)
    expect(isQuietHours(base, new Date("2026-10-25T07:00:00Z"))).toBe(false)
    expect(isQuietHours(base, new Date("2026-10-24T12:00:00Z"))).toBe(false)
  })

  it("handles same-day windows and midnight edges", () => {
    const sameDay: QuietHoursConfig = { ...base, start: "01:00", end: "05:00" }
    expect(isQuietHours(sameDay, new Date("2026-10-24T00:59:00Z"))).toBe(false)
    expect(isQuietHours(sameDay, new Date("2026-10-24T01:00:00Z"))).toBe(true)
    expect(isQuietHours(sameDay, new Date("2026-10-24T05:00:00Z"))).toBe(false)
  })

  it("uses the configured timezone across DST", () => {
    const ny: QuietHoursConfig = {
      ...base,
      start: "02:00",
      end: "04:00",
      timezone: "America/New_York",
    }
    // Spring forward 2026-03-08: 07:30Z is 03:30 EDT, inside 02:00-04:00.
    expect(isQuietHours(ny, new Date("2026-03-08T06:30:00Z"))).toBe(false)
    expect(isQuietHours(ny, new Date("2026-03-08T07:30:00Z"))).toBe(true)
    // Fall back 2026-11-01: 07:30Z is 02:30 EST, inside 02:00-04:00.
    expect(isQuietHours(ny, new Date("2026-11-01T06:30:00Z"))).toBe(false)
    expect(isQuietHours(ny, new Date("2026-11-01T07:30:00Z"))).toBe(true)
  })

  it("is opt-in, rejects invalid windows and limits bypass to documented events", () => {
    expect(isQuietHours({ ...base, enabled: false }, new Date("2026-10-24T23:00:00Z"))).toBe(false)
    expect(isQuietHours({ ...base, start: "nope" }, new Date("2026-10-24T23:00:00Z"))).toBe(false)
    expect(isCriticalQuietEvent("hit_and_run")).toBe(true)
    expect(isCriticalQuietEvent("tracker_down")).toBe(true)
    expect(isCriticalQuietEvent("ratio_drop")).toBe(false)
    expect(isCriticalQuietEvent("buffer_milestone")).toBe(false)
  })
})
