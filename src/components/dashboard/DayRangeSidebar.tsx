// src/components/dashboard/DayRangeSidebar.tsx

"use client"

import clsx from "clsx"
import type { DayRange } from "@/types/api"

const DAY_RANGES: { value: DayRange; label: string }[] = [
  { value: 1, label: "24h" },
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
  { value: 365, label: "1y" },
  { value: 0, label: "All" },
]

interface DayRangeSidebarProps {
  days: DayRange
  onChange: (days: DayRange) => void
}

function DayRangeSidebar({ days, onChange }: DayRangeSidebarProps) {
  return (
    <div className="order-first flex flex-row flex-wrap gap-1 rounded-nm-lg border border-border bg-elevated p-3 md:sticky md:top-6 md:order-0 md:ml-6 md:flex-col md:self-start">
      <span className="w-full px-2 pb-1 font-cond text-4xs font-semibold uppercase tracking-[0.14em] text-secondary md:pb-1">
        Range
      </span>
      {DAY_RANGES.map((d) => {
        const isActive = days === d.value
        return (
          <button
            key={d.value}
            type="button"
            onClick={() => onChange(d.value)}
            className={clsx(
              "cursor-pointer rounded-nm-sm px-3 py-1.5 text-center font-mono text-xs transition-colors duration-150",
              isActive
                ? "border border-accent bg-accent-dim font-semibold text-primary"
                : "border border-transparent text-tertiary hover:border-border hover:bg-raised hover:text-secondary"
            )}
          >
            {d.label}
          </button>
        )
      })}
    </div>
  )
}

export type { DayRange, DayRangeSidebarProps }
export { DAY_RANGES, DayRangeSidebar }
