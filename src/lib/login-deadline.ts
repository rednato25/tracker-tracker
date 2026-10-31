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

function calendarDay(value: string): number | null {
  const bare = DATE_ONLY.exec(value)
  if (bare) {
    return dayNumber(Number(bare[1]), Number(bare[2]), Number(bare[3]))
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return dayNumber(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

function todayDay(now: Date): number {
  return dayNumber(now.getFullYear(), now.getMonth() + 1, now.getDate())
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
  const lastDay = input.lastAccessAt ? calendarDay(input.lastAccessAt) : null
  const lastLoginDays =
    lastDay === null ? null : Math.max(0, todayDay(input.now) - lastDay)

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

  if (lastDay === null) {
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
  const today = todayDay(input.now)
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
