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
  registryEntryFor: vi.fn(() => ({ slug: "aither", url: "https://aither.cc" })),
}))
vi.mock("node-cron", () => ({ default: { schedule: vi.fn() } }))

const fetchStats = vi.fn()
vi.mock("@/lib/tracker-platforms", () => ({
  getAdapter: vi.fn(() => ({ fetchStats })),
  buildFetchOptions: vi.fn(() => ({})),
}))

import { db } from "@/lib/db"
import { pollTracker } from "@/lib/tracker-scheduler"

function chain(result: unknown): Record<string, unknown> {
  const settled = Promise.resolve(result)
  const proxy: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return settled.then.bind(settled)
        if (prop === "catch") return settled.catch.bind(settled)
        if (prop === "finally") return settled.finally.bind(settled)
        return () => proxy
      },
    }
  )
  return proxy
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
  username: "owner",
  group: null,
  remoteUserId: null,
  joinedDate: null,
  lastAccessDate: "2026-10-20T15:00:00.000Z",
  platformMeta: null,
  avatarUrl: null,
}

const TRACKER = {
  id: 42,
  name: "Aither",
  isActive: true,
  encryptedApiToken: "enc",
  platformType: "unit3d",
  baseUrl: "https://aither.cc",
  registrySlug: "aither",
  apiPath: "/api/user",
  useProxy: false,
  remoteUserId: null,
  joinedAt: null,
  platformMeta: null,
  lastAccessAt: "2026-10-24",
  lastPolledAt: null,
  lastError: null,
  lastErrorAt: null,
  consecutiveFailures: 0,
  pausedAt: null,
  userPausedAt: null,
}

const KEY = Buffer.alloc(32)
const setCalls: Record<string, unknown>[] = []

beforeEach(() => {
  vi.clearAllMocks()
  setCalls.length = 0
  fetchStats.mockResolvedValue(STATS)
  vi.mocked(db.select).mockImplementation(((cols: Record<string, unknown>) => {
    const keys = Object.keys(cols ?? {})
    return chain(keys.includes("encryptedApiToken") ? [TRACKER] : [])
  }) as never)
  vi.mocked(db.insert).mockImplementation((() => chain([])) as never)
  vi.mocked(db.update).mockImplementation((() => ({
    set: (values: Record<string, unknown>) => {
      setCalls.push(values)
      return chain([{ consecutiveFailures: 0, pausedAt: null }])
    },
  })) as never)
  vi.mocked(db.delete).mockImplementation((() => chain([])) as never)
})

describe("pollTracker last-access provenance", () => {
  it("stores an adapter-reported last access as detected", async () => {
    await pollTracker(42, KEY, false)

    const metadata = setCalls.find((values) => "lastAccessAt" in values)
    expect(metadata).toMatchObject({
      lastAccessAt: "2026-10-20",
      lastAccessSource: "detected",
    })
  })

  it("falls back to manual and keeps the last known date when the API stops reporting one", async () => {
    fetchStats.mockResolvedValueOnce({ ...STATS, lastAccessDate: undefined })

    await pollTracker(42, KEY, false)

    const metadata = setCalls.find((values) => "lastAccessSource" in values)
    expect(metadata).toMatchObject({ lastAccessSource: "manual" })
    expect(metadata).not.toHaveProperty("lastAccessAt")
  })
})
