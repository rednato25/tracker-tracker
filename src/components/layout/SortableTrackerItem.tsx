// src/components/layout/SortableTrackerItem.tsx

"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import clsx from "clsx"
import Link from "next/link"
import type { CSSProperties } from "react"
import { BookmarkIcon, InfinityIcon } from "@/components/ui/Icons"
import { PulseDot } from "@/components/ui/PulseDot"
import { formatStatValue, type StatMode } from "@/lib/formatters"
import { getHealthPulseDot, getTrackerHealth } from "@/lib/tracker-status"
import type { TrackerSummary } from "@/types/api"

interface SortableTrackerItemProps {
  tracker: TrackerSummary
  isActive: boolean
  unlocked: boolean
  statMode: StatMode
  onToggleFavorite: (id: number, current: boolean) => void
}

function SortableTrackerItem({
  tracker,
  isActive,
  unlocked,
  statMode,
  onToggleFavorite,
}: SortableTrackerItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tracker.id,
  })

  const archived = !tracker.isActive
  const health = getTrackerHealth(tracker)
  const stat = formatStatValue(tracker.latestStats, statMode)

  const dragStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const itemClasses = clsx(
    "flex min-h-11 w-full items-center gap-2 border-b border-rail-line/60 px-3 py-2.5 text-left group rounded-nm-sm last:border-b-0 md:min-h-0",
    unlocked ? "cursor-grab ring-1 ring-accent/30" : "cursor-pointer",
    archived && "opacity-40",
    isActive
      ? "bg-rail-raised text-rail-text"
      : "text-rail-muted hover:bg-rail-raised hover:text-rail-text"
  )

  const children = (
    <>
      {unlocked && (
        <span className="grid grid-cols-2 gap-[2px] shrink-0" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="h-[2px] w-[2px] rounded-full bg-current opacity-60" />
          ))}
        </span>
      )}
      {archived ? (
        <span className="w-2 h-2 rounded-full bg-rail-muted shrink-0" aria-hidden="true" />
      ) : (
        <PulseDot status={getHealthPulseDot(health)} size="sm" />
      )}
      <span className="flex-1 truncate text-[13px] font-medium">{tracker.name}</span>
      <span className="font-mono text-3xs tabular-nums text-rail-muted shrink-0">
        {archived ? (
          "Archived"
        ) : stat.startsWith("∞") ? (
          <>
            <InfinityIcon className="inline-block h-[0.55em] w-[1.1em] align-middle" />
            {stat.slice(1)}
          </>
        ) : (
          stat
        )}
      </span>
      {!unlocked && (
        // biome-ignore lint/a11y/useSemanticElements: Bookmark must be inside parent button for visual layout
        <span
          role="button"
          tabIndex={0}
          aria-pressed={tracker.isFavorite}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onToggleFavorite(tracker.id, tracker.isFavorite)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              e.stopPropagation()
              onToggleFavorite(tracker.id, tracker.isFavorite)
            }
          }}
          className={clsx(
            "flex h-6 w-6 shrink-0 items-center justify-center border-none bg-transparent p-0 transition-all duration-150 cursor-pointer",
            tracker.isFavorite
              ? "text-warn opacity-100"
              : "text-rail-muted opacity-0 group-hover:opacity-60 hover:opacity-100!"
          )}
          aria-label={tracker.isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <BookmarkIcon width="12" height="12" filled={tracker.isFavorite} />
        </span>
      )}
    </>
  )

  return (
    <li ref={setNodeRef} style={dragStyle}>
      {unlocked ? (
        <button
          type="button"
          className={itemClasses}
          aria-current={isActive ? "page" : undefined}
          {...attributes}
          {...listeners}
        >
          {children}
        </button>
      ) : (
        <Link
          href={`/trackers/${tracker.id}`}
          prefetch
          className={itemClasses}
          aria-current={isActive ? "page" : undefined}
        >
          {children}
        </Link>
      )}
    </li>
  )
}

export { SortableTrackerItem }
