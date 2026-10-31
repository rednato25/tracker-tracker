// src/components/dashboard/LoginTimers.tsx

"use client"

import { ExternalLinkIcon } from "@/components/ui/Icons"
import { SectionToggle } from "@/components/ui/SectionToggle"
import { StatCard } from "@/components/ui/StatCard"
import { registryEntryFor } from "@/data/tracker-registry"
import { calendarDayNumber } from "@/lib/login-deadline"
import type { TrackerSummary } from "@/types/api"

interface TimerEntry {
  tracker: TrackerSummary
  loginIntervalDays: number
  lastAccessAt: string
}

interface LoginTimersProps {
  trackers: TrackerSummary[]
  // Collapse state is owned by the parent (a single shared useSectionCollapse
  // instance) rather than called again here. A second hook instance would
  // hydrate its own in-memory copy and could clobber sibling sections'
  // persisted collapse state when both toggle around the same time.
  expanded: boolean
  onToggleExpanded: () => void
}

export function LoginTimers({ trackers, expanded, onToggleExpanded }: LoginTimersProps) {
  const entries: TimerEntry[] = trackers
    .map((tracker) => {
      if (!tracker.lastAccessAt || !tracker.isActive) return null
      const entry = registryEntryFor(tracker)
      if (!entry?.rules?.loginIntervalDays) return null

      const lastAccess = new Date(tracker.lastAccessAt).getTime()
      if (Number.isNaN(lastAccess)) return null

      return {
        tracker,
        loginIntervalDays: entry.rules.loginIntervalDays,
        lastAccessAt: tracker.lastAccessAt,
      }
    })
    .filter((e): e is TimerEntry => e !== null)
    .sort((a, b) => {
      const today = calendarDayNumber(new Date()) ?? 0
      const remA = (calendarDayNumber(a.lastAccessAt) ?? today) + a.loginIntervalDays - today
      const remB = (calendarDayNumber(b.lastAccessAt) ?? today) + b.loginIntervalDays - today
      return remA - remB
    })

  if (entries.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <SectionToggle label="Login Timers" expanded={expanded} onToggle={onToggleExpanded} />

      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {entries.map(({ tracker, loginIntervalDays, lastAccessAt }) => (
            <a
              key={tracker.id}
              href={tracker.baseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block"
            >
              <StatCard
                type="ring"
                title={tracker.name}
                lastAccessAt={lastAccessAt}
                loginIntervalDays={loginIntervalDays}
                accentColor="var(--color-success)"
                className="p-3 nm-interactive-sm rounded-nm-md"
              />
              <span className="absolute top-2 right-2 text-muted opacity-0 group-hover:opacity-60 transition-opacity duration-150">
                <ExternalLinkIcon width={12} height={12} />
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
