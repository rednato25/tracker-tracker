import { describe, expect, it, vi } from "vitest"
import type { TrackerRegistryEntry, TrackerRules } from "@/data/tracker-registry"
import { registryEntryFor } from "@/data/tracker-registry"
import { type ActionInput, computeTrackerActions } from "@/lib/actions"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"

vi.mock("@/data/tracker-registry", () => ({
  registryEntryFor: vi.fn(),
}))

const mockEntry = vi.mocked(registryEntryFor)
const NOW = new Date("2026-10-24T12:00:00.000Z")

function setRules(rules?: Partial<TrackerRules>) {
  const resolved: TrackerRules = {
    minimumRatio: 0,
    seedTimeHours: 0,
    loginIntervalDays: 0,
    ...rules,
  }
  mockEntry.mockReturnValue({ rules: resolved } as TrackerRegistryEntry)
}

function stats(overrides: Partial<TrackerLatestStats> = {}): TrackerLatestStats {
  return {
    ratio: 1.5,
    ratioIsInfinite: false,
    seedingCount: 4,
    leechingCount: 0,
    requiredRatio: null,
    warned: false,
    freeleechTokens: null,
    hitAndRuns: 0,
    seedbonus: null,
    shareScore: null,
    username: "synthetic",
    group: "Member",
    uploadedBytes: "1000",
    downloadedBytes: "500",
    bufferBytes: "500",
    ...overrides,
  }
}

function tracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "Synthetic",
    baseUrl: "https://tracker.example.test",
    registrySlug: "synthetic",
    platformType: "unit3d",
    isActive: true,
    lastPolledAt: "2026-10-24T11:00:00.000Z",
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    color: "#000000",
    qbtTag: null,
    mouseholeUrl: null,
    hasMouseholeToken: false,
    useProxy: false,
    countCrossSeedUnsatisfied: false,
    hideUnreadBadges: false,
    isFavorite: false,
    sortOrder: null,
    joinedAt: null,
    lastAccessAt: null,
    remoteUserId: null,
    platformMeta: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    latestStats: stats(),
    ...overrides,
  }
}

function run(overrides: Partial<ActionInput> = {}) {
  return computeTrackerActions({ trackers: [tracker()], now: NOW, ...overrides })
}

describe("computeTrackerActions — rules and data", () => {
  it("raises a confirmed account ratio action only below the threshold", () => {
    setRules({ minimumRatio: 1.0 })
    expect(run({ trackers: [tracker({ latestStats: stats({ ratio: 0.99 }) })] })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "ratio-below-account",
          status: "action-required",
          key: "ratio-below-account:tracker:1",
        }),
      ])
    )
    expect(
      run({ trackers: [tracker({ latestStats: stats({ ratio: 1.0 }) })] }).some(
        (action) => action.type === "ratio-below-account"
      )
    ).toBe(false)
  })

  it("does not turn an unknown rule set into a zero or a violation", () => {
    mockEntry.mockReturnValue(undefined)
    const actions = run({ trackers: [tracker({ latestStats: stats({ ratio: 0.1 }) })] })
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "verify-rules", status: "needs-verification" }),
      ])
    )
    expect(actions.some((action) => action.type === "ratio-below-account")).toBe(false)
    expect(actions.some((action) => action.status === "action-required")).toBe(false)
  })

  it("keeps a confirmed zero requirement quiet", () => {
    setRules({ minimumRatio: 0 })
    const actions = run({ trackers: [tracker({ latestStats: stats({ ratio: 0.01 }) })] })
    expect(actions.some((action) => action.type === "ratio-below-account")).toBe(false)
  })

  it("treats stale evidence as needs-verification, not a violation", () => {
    setRules({ minimumRatio: 1.0 })
    const actions = run({
      trackers: [
        tracker({
          lastPolledAt: "2026-10-24T08:00:00.000Z",
          latestStats: stats({ ratio: 0.5 }),
        }),
      ],
    })
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "stale-data",
          status: "needs-verification",
          priority: "high",
        }),
      ])
    )
    expect(actions.some((action) => action.type === "ratio-below-account")).toBe(false)
  })

  it("reports missing stats as verification, never healthy", () => {
    setRules({ minimumRatio: 1.0 })
    const actions = run({ trackers: [tracker({ latestStats: null, lastPolledAt: null })] })
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "verify-data", status: "needs-verification" }),
      ])
    )
    expect(actions.every((action) => action.status !== "action-required")).toBe(true)
  })
})

describe("computeTrackerActions — login", () => {
  it("marks an overdue manual login with a derived deadline", () => {
    setRules({ loginIntervalDays: 30 })
    const actions = run({ trackers: [tracker({ lastAccessAt: "2026-09-01" })] })
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "login-overdue",
          status: "action-required",
          deadline: "2026-10-01",
        }),
      ])
    )
  })

  it("shows a due reminder inside the window and stays quiet before it", () => {
    setRules({ loginIntervalDays: 30 })
    expect(
      run({ trackers: [tracker({ lastAccessAt: "2026-09-25" })] }).some(
        (action) => action.type === "login-due"
      )
    ).toBe(true)
    expect(
      run({ trackers: [tracker({ lastAccessAt: "2026-10-20" })] }).some((action) =>
        action.type.startsWith("login-")
      )
    ).toBe(false)
  })

  it("does not infer login evidence from polling", () => {
    setRules({ loginIntervalDays: 30 })
    const actions = run({
      trackers: [tracker({ lastAccessAt: null, lastPolledAt: "2026-10-24T11:00:00.000Z" })],
    })
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "login-evidence-missing",
          status: "needs-verification",
          deadline: null,
        }),
      ])
    )
    expect(actions.some((action) => action.type === "login-overdue")).toBe(false)
  })
})

describe("computeTrackerActions — obligations and integrations", () => {
  it("separates a satisfied account ratio from an unmet torrent obligation", () => {
    setRules({ minimumRatio: 1.0, requiredTorrentRatio: 1.0, seedTimeHours: 0 })
    const actions = run({
      trackers: [tracker({ latestStats: stats({ ratio: 2.0 }) })],
      torrents: [
        {
          trackerId: 1,
          hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          name: "Synthetic torrent",
          seedingTime: 0,
          ratio: 0.5,
        },
      ],
    })
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "seeding-obligation",
          status: "action-required",
          torrentHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        }),
      ])
    )
    expect(actions.some((action) => action.type === "ratio-below-account")).toBe(false)
  })

  it("reports H&R and client failures as actions without invented deadlines", () => {
    setRules({ minimumRatio: 1.0 })
    const actions = run({
      trackers: [tracker({ latestStats: stats({ hitAndRuns: 2 }) })],
      clients: [{ id: 7, name: "Synthetic qbt", enabled: true, lastError: "connection refused" }],
    })
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "hit-and-run", deadline: null, status: "action-required" }),
        expect.objectContaining({ type: "client-error", clientId: 7, deadline: null }),
      ])
    )
  })

  it("classifies generic poll failures as local verification, not a tracker outage", () => {
    setRules({ minimumRatio: 1.0 })
    const generic = run({
      trackers: [tracker({ lastError: "socket closed", lastErrorAt: "2026-10-24T11:00:00.000Z" })],
    })
    expect(generic).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "poll-error", status: "needs-verification" }),
      ])
    )
    expect(generic.some((action) => action.type === "auth-error")).toBe(false)
  })

  it("uses auth-error only for an explicit authentication status", () => {
    setRules({ minimumRatio: 1.0 })
    const actions = run({
      trackers: [tracker({ lastError: "HTTP 401 unauthorized", lastErrorAt: "2026-10-24T11:00:00.000Z" })],
    })
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "auth-error", status: "action-required" }),
      ])
    )
  })
})

describe("computeTrackerActions — determinism", () => {
  it("deduplicates equivalent keys and sorts deterministically", () => {
    setRules({ minimumRatio: 1.0, requiredTorrentRatio: 1.0, loginIntervalDays: 30 })
    const actions = run({
      trackers: [tracker({ lastAccessAt: "2026-09-01", latestStats: stats({ ratio: 0.5 }) })],
      torrents: [
        {
          trackerId: 1,
          hash: "same",
          name: "A",
          seedingTime: 0,
          ratio: 0,
        },
        {
          trackerId: 1,
          hash: "same",
          name: "B",
          seedingTime: 0,
          ratio: 0,
        },
      ],
    })
    const keys = actions.map((action) => action.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys[0]).toBe("login-overdue:tracker:1")
    expect(keys).toContain("ratio-below-account:tracker:1")
    expect(keys.at(-1)).toBe("seeding-obligation:tracker:1:torrent:same")
    expect(
      run({
        trackers: [tracker({ lastAccessAt: "2026-09-01", latestStats: stats({ ratio: 0.5 }) })],
        torrents: [
          { trackerId: 1, hash: "same", name: "A", seedingTime: 0, ratio: 0 },
        ],
      })
    ).toEqual(actions)
  })

  it("lets resolved conditions disappear and reappear", () => {
    setRules({ minimumRatio: 1.0 })
    const below = run({ trackers: [tracker({ latestStats: stats({ ratio: 0.5 }) })] })
    expect(below.some((action) => action.type === "ratio-below-account")).toBe(true)
    const above = run({ trackers: [tracker({ latestStats: stats({ ratio: 1.0 }) })] })
    expect(above.some((action) => action.type === "ratio-below-account")).toBe(false)
    const again = run({ trackers: [tracker({ latestStats: stats({ ratio: 0.5 }) })] })
    expect(again).toEqual(below)
  })

  it("ignores disabled trackers", () => {
    setRules({ minimumRatio: 1.0, loginIntervalDays: 30 })
    expect(run({ trackers: [tracker({ isActive: false, latestStats: stats({ ratio: 0.1 }) })] })).toEqual([])
  })

  it("produces the same result for the same input", () => {
    setRules({ minimumRatio: 1.0 })
    const input = { trackers: [tracker({ latestStats: stats({ ratio: 0.5 }) })], now: NOW }
    expect(computeTrackerActions(input)).toEqual(computeTrackerActions(input))
  })
})
