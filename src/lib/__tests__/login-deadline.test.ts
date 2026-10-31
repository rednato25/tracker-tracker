import { describe, expect, it } from "vitest"
import {
  calendarDayNumber,
  dateFromCalendarDay,
  readLoginDeadline,
} from "@/lib/login-deadline"

const NOW = new Date("2026-10-28T12:00:00.000Z")

describe("calendarDayNumber", () => {
  it("keeps a date-only value on its own calendar day", () => {
    const day = calendarDayNumber("2026-06-15")
    expect(day).not.toBeNull()
    const date = dateFromCalendarDay(day ?? 0)
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(5)
    expect(date.getDate()).toBe(15)
  })

  it("reads a timestamp as the local calendar day, not elapsed hours", () => {
    const lateLogin = new Date(2026, 5, 15, 23, 30)
    expect(calendarDayNumber(lateLogin)).toBe(calendarDayNumber("2026-06-15"))
  })
})

describe("readLoginDeadline", () => {
  it("uses the calendar due date and the last login in the card footer", () => {
    const deadline = readLoginDeadline({
      lastAccessAt: "2026-10-25",
      intervalDays: 30,
      now: NOW,
    })
    expect(deadline.lastLoginText).toBe("Last login 3 days ago")
    expect(deadline.dueText).toBe("due in 27 days")
    expect(deadline.dueInDays).toBe(27)
    expect(deadline.overdueDays).toBeNull()
    expect(deadline.dueAt).toBe("2026-11-24")
    expect(deadline.tone).toBe("ok")
  })

  it("warns inside the seven-day window", () => {
    const deadline = readLoginDeadline({
      lastAccessAt: "2026-10-03",
      intervalDays: 30,
      now: NOW,
    })
    expect(deadline.dueText).toBe("due in 5 days")
    expect(deadline.tone).toBe("warn")
  })

  it("keeps the due day as a warning instead of calling it overdue", () => {
    const deadline = readLoginDeadline({
      lastAccessAt: "2026-09-28",
      intervalDays: 30,
      now: NOW,
    })
    expect(deadline.dueText).toBe("due today")
    expect(deadline.dueInDays).toBe(0)
    expect(deadline.overdueDays).toBeNull()
    expect(deadline.tone).toBe("warn")
  })

  it("reports overdue days in the danger tone", () => {
    const deadline = readLoginDeadline({
      lastAccessAt: "2026-09-01",
      intervalDays: 30,
      now: NOW,
    })
    expect(deadline.dueText).toBe("Overdue by 27 days")
    expect(deadline.overdueDays).toBe(27)
    expect(deadline.dueInDays).toBeNull()
    expect(deadline.dueAt).toBe("2026-10-01")
    expect(deadline.tone).toBe("crit")
  })

  it("says there is no login rule for a missing or zero interval", () => {
    for (const intervalDays of [undefined, 0]) {
      const deadline = readLoginDeadline({
        lastAccessAt: "2026-09-01",
        intervalDays,
        now: NOW,
      })
      expect(deadline.hasRule).toBe(false)
      expect(deadline.dueText).toBe("No login rule")
      expect(deadline.dueAt).toBeNull()
      expect(deadline.tone).toBe("muted")
    }
  })

  it("keeps a missing last login unknown instead of inventing a deadline", () => {
    const deadline = readLoginDeadline({
      lastAccessAt: null,
      intervalDays: 30,
      now: NOW,
    })
    expect(deadline.lastLoginText).toBe("Last login not recorded")
    expect(deadline.dueText).toBe("due date unknown")
    expect(deadline.dueAt).toBeNull()
    expect(deadline.tone).toBe("muted")
  })

  it("reports a login marked today without a negative age", () => {
    const deadline = readLoginDeadline({
      lastAccessAt: "2026-10-28",
      intervalDays: 7,
      now: NOW,
    })
    expect(deadline.lastLoginText).toBe("Last login today")
    expect(deadline.dueText).toBe("due in 7 days")
  })
})
