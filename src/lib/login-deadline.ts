// src/lib/login-deadline.ts
//
// One calendar-day read of a tracker's inactivity rule. The card footer, the
// register "Login due" column and the checks strip all read this module so a
// tracker cannot be overdue in one view and fine in another.

export type LoginTone = "ok" | "warn" | "crit" | "muted"

export interface LoginDeadline {
  /** Positive inactivity interval, or null when the registry has no policy. */
  intervalDays: number | null
  hasRule: boolean
  lastLoginDays: number | null
  dueInDays: number | null
  overdueDays: number | null
  /** Calendar due date as YYYY-MM-DD, or null when it cannot be known. */
  dueAt: string | null
  tone: LoginTone
  lastLoginText: string
  dueText: string
}

const DAY_MS = 24 * 60 * 60 * 1000
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

function dayNumber(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS)
}

/**
 * The local calendar day of a stored login date, as a whole-day number. A bare
 * `YYYY-MM-DD` is already a calendar date and is read from its own components;
 * an ISO timestamp is converted to the local date first. Using elapsed
 * milliseconds instead makes "today" read as one day less whenever the login
 * happened earlier in the day, and shifts the date across a UTC offset.
 */
export function calendarDayNumber(value: string | Date): number | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return dayNumber(value.getFullYear(), value.getMonth() + 1, value.getDate())
  }
  const bare = DATE_ONLY.exec(value)
  if (bare) {
    return dayNumber(Number(bare[1]), Number(bare[2]), Number(bare[3]))
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return dayNumber(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

/** Local midnight of a whole-day number, for rendering the due date. */
export function dateFromCalendarDay(day: number): Date {
  const utc = new Date(day * DAY_MS)
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate())
}

function isoDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

function pluralDays(count: number): string {
  return `${count} ${count === 1 ? "day" : "days"}`
}

export function readLoginDeadline(input: {
  lastAccessAt: string | null | undefined
  intervalDays: number | null | undefined
  now: Date
}): LoginDeadline {
  const interval =
    typeof input.intervalDays === "number" &&
    Number.isFinite(input.intervalDays) &&
    input.intervalDays > 0
      ? Math.floor(input.intervalDays)
      : null
  const lastDay = input.lastAccessAt ? calendarDayNumber(input.lastAccessAt) : null
  const today = calendarDayNumber(input.now)
  const lastLoginDays = lastDay === null || today === null ? null : Math.max(0, today - lastDay)

  const lastLoginText =
    lastLoginDays === null
      ? "Last login not recorded"
      : lastLoginDays === 0
        ? "Last login today"
        : `Last login ${pluralDays(lastLoginDays)} ago`

  if (interval === null) {
    return {
      intervalDays: null,
      hasRule: false,
      lastLoginDays,
      dueInDays: null,
      overdueDays: null,
      dueAt: null,
      tone: "muted",
      lastLoginText,
      dueText: "No login rule",
    }
  }

  if (lastDay === null || today === null) {
    return {
      intervalDays: interval,
      hasRule: true,
      lastLoginDays: null,
      dueInDays: null,
      overdueDays: null,
      dueAt: null,
      tone: "muted",
      lastLoginText,
      dueText: "due date unknown",
    }
  }

  const dueDay = lastDay + interval
  const dueInDays = Math.max(0, dueDay - today)
  const overdueDays = today > dueDay ? today - dueDay : null

  if (overdueDays !== null) {
    return {
      intervalDays: interval,
      hasRule: true,
      lastLoginDays,
      dueInDays: null,
      overdueDays,
      dueAt: isoDay(dueDay),
      tone: "crit",
      lastLoginText,
      dueText: `Overdue by ${pluralDays(overdueDays)}`,
    }
  }

  return {
    intervalDays: interval,
    hasRule: true,
    lastLoginDays,
    dueInDays,
    overdueDays: null,
    dueAt: isoDay(dueDay),
    tone: dueInDays <= 7 ? "warn" : "ok",
    lastLoginText,
    dueText: dueInDays === 0 ? "due today" : `due in ${pluralDays(dueInDays)}`,
  }
}
