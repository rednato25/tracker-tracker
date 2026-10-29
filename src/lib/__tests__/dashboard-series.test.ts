import { describe, expect, it } from "vitest"
import { buildTotalsSeries } from "@/lib/dashboard-series"
import type { Snapshot, TrackerSummary } from "@/types/api"

const GIB = 1024 ** 3

function tracker(id: number): TrackerSummary {
  return { id, name: `T${id}` } as TrackerSummary
}

function snapshot(
  polledAt: string,
  uploaded: number,
  downloaded: number,
  buffer = uploaded - downloaded
): Snapshot {
  return {
    polledAt,
    uploadedBytes: String(uploaded * GIB),
    downloadedBytes: String(downloaded * GIB),
    bufferBytes: String(buffer * GIB),
    isManual: false,
  } as Snapshot
}

describe("buildTotalsSeries", () => {
  it("carries each tracker's latest snapshot forward and sums the fleet", () => {
    const map = new Map<number, Snapshot[]>([
      [
        1,
        [
          snapshot("2026-10-28T10:00:00.000Z", 10, 5),
          snapshot("2026-10-28T12:00:00.000Z", 20, 10),
        ],
      ],
      [2, [snapshot("2026-10-28T12:00:00.000Z", 4, 1)]],
    ])
    const series = buildTotalsSeries([tracker(1), tracker(2)], map)

    expect(series.uploaded).toEqual([10, 24])
    expect(series.downloaded).toEqual([5, 11])
    expect(series.buffer).toEqual([5, 13])
    expect(series.ratio).toEqual([2, 24 / 11])
    expect(series.points).toBe(2)
  })

  it("keeps only the latest points when the series is capped", () => {
    const map = new Map<number, Snapshot[]>([
      [
        1,
        [
          snapshot("2026-10-28T10:00:00.000Z", 1, 1),
          snapshot("2026-10-28T11:00:00.000Z", 2, 1),
          snapshot("2026-10-28T12:00:00.000Z", 3, 1),
        ],
      ],
    ])
    const series = buildTotalsSeries([tracker(1)], map, 2)
    expect(series.uploaded).toEqual([2, 3])
    expect(series.points).toBe(2)
  })

  it("returns an empty series when there is no snapshot history", () => {
    const series = buildTotalsSeries([tracker(1)], new Map())
    expect(series.uploaded).toEqual([])
    expect(series.ratio).toEqual([])
    expect(series.points).toBe(0)
  })
})
