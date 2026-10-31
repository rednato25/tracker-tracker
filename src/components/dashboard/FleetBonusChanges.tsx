// src/components/dashboard/FleetBonusChanges.tsx
//
// Bonus points are a tracker-local currency. Two trackers can both show
// "+200" and mean different things, so this never sums them into a fleet tile.

"use client"

import { formatCount } from "@/lib/formatters"
import type { TodayAtAGlance } from "@/types/api"

interface FleetBonusChangesProps {
  trackers: TodayAtAGlance["trackers"]
}

function bonusChangeLabel(change: number): string {
  const floored = Math.floor(Math.abs(change))
  return `${change >= 0 ? "+" : "-"}${formatCount(floored)}`
}

export function FleetBonusChanges({ trackers }: FleetBonusChangesProps) {
  const changes = trackers.filter(
    (tracker) => tracker.seedbonusChange !== null && tracker.seedbonusChange !== 0
  )

  if (changes.length === 0) return null

  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-fleet-bonus-changes>
      <p className="font-cond text-2xs font-semibold uppercase tracking-[0.12em] text-tertiary">
        Bonus change by tracker
      </p>
      <ul className="flex min-w-0 flex-wrap gap-x-4 gap-y-1.5">
        {changes.map((tracker) => (
          <li
            key={tracker.id}
            data-bonus-change={tracker.id}
            className="flex min-w-0 items-baseline gap-1.5"
          >
            <span
              className="color-dot shrink-0"
              style={{ backgroundColor: tracker.color ?? "var(--color-accent)" }}
              aria-hidden="true"
            />
            <span className="min-w-0 break-words text-xs text-secondary">{tracker.name}</span>
            <span className="whitespace-nowrap font-mono text-xs tabular-nums text-primary">
              {bonusChangeLabel(tracker.seedbonusChange ?? 0)}
            </span>
            <span className="text-2xs text-tertiary">pts</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
