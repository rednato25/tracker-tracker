// src/components/ui/TrackerMark.tsx

import clsx from "clsx"
import Image from "next/image"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"

type TrackerMarkEntry = Pick<TrackerRegistryEntry, "name" | "abbreviation" | "logo" | "color">

interface TrackerMarkProps {
  entry: TrackerMarkEntry
  size?: number
  className?: string
}

function markLabel(entry: TrackerMarkEntry): string {
  const source = entry.abbreviation?.trim() || entry.name
  const letters = source.replace(/[^A-Za-z0-9]/g, "")
  return letters.slice(0, 2).toUpperCase() || "?"
}

function TrackerMark({ entry, size = 22, className }: TrackerMarkProps) {
  return (
    <span
      className={clsx(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-elevated",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {entry.logo ? (
        <Image
          src={entry.logo}
          alt=""
          width={Math.max(12, size - 4)}
          height={Math.max(12, size - 4)}
          className="object-contain"
        />
      ) : (
        <span className="font-cond text-xs font-semibold uppercase leading-none tracking-[0.04em] text-primary">
          {markLabel(entry)}
        </span>
      )}
      {!entry.logo && (
        <span
          className="absolute inset-x-0 bottom-0 h-[2px]"
          style={{ backgroundColor: entry.color }}
        />
      )}
    </span>
  )
}

export type { TrackerMarkEntry, TrackerMarkProps }
export { TrackerMark }
