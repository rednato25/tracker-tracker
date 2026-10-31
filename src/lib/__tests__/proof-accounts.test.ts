import { describe, expect, it } from "vitest"
import {
  buildProofAccounts,
  buildProofProfileUrl,
  evaluateProofAccounts,
  findProofRequirement,
  nextProofQualification,
  parseProofRequirement,
  proofAccountAgeDays,
} from "@/lib/proof-accounts"
import type { TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-31T12:00:00.000Z")

const BASE_STATS: NonNullable<TrackerSummary["latestStats"]> = {
  ratio: 2.5,
  ratioIsInfinite: false,
  uploadedBytes: "1000000000",
  downloadedBytes: "400000000",
  bufferBytes: "600000000",
  seedingCount: 3,
  leechingCount: 0,
  requiredRatio: 1,
  warned: false,
  freeleechTokens: 0,
  hitAndRuns: 0,
  seedbonus: 100,
  shareScore: null,
  username: "owner",
  group: "Power User",
}

function stats(
  overrides: Partial<NonNullable<TrackerSummary["latestStats"]>> = {}
): NonNullable<TrackerSummary["latestStats"]> {
  return { ...BASE_STATS, ...overrides }
}

function tracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "TorrentLeech",
    baseUrl: "https://tl.example",
    registrySlug: "torrentleech",
    platformType: "unit3d",
    isActive: true,
    lastPolledAt: "2026-10-26T10:00:00.000Z",
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    color: "#123456",
    qbtTag: null,
    mouseholeUrl: null,
    hasMouseholeToken: false,
    useProxy: false,
    countCrossSeedUnsatisfied: false,
    hideUnreadBadges: false,
    isFavorite: false,
    sortOrder: 1,
    joinedAt: "2024-01-31T12:00:00.000Z",
    lastAccessAt: null,
    remoteUserId: null,
    platformMeta: null,
    createdAt: "2024-01-31T12:00:00.000Z",
    latestStats: stats(),
    ...overrides,
  }
}

describe("buildProofProfileUrl", () => {
  it("fills a username pattern from the registry", () => {
    expect(
      buildProofProfileUrl({
        baseUrl: "https://aither.example",
        pattern: "/users/{username}",
        username: "alice",
        userId: null,
      })
    ).toBe("https://aither.example/users/alice")
  })

  it("fills an id pattern", () => {
    expect(
      buildProofProfileUrl({
        baseUrl: "https://tl.example",
        pattern: "/user.php?id={id}",
        username: null,
        userId: 42,
      })
    ).toBe("https://tl.example/user.php?id=42")
  })

  it("encodes a username instead of pasting raw text into the URL", () => {
    expect(
      buildProofProfileUrl({
        baseUrl: "https://aither.example",
        pattern: "/users/{username}",
        username: "a b/c",
        userId: null,
      })
    ).toBe("https://aither.example/users/a%20b%2Fc")
  })

  it("omits the link when the pattern or the value is unknown", () => {
    expect(
      buildProofProfileUrl({
        baseUrl: "https://aither.example",
        pattern: "",
        username: "alice",
        userId: null,
      })
    ).toBeNull()
    expect(
      buildProofProfileUrl({
        baseUrl: "https://aither.example",
        pattern: "/users/{username}",
        username: null,
        userId: null,
      })
    ).toBeNull()
    expect(
      buildProofProfileUrl({
        baseUrl: "https://aither.example",
        pattern: "/user.php?id={id}",
        username: "alice",
        userId: null,
      })
    ).toBeNull()
  })

  it("never builds a URL from a redacted username", () => {
    expect(
      buildProofProfileUrl({
        baseUrl: "https://aither.example",
        pattern: "/users/{username}",
        username: "▓5",
        userId: null,
      })
    ).toBeNull()
  })
})

describe("proof accounts", () => {
  it("lists every account with class, age, ratio and the registry profile link", () => {
    const accounts = buildProofAccounts(
      [
        tracker({ id: 1, name: "TorrentLeech" }),
        tracker({
          id: 2,
          name: "Aither",
          baseUrl: "https://aither.example",
          registrySlug: "aither",
          joinedAt: "2025-01-31T12:00:00.000Z",
          latestStats: stats({
            ratio: null,
            ratioIsInfinite: true,
            username: "alice",
            group: "Zeus",
          }),
        }),
        tracker({
          id: 3,
          name: "Custom",
          baseUrl: "https://custom.example",
          registrySlug: null,
          joinedAt: null,
          latestStats: null,
        }),
      ],
      NOW
    )

    expect(accounts).toHaveLength(3)
    expect(accounts[0]).toMatchObject({
      trackerName: "TorrentLeech",
      className: "Power User",
      ratio: 2.5,
      profileUrl: "https://tl.example/profile/owner",
    })
    expect(accounts[0]?.accountAgeDays).toBe(
      proofAccountAgeDays("2024-01-31T12:00:00.000Z", NOW)
    )
    expect(accounts[1]).toMatchObject({
      className: "Zeus",
      profileUrl: "https://aither.example/users/alice",
    })
    expect(accounts[1]?.ratioIsInfinite).toBe(true)
    expect(accounts[2]).toMatchObject({
      className: null,
      accountAgeDays: null,
      profileUrl: null,
    })
  })
})

describe("parseProofRequirement", () => {
  it("reads the count-and-age shorthand", () => {
    expect(parseProofRequirement("3x 6 months old profile links")).toMatchObject({
      count: 3,
      ageMonths: 6,
    })
  })

  it("reads proof links written as prose", () => {
    expect(
      parseProofRequirement("2 extra tracker proofs that are 6 months old")
    ).toMatchObject({ count: 2, ageMonths: 6 })
    expect(parseProofRequirement("Legend, 1 year, 3 profile links")).toMatchObject({
      count: 3,
      ageMonths: 12,
    })
  })

  it("leaves prose without both a count and an age unparsed", () => {
    expect(parseProofRequirement("6 months, 4TB upload")).toBeNull()
    expect(parseProofRequirement("3 profile links")).toBeNull()
    expect(parseProofRequirement("ratio>=1.0")).toBeNull()
    expect(parseProofRequirement(null)).toBeNull()
  })

  it("takes the first parseable route text", () => {
    expect(
      findProofRequirement([null, "6 months, 4TB upload", "2 profile links 6 months old"])
    ).toMatchObject({ count: 2, ageMonths: 6 })
  })
})

describe("evaluateProofAccounts", () => {
  const accounts = buildProofAccounts(
    [
      tracker({ id: 1, name: "Old", joinedAt: "2026-01-31T12:00:00.000Z" }),
      tracker({
        id: 2,
        name: "Young",
        joinedAt: "2026-07-31T12:00:00.000Z",
        latestStats: stats({ ratio: 2.5 }),
      }),
      tracker({
        id: 3,
        name: "LowRatio",
        joinedAt: "2024-01-31T12:00:00.000Z",
        latestStats: stats({ ratio: 0.5 }),
      }),
      tracker({ id: 4, name: "NoAge", joinedAt: null }),
    ],
    NOW
  )

  it("qualifies an account that meets age and ratio", () => {
    const rows = evaluateProofAccounts(accounts, { minAgeMonths: 6, minRatio: 1 }, NOW)
    expect(rows.find((row) => row.account.trackerName === "Old")).toMatchObject({
      qualifies: true,
      blockedBy: null,
    })
    expect(rows.find((row) => row.account.trackerName === "LowRatio")).toMatchObject({
      qualifies: false,
      blockedBy: "ratio",
    })
  })

  it("dates the day a young account becomes old enough", () => {
    const rows = evaluateProofAccounts(accounts, { minAgeMonths: 6, minRatio: 0 }, NOW)
    const young = rows.find((row) => row.account.trackerName === "Young")
    expect(young?.qualifies).toBe(false)
    expect(young?.blockedBy).toBe("age")
    expect(young?.daysUntilQualifies).toBe(91)
    expect(young?.qualifiesOn).not.toBeNull()
    expect(rows.find((row) => row.account.trackerName === "NoAge")).toMatchObject({
      qualifies: false,
      blockedBy: "age",
      daysUntilQualifies: null,
    })
  })

  it("treats a zero minimum as no filter, including unknown ratio", () => {
    const rows = evaluateProofAccounts(accounts, { minAgeMonths: 0, minRatio: 0 }, NOW)
    expect(rows.filter((row) => row.qualifies)).toHaveLength(4)
  })

  it("sorts qualifying accounts first, then the nearest future date", () => {
    const rows = evaluateProofAccounts(accounts, { minAgeMonths: 6, minRatio: 1 }, NOW)
    expect(rows[0]?.account.trackerName).toBe("Old")
    expect(rows[1]?.account.trackerName).toBe("Young")
    expect(nextProofQualification(rows)).toMatchObject({
      accountName: "Young",
      days: 91,
    })
  })
})
