import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TrackerAction } from "@/lib/actions"
import type { TrackerSummary } from "@/types/api"

const mocks = vi.hoisted(() => ({
  db: { select: vi.fn(), update: vi.fn() },
  reserve: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: mocks.db,
  getDbClient: () => ({ reserve: mocks.reserve }),
}))
vi.mock("@/lib/server-data", () => ({ getTrackerListForDashboard: vi.fn(async () => []) }))
vi.mock("@/lib/actions", () => ({
  computeTrackerActions: vi.fn(() => [
    {
      key: "ratio-below-account:tracker:1",
      type: "ratio-below-account",
      status: "action-required",
      priority: "critical",
      trackerId: 1,
      trackerName: "Alpha",
      reason: "Ratio is low.",
      nextAction: "Fix it.",
      deadline: null,
      evidence: {},
      dismissible: true,
    } satisfies TrackerAction,
  ]),
}))
vi.mock("@/lib/notifications/decrypt", () => ({
  decryptNotificationConfig: vi.fn((target: { type: string }) =>
    target.type === "telegram"
      ? { botToken: "123456:ABCdefGHIjklMNOpqrsTUVwxyz123456789", chatId: "-1001234567890" }
      : { webhookUrl: "https://discord.com/api/webhooks/1/x" }
  ),
}))
vi.mock("@/lib/notifications/deliver", () => ({
  deliverDiscordWebhook: vi.fn(),
  deliverTelegramMessage: vi.fn(),
  deliverNtfyMessage: vi.fn(),
}))
vi.mock("@/lib/logger", () => ({ log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))

function target(id: number, type: "telegram" | "discord") {
  return {
    id,
    name: `${type}-${id}`,
    type,
    enabled: true,
    encryptedConfig: "ciphertext",
    scope: null,
  }
}

let settings: Record<string, unknown>
let targets: ReturnType<typeof target>[]
let updates: Record<string, unknown>[]
let lockAcquired: boolean
let conn: ReturnType<typeof vi.fn> & { release: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.clearAllMocks()
  updates = []
  lockAcquired = true
  settings = {
    id: 1,
    digestEnabled: true,
    digestTime: "00:00",
    digestTimezone: "UTC",
    digestEmptyBehavior: "send",
    digestIncludeMonitoring: false,
    digestTargetIds: null,
    digestState: null,
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    quietHoursTimezone: "UTC",
    quietHoursCriticalBypass: false,
  }
  targets = [target(1, "telegram"), target(2, "discord")]
  conn = vi.fn(async () => [{ acquired: lockAcquired }]) as typeof conn
  conn.release = vi.fn()
  mocks.reserve.mockResolvedValue(conn)
  mocks.db.select.mockImplementation(() => ({
    from: () => ({
      limit: async () => [settings],
      orderBy: async () => targets,
    }),
  }))
  mocks.db.update.mockImplementation(() => ({
    set: (value: Record<string, unknown>) => ({
      where: async () => {
        updates.push(value)
      },
    }),
  }))
})

const monitorTracker: TrackerSummary = {
  id: 9,
  name: "Monitor",
  baseUrl: "https://monitor.invalid",
  registrySlug: "alpharatio",
  platformType: "unit3d",
  isActive: true,
  lastPolledAt: "2026-10-24T10:00:00.000Z",
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
  joinedAt: "2026-01-01T00:00:00.000Z",
  lastAccessAt: null,
  remoteUserId: null,
  platformMeta: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  latestStats: {
    ratio: 2,
    ratioIsInfinite: false,
    uploadedBytes: "1000",
    downloadedBytes: "500",
    bufferBytes: "500",
    seedingCount: 0,
    leechingCount: 0,
    requiredRatio: 1,
    warned: false,
    freeleechTokens: 0,
    hitAndRuns: 0,
    seedbonus: 0,
    shareScore: null,
    username: "owner",
    group: "User",
  },
}

describe("runDigestIfDue concurrency and target state", () => {
  it("does nothing when another scheduler holds the digest lock", async () => {
    lockAcquired = false
    const deliver = await import("@/lib/notifications/deliver")
    const { runDigestIfDue } = await import("@/lib/digest")
    expect(await runDigestIfDue(Buffer.alloc(32), new Date("2026-10-24T12:00:00Z"))).toBe(false)
    expect(deliver.deliverTelegramMessage).not.toHaveBeenCalled()
    expect(updates).toHaveLength(0)
    expect(conn.release).toHaveBeenCalled()
  })

  it("delivers once per target and records independent state", async () => {
    const deliver = await import("@/lib/notifications/deliver")
    vi.mocked(deliver.deliverTelegramMessage).mockResolvedValue({
      success: true,
      status: "delivered",
    })
    vi.mocked(deliver.deliverDiscordWebhook).mockResolvedValue({
      success: true,
      status: "delivered",
    })
    const { runDigestIfDue } = await import("@/lib/digest")

    expect(await runDigestIfDue(Buffer.alloc(32), new Date("2026-10-24T12:00:00Z"))).toBe(true)
    expect(deliver.deliverTelegramMessage).toHaveBeenCalledTimes(1)
    expect(deliver.deliverDiscordWebhook).toHaveBeenCalledTimes(1)
    const state = JSON.parse(updates.at(-1)?.digestState as string) as Record<string, unknown>
    expect(Object.keys(state).sort()).toEqual(["1", "2"])
  })

  it("sends a monitoring-only digest when monitoring is enabled and skip empty is selected", async () => {
    settings.digestEmptyBehavior = "skip"
    settings.digestIncludeMonitoring = true
    const serverData = await import("@/lib/server-data")
    vi.mocked(serverData.getTrackerListForDashboard).mockResolvedValueOnce([monitorTracker])
    const actionsModule = await import("@/lib/actions")
    vi.mocked(actionsModule.computeTrackerActions).mockReturnValueOnce([])
    const deliver = await import("@/lib/notifications/deliver")
    vi.mocked(deliver.deliverTelegramMessage).mockResolvedValue({
      success: true,
      status: "delivered",
    })
    vi.mocked(deliver.deliverDiscordWebhook).mockResolvedValue({
      success: true,
      status: "delivered",
    })
    const { runDigestIfDue } = await import("@/lib/digest")

    expect(await runDigestIfDue(Buffer.alloc(32), new Date("2026-10-24T12:00:00Z"))).toBe(true)
    expect(deliver.deliverTelegramMessage).toHaveBeenCalledWith(
      1,
      expect.any(String),
      expect.any(String),
      expect.stringContaining("MONITORING")
    )
  })

  it("backs off only the failing target", async () => {
    const deliver = await import("@/lib/notifications/deliver")
    vi.mocked(deliver.deliverTelegramMessage).mockResolvedValue({
      success: false,
      status: "failed",
      error: "failed",
    })
    vi.mocked(deliver.deliverDiscordWebhook).mockResolvedValue({
      success: true,
      status: "delivered",
    })
    const { runDigestIfDue } = await import("@/lib/digest")

    await runDigestIfDue(Buffer.alloc(32), new Date("2026-10-24T12:00:00Z"))
    const state = JSON.parse(updates.at(-1)?.digestState as string) as Record<
      string,
      { failureCount: number; nextAttemptAt: string | null; lastSuccessAt: string | null }
    >
    expect(state["1"].failureCount).toBe(1)
    expect(state["1"].nextAttemptAt).not.toBeNull()
    expect(state["1"].lastSuccessAt).toBeNull()
    expect(state["2"].failureCount).toBe(0)
    expect(state["2"].lastSuccessAt).not.toBeNull()
  })
})
