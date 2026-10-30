import { describe, expect, it } from "vitest"
import {
  apiDoesNotReportMessage,
  formatManualAge,
  isManualValueStale,
  manualAgeDays,
  manualMetricLabel,
  manualUnitsFor,
  manualValueToCanonical,
  normalizeRankManualValue,
  normalizeRankManualValues,
  parseRankManualValuesFromSettings,
} from "@/lib/rank-manual-values"

const NOW = new Date("2026-10-31T12:00:00.000Z")

describe("manual units", () => {
  it("offers GiB/TiB for bytes and days/weeks/months for durations", () => {
    expect(manualUnitsFor("seedSizeBytes")).toEqual(["GiB", "TiB"])
    expect(manualUnitsFor("averageSeedTimeSeconds")).toEqual(["days", "weeks", "months"])
    expect(manualUnitsFor("accountRatio")).toEqual([])
  })

  it("converts the chosen unit to canonical metric units", () => {
    expect(manualValueToCanonical("seedSizeBytes", 2, "TiB")).toBe(2 * 1024 ** 4)
    expect(manualValueToCanonical("seedSizeBytes", 512, "GiB")).toBe(512 * 1024 ** 3)
    expect(manualValueToCanonical("averageSeedTimeSeconds", 3, "days")).toBe(3 * 86_400)
    expect(manualValueToCanonical("averageSeedTimeSeconds", 2, "weeks")).toBe(14 * 86_400)
    expect(manualValueToCanonical("averageSeedTimeSeconds", 2, "months")).toBe(60 * 86_400)
    expect(manualValueToCanonical("accountAgeDays", 3, "months")).toBe(90)
    expect(manualValueToCanonical("accountRatio", 1.5, "count")).toBe(1.5)
  })
})

describe("manual value normalization", () => {
  it("keeps a valid value and defaults a missing unit to the first option", () => {
    expect(
      normalizeRankManualValue("seedSizeBytes", {
        value: 2,
        enteredAt: "2026-10-30",
      })
    ).toEqual({ value: 2, unit: "GiB", enteredAt: "2026-10-30" })
  })

  it("drops invalid values, dates, metrics and tracker ids", () => {
    expect(normalizeRankManualValue("seedSizeBytes", { value: -1, enteredAt: "2026-10-30" })).toBeNull()
    expect(normalizeRankManualValue("seedSizeBytes", { value: 1, enteredAt: "nope" })).toBeNull()
    expect(
      normalizeRankManualValues({
        seedSizeBytes: { value: 2, unit: "TiB", enteredAt: "2026-10-30" },
        notAMetric: { value: 1, unit: "count", enteredAt: "2026-10-30" },
      })
    ).toEqual({ seedSizeBytes: { value: 2, unit: "TiB", enteredAt: "2026-10-30" } })

    expect(
      parseRankManualValuesFromSettings(
        JSON.stringify({
          rankManualValues: {
            "1": { seedSizeBytes: { value: 2, unit: "TiB", enteredAt: "2026-10-30" } },
            nope: { seedSizeBytes: { value: 2, unit: "TiB", enteredAt: "2026-10-30" } },
          },
        })
      )
    ).toEqual({
      "1": { seedSizeBytes: { value: 2, unit: "TiB", enteredAt: "2026-10-30" } },
    })
  })

  it("reads only the rankManualValues key from dashboard settings", () => {
    expect(
      parseRankManualValuesFromSettings(
        JSON.stringify({
          showLoginTimers: false,
          rankManualValues: {
            "2": { uploadedBytes: { value: 1, unit: "GiB", enteredAt: "2026-10-31" } },
          },
        })
      )
    ).toEqual({
      "2": { uploadedBytes: { value: 1, unit: "GiB", enteredAt: "2026-10-31" } },
    })
  })
})

describe("manual value age", () => {
  it("counts whole days and flags values older than 14 days", () => {
    expect(manualAgeDays("2026-10-31", NOW)).toBe(0)
    expect(manualAgeDays("2026-10-29", NOW)).toBe(2)
    expect(isManualValueStale("2026-10-17", NOW)).toBe(false)
    expect(isManualValueStale("2026-10-16", NOW)).toBe(true)
    expect(formatManualAge("2026-10-31", NOW)).toBe("Entered by you · today")
    expect(formatManualAge("2026-10-28", NOW)).toBe("Entered by you · 3 days ago")
  })
})

describe("unknown copy", () => {
  it("names the tracker and the metric", () => {
    expect(apiDoesNotReportMessage("Upload.cx", "seedSizeBytes")).toBe(
      "Upload.cx's API doesn't report seed size."
    )
    expect(apiDoesNotReportMessage("Zenith", "averageSeedTimeSeconds")).toBe(
      "Zenith's API doesn't report average seed time."
    )
    expect(manualMetricLabel("uploads")).toBe("uploaded torrents")
  })
})
