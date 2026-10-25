import { describe, expect, it } from "vitest"
import { estimateUploadCompletion } from "@/lib/rank-eta"
import type { Snapshot } from "@/types/api"

const NOW = new Date("2026-10-25T12:00:00.000Z")
const GiB = 1024 ** 3

function snapshot(daysAgo: number, uploaded: number): Snapshot {
  return {
    polledAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
    uploadedBytes: String(uploaded),
    downloadedBytes: "0",
    bufferBytes: "0",
    ratio: 1,
    ratioIsInfinite: false,
    seedingCount: 1,
    leechingCount: 0,
    seedbonus: null,
    hitAndRuns: 0,
    requiredRatio: null,
    warned: false,
    freeleechTokens: null,
    shareScore: null,
    username: null,
    group: null,
    isManual: false,
  }
}

describe("estimateUploadCompletion", () => {
  it("estimates from a recent positive window", () => {
    const result = estimateUploadCompletion(
      [snapshot(14, 100 * GiB), snapshot(7, 200 * GiB), snapshot(0, 300 * GiB)],
      1000 * GiB,
      300 * GiB,
      NOW
    )
    expect(result).not.toBeNull()
    expect(result?.date).toBe("2026-12-13")
    expect(result?.daysRemaining).toBeGreaterThan(0)
    expect(result?.basisDays).toBe(14)
  })

  it("returns unavailable for missing, stale, reset or non-positive history", () => {
    expect(
      estimateUploadCompletion([snapshot(1, 100 * GiB)], 1000 * GiB, 100 * GiB, NOW)
    ).toBeNull()
    expect(
      estimateUploadCompletion(
        [snapshot(10, 200 * GiB), snapshot(2, 100 * GiB)],
        1000 * GiB,
        100 * GiB,
        NOW
      )
    ).toBeNull()
    expect(
      estimateUploadCompletion(
        [snapshot(10, 100 * GiB), snapshot(1, 200 * GiB)],
        1000 * GiB,
        200 * GiB,
        NOW,
        { staleAfterMs: 12 * 60 * 60 * 1000 }
      )
    ).toBeNull()
    expect(
      estimateUploadCompletion([snapshot(30, 0), snapshot(0, 50 * GiB)], 50 * GiB, 50 * GiB, NOW)
    ).toBeNull()
  })
})
