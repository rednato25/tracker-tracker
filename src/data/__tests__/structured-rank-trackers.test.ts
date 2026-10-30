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
const DAY = 86_400

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

    const shortTrailblazer = evaluate("onlyencodes", "Trailblazer", {
      accountAgeDays: 31,
      uploadedBytes: 3.07 * TiB,
      accountRatio: 0.4,
      seedSizeBytes: 1.87 * TiB,
    })
    expect(shortTrailblazer.status).toBe("unmet")
    expect(shortTrailblazer.progress).toEqual({ met: 2, unmet: 2, unknown: 0, total: 4 })
    expect(shortTrailblazer.conditions.map((condition) => condition.status)).toEqual([
      "unmet",
      "unmet",
      "met",
      "met",
    ])
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

  it("Upload.cx: Member does not exist and the seed, upload-count and combined ladders evaluate", () => {
    const entry = getTrackerBySlug("uploadcx")
    expect(entry?.userClasses.some((userClass) => userClass.name.toLowerCase() === "member")).toBe(
      false
    )

    expect(evaluate("uploadcx", "User", { accountRatio: 0.6 }).status).toBe("met")

    const seeder = evaluate("uploadcx", "Seeder", {
      uploadedBytes: 10 * TiB,
      accountRatio: 0.8,
      accountAgeDays: 30,
      averageSeedTimeSeconds: 30 * DAY,
      seedSizeBytes: 5 * TiB,
    })
    expect(seeder.status).toBe("met")

    const sharer = evaluate("uploadcx", "Sharer", {
      accountRatio: 0.8,
      accountAgeDays: 30,
      averageSeedTimeSeconds: 30 * DAY,
      uploads: 50,
    })
    expect(sharer.status).toBe("met")

    const legend = evaluate("uploadcx", "Legend", {
      uploadedBytes: 150 * TiB,
      accountRatio: 2,
      accountAgeDays: 730,
      averageSeedTimeSeconds: 180 * DAY,
      seedSizeBytes: 50 * TiB,
      uploads: 1000,
    })
    expect(legend.status).toBe("met")
  })

  it("Upload.cx: the parallel ladders branch at User without a single automatic next class", () => {
    const input = inputFor("uploadcx", {})
    const result = evaluateRankGoal({ ...input, currentRank: "User" })
    expect(result.nextRank).toBeNull()
    expect(result.nextRankReason).toMatch(/branches here/)
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

  it("Zenith: Explorer splits into the upload and seedsize paths", () => {
    const entry = getTrackerBySlug("zenith")
    expect(entry?.rankPaths?.map((path) => path.id)).toEqual(["upload", "seedsize"])

    const input = inputFor("zenith", {})
    const result = evaluateRankGoal({ ...input, currentRank: "Explorer" })
    expect(result.nextRank).toBeNull()
    expect(result.nextRankReason).toMatch(/branches here/)
  })

  it("seedpool: every automatic class needs ratio 1.00 and Pool needs the seed-size check", () => {
    expect(evaluate("seedpool", "User", { accountRatio: 0.99 }).status).toBe("unmet")
    expect(evaluate("seedpool", "User", { accountRatio: 1.0 }).status).toBe("met")

    const pool = evaluate("seedpool", "Pool", { accountAgeDays: 30, accountRatio: 1.0 })
    expect(pool.status).toBe("unknown")
    expect(pool.progress).toEqual({ met: 2, unmet: 0, unknown: 1, total: 3 })
  })

  it("V3X: level and XP thresholds stay text-only", () => {
    const input = inputFor("v3x", {})
    const result = evaluateRankGoal({ ...input, currentRank: "Figurant" })
    expect(result.nextRank).toBe("Second rôle")
    expect(result.status).toBe("no-structured-goal")
    expect(rankDefinitionForSlug("v3x")?.goals).toEqual({})
  })

  it("Yu-Scene: User needs ratio 0.70 and the seed ladder uses the corrected ratios", () => {
    expect(evaluate("yuscene", "User", { accountRatio: 0.69 }).status).toBe("unmet")
    expect(evaluate("yuscene", "User", { accountRatio: 0.7 }).status).toBe("met")

    const power = evaluate("yuscene", "PowerUser", {
      accountAgeDays: 30,
      uploadedBytes: 1 * TiB,
      accountRatio: 0.7,
    })
    expect(power.status).toBe("met")

    const seeder = evaluate("yuscene", "Seeder", {
      accountAgeDays: 30,
      accountRatio: 0.7,
    })
    expect(seeder.status).toBe("unknown")
    expect(seeder.progress).toEqual({ met: 2, unmet: 0, unknown: 1, total: 3 })

    const titan = evaluate("yuscene", "Titan", {
      accountAgeDays: 365,
      accountRatio: 5,
      averageSeedTimeSeconds: 180 * DAY,
      seedSizeBytes: 40 * TiB,
    })
    expect(titan.status).toBe("met")
  })

  it("CarPT: Power User needs more than 40,000 seeding points", () => {
    const power = evaluate("carpt", "Power User", {
      accountAgeDays: 28,
      downloadedBytes: 200 * GiB,
      accountRatio: 2.1,
    })
    expect(power.status).toBe("unknown")
    expect(power.progress).toEqual({ met: 3, unmet: 0, unknown: 1, total: 4 })

    const exact = evaluate("carpt", "Power User", {
      accountAgeDays: 28,
      downloadedBytes: 200 * GiB,
      accountRatio: 2.1,
      seedingPoints: 40_000,
    })
    expect(exact.status).toBe("unmet")

    const complete = evaluate("carpt", "Power User", {
      accountAgeDays: 28,
      downloadedBytes: 200 * GiB,
      accountRatio: 2.1,
      seedingPoints: 40_001,
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

  it("M-Team: the login deadline is 40 days and unmodelable rules stay as notes", () => {
    const entry = getTrackerBySlug("mteam")
    expect(entry?.rules?.loginIntervalDays).toBe(40)

    const unresolved = entry?.rankUnresolved ?? []
    expect(unresolved.some((note) => note.startsWith("The first-30-days newbie assessment"))).toBe(
      true
    )
    expect(unresolved.some((note) => note.startsWith("The minimum ratio is tiered"))).toBe(true)
  })

  it("AvistaZ: Member meets the upload, ratio and age thresholds", () => {
    const member = evaluate("avistaz", "Member", {
      accountAgeDays: 7,
      uploadedBytes: 5 * GiB,
      accountRatio: 1.0,
    })
    expect(member.status).toBe("met")
  })

  it("AvistaZ: Member is the highest automatic class and Leech sits below the ladder", () => {
    const entry = getTrackerBySlug("avistaz")
    const automatic =
      entry?.userClasses
        .filter((userClass) => !userClass.outsideLadder)
        .map((userClass) => userClass.name) ?? []
    expect(automatic).toEqual(["Newbie", "Member"])
    expect(entry?.userClasses.find((userClass) => userClass.name === "Leech")?.outsideLadder).toBe(
      "below"
    )
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

  it("DigitalCore: Sentry reads its upload as 1200 GiB, not 1.2 TiB", () => {
    const sentry = evaluate("digitalcore", "Sentry", {
      accountAgeDays: 210,
      uploadedBytes: 1200 * GiB,
      accountRatio: 1.1,
    })
    expect(sentry.status).toBe("met")
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

  it("Portugas: Mouro requires a ratio strictly above 0.40", () => {
    expect(evaluate("portugas", "Mouro", { accountRatio: 0.4 }).status).toBe("unmet")
    expect(evaluate("portugas", "Mouro", { accountRatio: 0.41 }).status).toBe("met")
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
