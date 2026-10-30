import { describe, expect, it } from "vitest"
import { getTrackerBySlug } from "@/data/tracker-registry"
import {
  evaluateRankGoal,
  evaluateRequirementGroup,
  type RankGoalInput,
  type RankGroupResult,
  type RankObservationMap,
  rankDefinitionForSlug,
} from "@/lib/rank-goals"

const NOW = new Date("2026-10-30T12:00:00.000Z")
const GiB = 1024 ** 3
const TiB = 1024 ** 4

type Values = Partial<Record<keyof RankObservationMap, number>>

function observations(values: Values): RankObservationMap {
  return Object.fromEntries(
    Object.entries(values).map(([metric, value]) => [
      metric,
      {
        value,
        freshness: "fresh" as const,
        source: "api" as const,
        observedAt: NOW.toISOString(),
      },
    ])
  ) as RankObservationMap
}

function inputFor(slug: string, values: Values): RankGoalInput {
  const entry = getTrackerBySlug(slug)
  if (!entry) throw new Error(`registry entry missing for ${slug}`)
  return {
    userClasses: entry.userClasses,
    rankPaths: entry.rankPaths,
    currentRank: null,
    observations: observations(values),
    now: NOW,
    joinedAt: null,
    structuredGoals: rankDefinitionForSlug(slug)?.goals ?? {},
  }
}

function evaluate(slug: string, target: string, values: Values): RankGroupResult {
  const input = inputFor(slug, values)
  const goal = input.structuredGoals?.[target]
  if (!goal) throw new Error(`${slug} has no structured goal for ${target}`)
  return evaluateRequirementGroup(goal, input, target)
}

describe("P35 structured rank requirements", () => {
  it("MyAnonaMouse: Power User meets the published age, upload and ratio thresholds", () => {
    const result = evaluate("myanonamouse", "Power User", {
      accountAgeDays: 28,
      uploadedBytes: 25 * GiB,
      accountRatio: 2,
    })
    expect(result.status).toBe("met")
  })

  it("OnlyEncodes: Explorer meets numeric thresholds and seed-size classes stay unknown", () => {
    const explorer = evaluate("onlyencodes", "Explorer", {
      accountAgeDays: 30,
      uploadedBytes: 1 * TiB,
      accountRatio: 0.4,
    })
    expect(explorer.status).toBe("met")

    const trailblazer = evaluate("onlyencodes", "Trailblazer", {
      accountAgeDays: 60,
      uploadedBytes: 5 * TiB,
      accountRatio: 0.4,
    })
    expect(trailblazer.status).toBe("unknown")
    expect(trailblazer.progress).toEqual({ met: 3, unmet: 0, unknown: 1, total: 4 })
  })

  it("RetroToon World: Toon Hero meets the confirmed thresholds and Toon Superstar is met at 89 days", () => {
    const hero = evaluate("retrotoon", "Toon Hero", {
      accountAgeDays: 14,
      uploadedBytes: 50 * GiB,
      accountRatio: 1.05,
    })
    expect(hero.status).toBe("met")

    const superstar = evaluate("retrotoon", "Toon Superstar", {
      accountAgeDays: 89,
      uploadedBytes: 1.32 * TiB,
      accountRatio: 2.5,
    })
    expect(superstar.status).toBe("met")
  })

  it("Upload.cx: Member meets numeric thresholds and Master needs seed checks", () => {
    const member = evaluate("uploadcx", "Member", {
      accountAgeDays: 14,
      uploadedBytes: 1 * TiB,
      accountRatio: 0.6,
    })
    expect(member.status).toBe("met")

    const master = evaluate("uploadcx", "Master", {
      accountAgeDays: 120,
      uploadedBytes: 50 * TiB,
      accountRatio: 1.1,
    })
    expect(master.status).toBe("unknown")
    expect(master.progress).toEqual({ met: 3, unmet: 0, unknown: 2, total: 5 })
  })

  it("Zenith: Bulker evaluates age, uploads, seed size and seed time", () => {
    const bulker = evaluate("zenith", "Bulker", {
      accountAgeDays: 30,
      uploads: 100,
    })
    expect(bulker.status).toBe("unknown")
    expect(bulker.progress).toEqual({ met: 2, unmet: 0, unknown: 2, total: 4 })

    const complete = evaluate("zenith", "Bulker", {
      accountAgeDays: 30,
      uploads: 100,
      seedSizeBytes: 512 * GiB,
      averageSeedTimeSeconds: 14 * 86_400,
    })
    expect(complete.status).toBe("met")
  })

  it("seedpool: User meets the ratio floor and Pool needs the seed-size check", () => {
    const user = evaluate("seedpool", "User", { accountRatio: 0.4 })
    expect(user.status).toBe("met")

    const pool = evaluate("seedpool", "Pool", { accountAgeDays: 30 })
    expect(pool.status).toBe("unknown")
    expect(pool.progress).toEqual({ met: 1, unmet: 0, unknown: 1, total: 2 })
  })

  it("V3X: level and XP thresholds stay text-only", () => {
    const input = inputFor("v3x", {})
    const result = evaluateRankGoal({ ...input, currentRank: "Figurant" })
    expect(result.nextRank).toBe("Second rôle")
    expect(result.status).toBe("no-structured-goal")
    expect(rankDefinitionForSlug("v3x")?.goals).toEqual({})
  })

  it("Yu-Scene: PowerUser meets numeric thresholds and Seeder needs the seed-size check", () => {
    const power = evaluate("yuscene", "PowerUser", {
      accountAgeDays: 30,
      uploadedBytes: 1 * TiB,
      accountRatio: 0.4,
    })
    expect(power.status).toBe("met")

    const seeder = evaluate("yuscene", "Seeder", {
      accountAgeDays: 30,
      accountRatio: 0.4,
    })
    expect(seeder.status).toBe("unknown")
    expect(seeder.progress).toEqual({ met: 2, unmet: 0, unknown: 1, total: 3 })
  })

  it("CarPT: Power User evaluates seeding points with the other thresholds", () => {
    const power = evaluate("carpt", "Power User", {
      accountAgeDays: 28,
      downloadedBytes: 200 * GiB,
      accountRatio: 2.1,
    })
    expect(power.status).toBe("unknown")
    expect(power.progress).toEqual({ met: 3, unmet: 0, unknown: 1, total: 4 })

    const complete = evaluate("carpt", "Power User", {
      accountAgeDays: 28,
      downloadedBytes: 200 * GiB,
      accountRatio: 2.1,
      seedingPoints: 40_000,
    })
    expect(complete.status).toBe("met")
  })

  it("FileList: Power User meets the clear thresholds, Addict is met at 4.85 and Elite is unmet", () => {
    const power = evaluate("filelist", "Power User", {
      accountAgeDays: 28,
      uploadedBytes: 25 * GiB,
      accountRatio: 1.06,
    })
    expect(power.status).toBe("met")

    const addictValues = {
      accountAgeDays: 182,
      uploadedBytes: 500 * GiB,
      accountRatio: 4.85,
    }
    expect(evaluate("filelist", "Addict", addictValues).status).toBe("met")
    expect(evaluate("filelist", "Elite", addictValues).status).toBe("unmet")
  })

  it("M-Team: Power User meets strict greater-than thresholds and Elite User needs more age", () => {
    const power = evaluate("mteam", "Power User", {
      accountAgeDays: 29,
      downloadedBytes: 200 * GiB + 1,
      accountRatio: 2.1,
    })
    expect(power.status).toBe("met")

    const elite = evaluate("mteam", "Elite User", {
      accountAgeDays: 29,
      downloadedBytes: 200 * GiB + 1,
      accountRatio: 2.1,
    })
    expect(elite.status).toBe("unmet")
  })

  it("AvistaZ: Member meets the upload, ratio and age thresholds", () => {
    const member = evaluate("avistaz", "Member", {
      accountAgeDays: 7,
      uploadedBytes: 5 * GiB,
      accountRatio: 1.0,
    })
    expect(member.status).toBe("met")
  })

  it("DigitalCore: Sentinel meets its numeric thresholds and Viceroy needs more age", () => {
    const sentinel = evaluate("digitalcore", "Sentinel", {
      accountAgeDays: 14,
      uploadedBytes: 50 * GiB,
      accountRatio: 1.05,
    })
    expect(sentinel.status).toBe("met")

    const viceroy = evaluate("digitalcore", "Viceroy", {
      accountAgeDays: 14,
      uploadedBytes: 50 * GiB,
      accountRatio: 1.05,
    })
    expect(viceroy.status).toBe("unmet")
  })

  it("DreadVault: Wanderer meets numeric thresholds and Shadow Walker needs seed checks", () => {
    const wanderer = evaluate("dreadvault", "Wanderer", {
      accountAgeDays: 30,
      uploadedBytes: 1 * TiB,
      accountRatio: 0.4,
    })
    expect(wanderer.status).toBe("met")

    const shadow = evaluate("dreadvault", "Shadow Walker", {
      accountAgeDays: 30,
      accountRatio: 0.4,
    })
    expect(shadow.status).toBe("unknown")
    expect(shadow.progress).toEqual({ met: 2, unmet: 0, unknown: 2, total: 4 })
  })

  it("SeedCore: PowerUser meets numeric thresholds and Seeder needs seed checks", () => {
    const power = evaluate("seedcore", "PowerUser", {
      accountAgeDays: 30,
      uploadedBytes: 1 * TiB,
      accountRatio: 0.4,
    })
    expect(power.status).toBe("met")

    const seeder = evaluate("seedcore", "Seeder", {
      accountAgeDays: 30,
      accountRatio: 0.4,
    })
    expect(seeder.status).toBe("unknown")
    expect(seeder.progress).toEqual({ met: 2, unmet: 0, unknown: 2, total: 4 })
  })

  it("Retro Movies Club: Film Buff meets numeric thresholds and Superstar needs seed checks", () => {
    const filmBuff = evaluate("retromoviesclub", "Film Buff", {
      accountAgeDays: 30,
      uploadedBytes: 1 * TiB,
      accountRatio: 0.4,
    })
    expect(filmBuff.status).toBe("met")

    const superstar = evaluate("retromoviesclub", "Superstar", {
      accountAgeDays: 30,
      accountRatio: 0.4,
    })
    expect(superstar.status).toBe("unknown")
    expect(superstar.progress).toEqual({ met: 2, unmet: 0, unknown: 2, total: 4 })
  })

  it("Portugas: Hispanus meets the published thresholds and Portuga needs more upload", () => {
    const hispanus = evaluate("portugas", "Hispanus", {
      accountAgeDays: 90,
      uploadedBytes: 250 * GiB,
      accountRatio: 1.25,
    })
    expect(hispanus.status).toBe("met")

    const portugas = evaluate("portugas", "Portuga", {
      accountAgeDays: 90,
      uploadedBytes: 250 * GiB,
      accountRatio: 1.25,
    })
    expect(portugas.status).toBe("unmet")
  })
})
