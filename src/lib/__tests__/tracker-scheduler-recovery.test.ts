// src/lib/__tests__/tracker-scheduler-recovery.test.ts
//
// P39: failure-paused trackers re-enter the poll queue on their backoff, manual
// pauses do not, and a login-expired stop has no next attempt.

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock("@/lib/tracker-outages", () => ({
  recordTrackerPollFailure: vi.fn(async () => {}),
  pruneTrackerOutages: vi.fn(async () => 0),
}))
vi.mock("@/lib/app-liveness", () => ({ pruneCoverageGaps: vi.fn(async () => 0) }))
vi.mock("@/lib/crypto", () => ({ decrypt: vi.fn(() => "token") }))
vi.mock("@/lib/notifications/dispatch", () => ({ dispatchNotifications: vi.fn(async () => {}) }))
vi.mock("@/lib/alert-pruning", () => ({ pruneDismissedAlerts: vi.fn(async () => 0) }))
vi.mock("@/lib/server-data", () => ({ recordDatabaseSize: vi.fn(async () => {}) }))
vi.mock("@/lib/tunnel", () => ({ buildProxyAgentFromSettings: vi.fn(() => undefined) }))
vi.mock("@/data/tracker-registry", () => ({
  registryEntryFor: vi.fn(() => undefined),
}))
vi.mock("node-cron", () => ({ default: { schedule: vi.fn() } }))

const fetchStats = vi.fn()
vi.mock("@/lib/tracker-platforms", () => ({
  getAdapter: vi.fn(() => ({ fetchStats })),
  buildFetchOptions: vi.fn(() => ({})),
}))

import { db } from "@/lib/db"
import { LOGIN_EXPIRED_STOP_MESSAGE } from "@/lib/tracker-recovery"
import { pollAllTrackers } from "@/lib/tracker-scheduler"

function chain(result: unknown): Record<string, unknown> {
  const settled = Promise.resolve(result)
  const proxy: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return settled.then.bind(settled)
        if (prop === "catch") return settled.catch.bind(settled)
        if (prop === "finally") return settled.finally.bind(settled)
        return () => proxy
      },
    }
  )
  return proxy
}

const HOUR = 60 * 60 * 1000
const KEY = Buffer.alloc(32)

const TRACKER_ROW = {
  id: 42,
  name: "Example",
  isActive: true,
  encryptedApiToken: "enc",
  platformType: "unit3d",
  baseUrl: "https://example.test",
  apiPath: "/api",
  useProxy: false,
  remoteUserId: null,
  joinedAt: null,
  platformMeta: null,
  lastPolledAt: null,
  lastError: "Request timed out",
  lastErrorAt: null,
  consecutiveFailures: 0,
  pausedAt: null,
  userPausedAt: null,
  minimumRatio: null,
}

const STATS = {
  uploadedBytes: 1_000n,
  downloadedBytes: 500n,
  ratio: 2,
  seedbonus: null,
  hitAndRuns: null,
  seedingCount: null,
  leechingCount: null,
  requiredRatio: null,
  warned: null,
  freeleechTokens: null,
  shareScore: null,
  username: null,
  group: null,
  remoteUserId: null,
  joinedDate: null,
  lastAccessDate: null,
  platformMeta: null,
  avatarUrl: null,
}

function seed(tracker: Record<string, unknown>) {
  vi.mocked(db.select).mockImplementation(((cols: Record<string, unknown>) => {
    const keys = Object.keys(cols ?? {})
    if (keys.includes("snapshotRetentionDays")) {
      return chain([
        {
          storeUsernames: true,
          snapshotRetentionDays: null,
          trackerPollIntervalMinutes: 15,
          proxyEnabled: false,
          proxyType: null,
          proxyHost: null,
          proxyPort: null,
          proxyUsername: null,
          encryptedProxyPassword: null,
        },
      ])
    }
    if (keys.includes("encryptedApiToken")) return chain([tracker])
    return chain([])
  }) as never)
  vi.mocked(db.insert).mockImplementation((() => chain([])) as never)
  vi.mocked(db.update).mockImplementation((() => chain([{ pausedAt: null }])) as never)
  vi.mocked(db.delete).mockImplementation((() => chain([])) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchStats.mockResolvedValue(STATS)
})

describe("pollAllTrackers failure recovery", () => {
  it("retries a due failure-paused tracker and clears the pause on success", async () => {
    const failedAt = new Date(Date.now() - 4 * HOUR)
    seed({
      ...TRACKER_ROW,
      pausedAt: failedAt,
      lastErrorAt: failedAt,
      consecutiveFailures: 5,
    })

    await pollAllTrackers(KEY)

    expect(fetchStats).toHaveBeenCalledTimes(1)
  })

  it("never retries a manual pause", async () => {
    seed({
      ...TRACKER_ROW,
      pausedAt: null,
      userPausedAt: new Date(Date.now() - 8 * HOUR),
      lastErrorAt: new Date(Date.now() - 8 * HOUR),
      consecutiveFailures: 6,
    })

    await pollAllTrackers(KEY)

    expect(fetchStats).not.toHaveBeenCalled()
  })

  it("waits for the backoff before retrying", async () => {
    const failedAt = new Date(Date.now() - 30 * 60 * 1000)
    seed({
      ...TRACKER_ROW,
      pausedAt: failedAt,
      lastErrorAt: failedAt,
      consecutiveFailures: 5,
    })

    await pollAllTrackers(KEY)

    expect(fetchStats).not.toHaveBeenCalled()
  })

  it("does not retry after login expired stopped the cycle", async () => {
    const failedAt = new Date(Date.now() - 24 * HOUR)
    seed({
      ...TRACKER_ROW,
      pausedAt: failedAt,
      lastErrorAt: failedAt,
      consecutiveFailures: 6,
      lastError: LOGIN_EXPIRED_STOP_MESSAGE,
    })

    await pollAllTrackers(KEY)

    expect(fetchStats).not.toHaveBeenCalled()
  })
})
