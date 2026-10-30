// src/lib/snapshot-freshness.ts
//
// One freshness read for every surface. A stored snapshot older than two hours
// is stale; a snapshot without a poll time is unknown, never fresh.

import { formatTimeAgo } from "@/lib/formatters"
import type { TrackerSummary } from "@/types/api"

const SNAPSHOT_STALE_MS = 2 * 60 * 60 * 1000

type SnapshotState = "fresh" | "stale" | "unknown"

interface SnapshotReadout {
  hasStats: boolean
  state: SnapshotState
  polledAt: string | null
  age: string | null
}

function getSnapshotReadout(tracker: TrackerSummary, now: Date = new Date()): SnapshotReadout {
  if (!tracker.latestStats) {
    return { hasStats: false, state: "unknown", polledAt: null, age: null }
  }
  if (!tracker.lastPolledAt) {
    return { hasStats: true, state: "unknown", polledAt: null, age: null }
  }
  const polled = new Date(tracker.lastPolledAt)
  if (Number.isNaN(polled.getTime())) {
    return { hasStats: true, state: "unknown", polledAt: tracker.lastPolledAt, age: null }
  }
  const ageMs = Math.max(0, now.getTime() - polled.getTime())
  return {
    hasStats: true,
    state: ageMs > SNAPSHOT_STALE_MS ? "stale" : "fresh",
    polledAt: tracker.lastPolledAt,
    age: formatTimeAgo(tracker.lastPolledAt),
  }
}

export type { SnapshotReadout, SnapshotState }
export { getSnapshotReadout, SNAPSHOT_STALE_MS }
