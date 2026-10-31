// src/lib/rank-class-gate.ts
//
// P51: some recruitment gates name a user class ("Elite+", "Power User+", "PU").
// When the tracker's ladder is in the registry, compare that class with the
// class the owner currently holds. This never guesses a class for a tracker
// whose ladder is missing, and it never treats an unlisted current class as
// either met or unmet.

import type { TrackerUserClass } from "@/data/tracker-registry"
import { ladderPosition } from "@/lib/rank-ladder"

export type ClassGateStatus = "met" | "not-yet" | "unknown"

export interface ClassGateComparison {
  /** Registry class names, canonical casing. */
  requiredClasses: string[]
  /** The words the gate actually used, including a trailing "+". */
  written: string[]
  currentClass: string | null
  status: ClassGateStatus
  detail: string
}

interface ClassPattern {
  name: string
  pattern: RegExp
  weight: number
}

function splitWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function aliasPattern(name: string): RegExp {
  const words = splitWords(name).map(escapeRegex)
  // `\s*` accepts "PowerUser", "Power User" and "PU"-style punctuation splits.
  return new RegExp(`^${words.join("\\s*")}\\s*(\\+)?(?=$|[\\s,;:.()])`, "i")
}

function patternsFor(classes: TrackerUserClass[]): ClassPattern[] {
  const patterns: ClassPattern[] = []
  for (const userClass of classes) {
    const pattern = aliasPattern(userClass.name)
    patterns.push({
      name: userClass.name,
      pattern,
      weight: userClass.name.replace(/\s+/g, "").length,
    })
  }

  // "PU" is the community shorthand for Power User. Only use it when that class
  // is actually on this tracker's ladder.
  const powerUser = classes.find((userClass) => {
    const compact = userClass.name.toLowerCase().replace(/[^a-z0-9]/g, "")
    return compact === "poweruser"
  })
  if (powerUser) {
    patterns.push({
      name: powerUser.name,
      pattern: /^PU(?=$|[\s,;:.()+])/i,
      weight: 2,
    })
  }
  return patterns
}

function alternatives(text: string): string[] {
  return text
    .split(/\s+or\s+|;|\n/i)
    .map((part) => part.trim())
    .filter(Boolean)
}

interface Match {
  name: string
  written: string
  weight: number
}

function matches(text: string, classes: TrackerUserClass[]): Match[] {
  const patterns = patternsFor(classes)
  const found = new Map<string, Match>()

  for (const alternative of alternatives(text)) {
    let best: Match | null = null
    for (const candidate of patterns) {
      const match = candidate.pattern.exec(alternative)
      if (!match) continue
      const written = match[0].trim()
      const next: Match = {
        name: candidate.name,
        written: written || candidate.name,
        weight: candidate.weight,
      }
      if (
        !best ||
        next.weight > best.weight ||
        (next.weight === best.weight && next.written.length > best.written.length)
      ) {
        best = next
      }
    }
    if (best && !found.has(best.name)) found.set(best.name, best)
  }

  return [...found.values()]
}

function unique(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index)
}

function detailFor(input: {
  status: ClassGateStatus
  written: string[]
  currentClass: string | null
}): string {
  const required = input.written.join(" or ")
  if (input.status === "met") {
    return `Met (${required}; you are ${input.currentClass})`
  }
  if (input.status === "not-yet") {
    return `Not yet (${required}; you are ${input.currentClass})`
  }
  return input.currentClass
    ? `Class check unavailable (${required}; ${input.currentClass} is not on the registry ladder)`
    : `Class check unavailable (${required}; no current class)`
}

/**
 * Returns null when the text names no class from this tracker's ladder. That is
 * the "ladder is not in the registry" case, not a negative result.
 */
export function compareClassGate(input: {
  texts: (string | null | undefined)[]
  classes: TrackerUserClass[]
  currentClass: string | null | undefined
}): ClassGateComparison | null {
  if (input.classes.length === 0) return null

  const found: Match[] = []
  for (const text of input.texts) {
    if (!text) continue
    for (const match of matches(text, input.classes)) {
      if (!found.some((candidate) => candidate.name === match.name)) found.push(match)
    }
  }
  if (found.length === 0) return null

  const currentClass = input.currentClass?.trim() || null
  const currentIndex = currentClass ? ladderPosition(input.classes, currentClass) : null
  const requiredIndexes = found
    .map((match) => ladderPosition(input.classes, match.name))
    .filter((index): index is number => index !== null)

  let status: ClassGateStatus
  if (currentIndex === null || requiredIndexes.length === 0) {
    status = "unknown"
  } else if (requiredIndexes.some((requiredIndex) => currentIndex >= requiredIndex)) {
    status = "met"
  } else {
    status = "not-yet"
  }

  const written = unique(found.map((match) => match.written))
  return {
    requiredClasses: unique(found.map((match) => match.name)),
    written,
    currentClass,
    status,
    detail: detailFor({ status, written, currentClass }),
  }
}
