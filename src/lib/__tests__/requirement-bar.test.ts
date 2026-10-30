import { describe, expect, it } from "vitest"
import { requirementBarGeometry, strictThresholdRequirement } from "@/lib/requirement-bar"

describe("requirementBarGeometry", () => {
  it("uses a shortfall marker at a strict threshold instead of a full red fill", () => {
    expect(
      requirementBarGeometry({
        currentValue: 2,
        requiredValue: 2,
        comparison: "gt",
        status: "unmet",
      })
    ).toEqual({ percent: 0, atStrictThreshold: true })
    expect(
      requirementBarGeometry({
        currentValue: 2,
        requiredValue: 2,
        comparison: "lt",
        status: "unmet",
      })
    ).toEqual({ percent: 0, atStrictThreshold: true })
  })

  it("keeps a normal fill below a strict threshold and a full fill above it", () => {
    expect(
      requirementBarGeometry({
        currentValue: 1,
        requiredValue: 2,
        comparison: "gt",
        status: "unmet",
      })
    ).toEqual({ percent: 50, atStrictThreshold: false })
    expect(
      requirementBarGeometry({
        currentValue: 3,
        requiredValue: 2,
        comparison: "gt",
        status: "met",
      })
    ).toEqual({ percent: 100, atStrictThreshold: false })
  })

  it("does not flag equality as a shortfall for gte", () => {
    expect(
      requirementBarGeometry({
        currentValue: 2,
        requiredValue: 2,
        comparison: "gte",
        status: "met",
      })
    ).toEqual({ percent: 100, atStrictThreshold: false })
  })
})

describe("strictThresholdRequirement", () => {
  it("writes above and below requirements with the current value", () => {
    expect(strictThresholdRequirement("gt", "2.00", "2.00")).toBe("Needs above 2.00, now 2.00")
    expect(strictThresholdRequirement("lt", "2.00", "2.00")).toBe("Needs below 2.00, now 2.00")
    expect(strictThresholdRequirement("gte", "2.00", "2.00")).toBeNull()
  })
})
