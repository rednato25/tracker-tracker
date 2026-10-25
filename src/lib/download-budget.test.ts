import { describe, expect, it } from "vitest"
import { calculateDownloadBudget } from "@/lib/download-budget"

const GiB = 1024 ** 3

function base(overrides = {}) {
  return {
    uploaded: 1000 * GiB,
    downloaded: 500 * GiB,
    size: 80 * GiB,
    chargedFraction: 1,
    targetRatio: 1,
    committedDownload: 0,
    reserveChargedBytes: 100 * GiB,
    ...overrides,
  }
}

describe("calculateDownloadBudget", () => {
  it("matches the roadmap synthetic example", () => {
    const result = calculateDownloadBudget(base())
    expect(result.status).toBe("available")
    expect(result.headroom).toBe(500 * GiB)
    expect(result.transferBudget).toBe(400 * GiB)
    expect(result.chargedBytes).toBe(80 * GiB)
    expect(result.projectedDownloaded).toBe(580 * GiB)
    expect(result.projectedRatio).toBeCloseTo(1000 / 580, 10)
    expect(result.additionalUploadRequired).toBe(0)
    expect(result.safetyVerdict).toBe("not-assessed")
  })

  it("applies an explicit accounting fraction and committed traffic", () => {
    const result = calculateDownloadBudget(
      base({ chargedFraction: 0.5, committedDownload: 50 * GiB })
    )
    expect(result.chargedBytes).toBe(40 * GiB)
    expect(result.projectedDownloaded).toBe(590 * GiB)
    expect(result.headroom).toBe(450 * GiB)
    expect(result.transferBudget).toBe((450 * GiB - 100 * GiB) / 0.5)
  })

  it("requires additional upload when the proposed download crosses the target", () => {
    const result = calculateDownloadBudget(
      base({ uploaded: 400 * GiB, downloaded: 500 * GiB, size: 100 * GiB })
    )
    expect(result.projectedDownloaded).toBe(600 * GiB)
    expect(result.projectedRatio).toBeCloseTo(400 / 600, 10)
    expect(result.additionalUploadRequired).toBe(200 * GiB)
    expect(result.transferBudget).toBe(0)
  })

  it("treats an explicit zero charge as a scenario, never unlimited safe capacity", () => {
    const result = calculateDownloadBudget(base({ chargedFraction: 0 }))
    expect(result.status).toBe("scenario-only")
    expect(result.transferBudget).toBeNull()
    expect(result.projectedDownloaded).toBe(500 * GiB)
    expect(result.assumptions.join(" ")).toMatch(/freeleech|zero charged fraction/i)
    expect(result.reason).toMatch(/does not prove unlimited/)
  })

  it("handles zero amounts and boundaries without NaN or infinity", () => {
    const zero = calculateDownloadBudget(
      base({ uploaded: 0, downloaded: 0, size: 10 * GiB, reserveChargedBytes: 0 })
    )
    expect(zero.projectedRatio).toBe(0)
    expect(zero.transferBudget).toBe(0)
    expect(zero.additionalUploadRequired).toBe(10 * GiB)
    expect(Number.isFinite(zero.projectedRatio as number)).toBe(true)

    const exact = calculateDownloadBudget(
      base({ uploaded: 580 * GiB, downloaded: 500 * GiB, size: 80 * GiB })
    )
    expect(exact.projectedRatio).toBe(1)
    expect(exact.additionalUploadRequired).toBe(0)

    const noDownload = calculateDownloadBudget(
      base({ uploaded: 0, downloaded: 0, size: 0, chargedFraction: 1 })
    )
    expect(noDownload.projectedRatio).toBeNull()
    expect(noDownload.additionalUploadRequired).toBeNull()
  })

  it("handles negative headroom and reserves larger than headroom", () => {
    const negative = calculateDownloadBudget(
      base({ uploaded: 100 * GiB, downloaded: 500 * GiB, reserveChargedBytes: 0 })
    )
    expect(negative.headroom).toBeLessThan(0)
    expect(negative.transferBudget).toBe(0)

    const overReserved = calculateDownloadBudget(base({ reserveChargedBytes: 600 * GiB }))
    expect(overReserved.transferBudget).toBe(0)
  })

  it("returns unavailable for unknown accounting, invalid values and no ratio", () => {
    expect(
      calculateDownloadBudget(base({ chargedFraction: null })).status
    ).toBe("unavailable")
    expect(calculateDownloadBudget(base({ chargedFraction: -1 })).status).toBe("unavailable")
    expect(calculateDownloadBudget(base({ targetRatio: 0 })).status).toBe("not-applicable")
    expect(calculateDownloadBudget(base({ targetRatio: -1 })).status).toBe("unavailable")
    expect(calculateDownloadBudget(base({ uploaded: Number.NaN })).status).toBe("unavailable")
    expect(calculateDownloadBudget(base({ size: -1 })).status).toBe("unavailable")
    expect(calculateDownloadBudget(base({ reserveChargedBytes: -1 })).status).toBe("unavailable")
  })

  it("keeps the user target separate from the tracker minimum", () => {
    const result = calculateDownloadBudget(base({ targetRatio: 2, minimumRatio: 1 }))
    expect(result.targetRatio).toBe(2)
    expect(result.headroom).toBe(1000 * GiB / 2 - 500 * GiB)
    expect(result.additionalUploadRequired).toBe(2 * (500 + 80) * GiB - 1000 * GiB)
  })
})
