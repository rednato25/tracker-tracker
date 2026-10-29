// src/lib/dashboard-series.ts
//
// Aggregate sparkline series for the dashboard totals. This reads the snapshot
// history the dashboard already receives; it does not add an API call or a
// stored metric.

import type { Snapshot, TrackerSummary } from "@/types/api"

interface TrackerHistory {
  snapshots: Snapshot[]
}

export interface TotalsSeries {
  uploaded: number[]
  downloaded: number[]
  buffer: number[]
  ratio: (number | null)[]
  points: number
}

const GIB = 1024 ** 3

function toPolls(snapshots: Snapshot[]): number[] {
  return snapshots
    .map((snapshot) => new Date(snapshot.polledAt).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b)
}

/**
 * Build cumulative fleet totals at each poll timestamp. For every timestamp,
 * each tracker contributes its latest snapshot at or before that time, so the
 * result is the same carry-forward view the charts use.
 */
export function buildTotalsSeries(
  trackers: TrackerSummary[],
  snapshotMap: Map<number, Snapshot[]>,
  maxPoints = 30
): TotalsSeries {
  const histories: TrackerHistory[] = trackers
    .map((tracker) => ({
      snapshots: [...(snapshotMap.get(tracker.id) ?? [])].sort(
        (a, b) => new Date(a.polledAt).getTime() - new Date(b.polledAt).getTime()
      ),
    }))
    .filter((history) => history.snapshots.length > 0)

  const timestamps = [...new Set(histories.flatMap((history) => toPolls(history.snapshots)))].sort(
    (a, b) => a - b
  )
  const cursors = histories.map(() => -1)
  const uploaded: number[] = []
  const downloaded: number[] = []
  const buffer: number[] = []
  const ratio: (number | null)[] = []

  for (const time of timestamps) {
    let totalUploaded = 0
    let totalDownloaded = 0
    let totalBuffer = 0
    let observed = false

    for (let index = 0; index < histories.length; index++) {
      const snapshots = histories[index].snapshots
      while (
        cursors[index] + 1 < snapshots.length &&
        new Date(snapshots[cursors[index] + 1].polledAt).getTime() <= time
      ) {
        cursors[index]++
      }
      if (cursors[index] < 0) continue
      const snapshot = snapshots[cursors[index]]
      const up = Number(BigInt(snapshot.uploadedBytes || "0")) / GIB
      const down = Number(BigInt(snapshot.downloadedBytes || "0")) / GIB
      const buffered = snapshot.bufferBytes
        ? Number(BigInt(snapshot.bufferBytes)) / GIB
        : up - down
      totalUploaded += up
      totalDownloaded += down
      totalBuffer += buffered
      observed = true
    }

    if (!observed) continue
    uploaded.push(totalUploaded)
    downloaded.push(totalDownloaded)
    buffer.push(totalBuffer)
    ratio.push(totalDownloaded > 0 ? totalUploaded / totalDownloaded : null)
  }

  const trim = <T>(values: T[]): T[] => values.slice(-maxPoints)
  return {
    uploaded: trim(uploaded),
    downloaded: trim(downloaded),
    buffer: trim(buffer),
    ratio: trim(ratio),
    points: Math.min(uploaded.length, maxPoints),
  }
}
