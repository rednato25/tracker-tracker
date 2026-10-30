// src/lib/rank-progression.ts
//
// P47 progression projection for the tracker detail page. It turns the flat
// registry class list into one left-aligned row per earned ladder or branch,
// keeping staff and off-ladder classes separate. Each class carries its own
// met/unknown counts from the P09 evaluator.

import type { TrackerRankPath, TrackerUserClass } from "@/data/tracker-registry"
import {
  evaluateRequirementGroup,
  type RankGoalInput,
  type RankObservationMap,
} from "@/lib/rank-goals"
import type { RankManualValues } from "@/lib/rank-manual-values"

export interface RankProgressionClass {
  name: string
  requirements: string | null
  outsideLadder: "above" | "below" | null
  isCurrent: boolean
  isTarget: boolean
  progress: { met: number; unknown: number; total: number } | null
}

export interface RankProgressionRow {
  id: string
  label: string
  hint: string
  classes: RankProgressionClass[]
}

export interface RankProgression {
  shared: RankProgressionClass[]
  rows: RankProgressionRow[]
  outside: RankProgressionClass[]
}

export interface RankProgressionInput {
  userClasses: TrackerUserClass[]
  rankPaths?: TrackerRankPath[]
  currentRank: string | null
  targetRank: string | null
  observations: RankObservationMap
  manualValues?: RankManualValues
  now: Date
  joinedAt?: string | null
}

function sameClass(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase())
}

function progressFor(
  userClass: TrackerUserClass,
  input: RankProgressionInput
): RankProgressionClass["progress"] {
  if (!userClass.structured) return null
  const goalInput: RankGoalInput = {
    userClasses: input.userClasses,
    rankPaths: input.rankPaths,
    currentRank: input.currentRank,
    observations: input.observations,
    manualValues: input.manualValues,
    now: input.now,
    joinedAt: input.joinedAt,
    structuredGoals: {},
  }
  const result = evaluateRequirementGroup(userClass.structured, goalInput, userClass.name)
  return {
    met: result.progress.met,
    unknown: result.progress.unknown,
    total: result.progress.total,
  }
}

function toClass(
  userClass: TrackerUserClass,
  input: RankProgressionInput
): RankProgressionClass {
  return {
    name: userClass.name,
    requirements: userClass.requirements ?? null,
    outsideLadder: userClass.outsideLadder ?? null,
    isCurrent: sameClass(userClass.name, input.currentRank),
    isTarget: sameClass(userClass.name, input.targetRank),
    progress: userClass.outsideLadder ? null : progressFor(userClass, input),
  }
}

export function buildRankProgression(input: RankProgressionInput): RankProgression {
  const earned = input.userClasses.filter((userClass) => !userClass.outsideLadder)
  const outside = input.userClasses
    .filter((userClass) => userClass.outsideLadder)
    .map((userClass) => toClass(userClass, input))

  if (input.rankPaths && input.rankPaths.length > 0) {
    const shared = earned
      .filter((userClass) => !userClass.path)
      .map((userClass) => toClass(userClass, input))
    const rows = input.rankPaths.map((path) => {
      const classes = earned
        .filter((userClass) => userClass.path === path.id)
        .map((userClass) => toClass(userClass, input))
      return {
        id: path.id,
        label: path.label,
        hint: path.description ?? "Branch of the shared ladder",
        classes,
      }
    })
    return { shared, rows, outside }
  }

  return {
    shared: [],
    rows: [
      {
        id: "ladder",
        label: "Class ladder",
        hint: "Earned classes, lowest first",
        classes: earned.map((userClass) => toClass(userClass, input)),
      },
    ],
    outside,
  }
}
