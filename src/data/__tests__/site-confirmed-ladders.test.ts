// Thresholds read off each site's own class page by the owner on 2026-11-11.
import { describe, expect, it } from "vitest"
import { getTrackerBySlug } from "@/data/tracker-registry"
import type { RankRequirementGroup } from "@/lib/rank-goals"

const TiB = 1024 ** 4

function conditionsOf(slug: string, className: string) {
  const entry = getTrackerBySlug(slug)
  const userClass = entry?.userClasses.find((candidate) => candidate.name === className)
  const group = userClass?.structured as RankRequirementGroup | undefined
  const flat: { metric?: string; requiredValue?: number | null }[] = []
  const visit = (conditions: RankRequirementGroup["conditions"]) => {
    for (const condition of conditions) {
      if ("conditions" in condition) visit(condition.conditions)
      else flat.push(condition as { metric?: string; requiredValue?: number | null })
    }
  }
  if (group) visit(group.conditions)
  return flat
}

function required(slug: string, className: string, metric: string): number | null | undefined {
  return conditionsOf(slug, className).find((condition) => condition.metric === metric)
    ?.requiredValue
}

describe("site-confirmed class ladders", () => {
  it("marks every confirmed source as published", () => {
    for (const slug of ["dreadvault", "retromoviesclub", "seedcore", "myanonamouse", "speedapp"]) {
      expect(getTrackerBySlug(slug)?.rankRequirementsSource?.verification, slug).toBe("published")
    }
  })

  it("gives DreadVault's upload and seeding classes their upload counts", () => {
    expect(required("dreadvault", "Survivor", "uploads")).toBe(5)
    expect(required("dreadvault", "Night Stalker", "uploads")).toBe(20)
    expect(required("dreadvault", "Grave Keeper", "uploads")).toBe(50)
    expect(required("dreadvault", "Dreadborn", "uploads")).toBe(100)
    expect(required("dreadvault", "Shadow Walker", "uploads")).toBe(5)
    expect(required("dreadvault", "Bloodbound", "uploads")).toBe(10)
    expect(required("dreadvault", "Wanderer", "uploads")).toBeUndefined()
    expect(required("dreadvault", "Bloodbound", "seedSizeBytes")).toBe(10 * TiB)
  })

  it("drops DreadVault classes the Groups page no longer lists and uses its current names", () => {
    const names = getTrackerBySlug("dreadvault")?.userClasses.map((userClass) => userClass.name)
    expect(names).not.toContain("Ancient One")
    expect(names).not.toContain("Elder")
    expect(names).toContain("Plague Doctor")
    expect(names).toContain("Vault Sovereign")
  })

  it("uses SpeedApp's day counts, not rounded years", () => {
    expect(required("speedapp", "User", "accountAgeDays")).toBe(28)
    expect(required("speedapp", "Xtreme User", "accountAgeDays")).toBe(360)
    expect(required("speedapp", "Super User", "accountAgeDays")).toBe(720)
    expect(required("speedapp", "Legend User", "accountAgeDays")).toBe(2160)
  })

  it("keeps User free of a ratio condition where the class page lists none", () => {
    expect(conditionsOf("dreadvault", "User")).toEqual([])
    expect(conditionsOf("seedcore", "User")).toEqual([])
  })
})
