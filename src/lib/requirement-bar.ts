// src/lib/requirement-bar.ts
//
// Bar geometry for rank and pathway requirements. A strict operator (above or
// below) is not met at equality, so equality gets a shortfall marker at the
// threshold rather than a nearly full red fill.

import type { RankComparison, RankGoalStatus } from "@/lib/rank-goals"

interface RequirementBarGeometry {
  percent: number
  atStrictThreshold: boolean
}

function requirementBarGeometry({
  currentValue,
  requiredValue,
  comparison,
  status,
}: {
  currentValue: number | null
  requiredValue: number
  comparison: RankComparison
  status: RankGoalStatus
}): RequirementBarGeometry {
  if (currentValue === null || requiredValue <= 0) {
    return { percent: 0, atStrictThreshold: false }
  }

  const strict = comparison === "gt" || comparison === "lt"
  if (strict && status === "unmet" && currentValue === requiredValue) {
    return { percent: 0, atStrictThreshold: true }
  }

  let ratio = Math.min(1, currentValue / requiredValue)
  if (comparison === "lte" || comparison === "lt") {
    ratio = Math.min(1, requiredValue / Math.max(currentValue, 1))
  } else if (comparison === "eq") {
    ratio = status === "met" ? 1 : 0
  }
  return { percent: Math.round(ratio * 100), atStrictThreshold: false }
}

function strictThresholdRequirement(
  comparison: RankComparison,
  current: string,
  required: string
): string | null {
  if (comparison === "gt") return `Needs above ${required}, now ${current}`
  if (comparison === "lt") return `Needs below ${required}, now ${current}`
  return null
}

export type { RequirementBarGeometry }
export { requirementBarGeometry, strictThresholdRequirement }
