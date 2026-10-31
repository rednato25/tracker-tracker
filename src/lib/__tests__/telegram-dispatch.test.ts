import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { NotificationTargetRow } from "@/lib/db/schema"
import type { SnapshotContext } from "@/lib/notifications/types"

const dbMock = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}

vi.mock("@/lib/db", () => ({ db: dbMock }))
vi.mock("@/lib/logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/digest", () => ({ markQuietPending: vi.fn() }))
vi.mock("@/lib/notifications/decrypt", () => ({
  decryptNotificationConfig: vi.fn((target: { type: string }) =>
    target.type === "telegram"
      ? { botToken: "123456:ABCdefGHIjklMNOpqrsTUVwxyz123456789", chatId: "-1001234567890" }
      : target.type === "ntfy"
        ? { serverUrl: "https://ntfy.example.test", topic: "synthetic_topic", authToken: "tk_x" }
        : { webhookUrl: "https://discord.com/api/webhooks/1/abc" }
  ),
}))
vi.mock("@/lib/notifications/deliver", () => ({
  deliverTelegramMessage: vi.fn(),
  deliverDiscordWebhook: vi.fn(),
  deliverNtfyMessage: vi.fn(),
}))

function target(overrides: Partial<NotificationTargetRow> = {}): NotificationTargetRow {
  return {
    id: 1,
    name: "Telegram",
    type: "telegram",
    enabled: true,
    encryptedConfig: "ciphertext",
    notifyRatioDrop: true,
    notifyHitAndRun: false,
    notifyTrackerDown: false,
    notifyBufferMilestone: false,
    notifyWarned: false,
    notifyRatioDanger: false,
    notifyZeroSeeding: false,
    notifyRankChange: false,
    notifyLoginDue: false,
    notifyAnniversary: false,
    notifyBonusCap: false,
    notifyVipExpiring: false,
    notifyUnsatisfiedLimit: false,
    notifyActiveHnrs: false,
    notifyDownloadDisabled: false,
    thresholds: null,
    includeTrackerName: true,
    scope: null,
    lastDeliveryStatus: null,
    lastDeliveryAt: null,
    lastDeliveryError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function ctx(): SnapshotContext {
  return {
    trackerId: 10,
    trackerName: "Synthetic",
    storeUsernames: true,
    currentRatio: 0.5,
    previousRatio: 1.5,
    currentHnrs: 0,
    previousHnrs: 0,
    currentBufferBytes: 10n,
    previousBufferBytes: 10n,
    trackerDown: false,
    trackerError: null,
    currentWarned: false,
    previousWarned: false,
    currentSeedingCount: 5,
    currentGroup: "Member",
    previousGroup: "Member",
    trackerIsActive: true,
    trackerPausedAt: null,
    trackerJoinedAt: null,
    minimumRatio: 1,
  }
}

let inserts: Record<string, unknown>[] = []
let updates: Record<string, unknown>[] = []
let cooldowns: { targetId: number; eventType: string; snoozedUntil: Date | null }[] = []
let settingsRows: Record<string, unknown>[] = []

beforeEach(() => {
  vi.clearAllMocks()
  inserts = []
  updates = []
  cooldowns = []
  settingsRows = []
  dbMock.select.mockImplementation(() => ({
    from: () => ({
      where: async () => cooldowns,
      limit: async () => settingsRows,
    }),
  }))
  dbMock.insert.mockImplementation(() => ({
    values: (value: Record<string, unknown>) => {
      inserts.push(value)
      return { onConflictDoUpdate: async () => undefined }
    },
  }))
  dbMock.update.mockImplementation(() => ({
    set: (value: Record<string, unknown>) => ({
      where: async () => {
        updates.push(value)
      },
    }),
  }))
})

afterEach(() => {
  vi.resetModules()
})

describe("dispatchNotifications Telegram", () => {
  it("sends through Telegram and records durable delivery state", async () => {
    const deliver = await import("@/lib/notifications/deliver")
    const dispatch = await import("@/lib/notifications/dispatch")
    vi.mocked(deliver.deliverTelegramMessage).mockResolvedValue({
      success: true,
      status: "delivered",
    })

    await dispatch.dispatchNotifications(ctx(), Buffer.alloc(32), [target()])
    expect(deliver.deliverTelegramMessage).toHaveBeenCalledWith(
      1,
      "123456:ABCdefGHIjklMNOpqrsTUVwxyz123456789",
      "-1001234567890",
      expect.stringContaining("Ratio Drop")
    )
    expect(inserts).toEqual([
      expect.objectContaining({ targetId: 1, trackerId: 10, eventType: "ratio_drop" }),
    ])
    expect(updates).toEqual([expect.objectContaining({ lastDeliveryStatus: "delivered" })])
  })

  it("sends through ntfy with its own delivery state", async () => {
    const deliver = await import("@/lib/notifications/deliver")
    const dispatch = await import("@/lib/notifications/dispatch")
    vi.mocked(deliver.deliverNtfyMessage).mockResolvedValue({
      success: true,
      status: "delivered",
    })

    await dispatch.dispatchNotifications(ctx(), Buffer.alloc(32), [
      target({ id: 3, name: "ntfy", type: "ntfy" }),
    ])

    expect(deliver.deliverNtfyMessage).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ topic: "synthetic_topic", authToken: "tk_x" }),
      "Ratio Drop",
      expect.stringContaining("Synthetic ratio")
    )
    expect(inserts).toEqual([
      expect.objectContaining({ targetId: 3, trackerId: 10, eventType: "ratio_drop" }),
    ])
  })

  it("defers routine events during quiet hours without marking delivery", async () => {
    settingsRows = [
      {
        quietHoursEnabled: true,
        quietHoursStart: "00:00",
        quietHoursEnd: "23:59",
        quietHoursTimezone: "UTC",
        quietHoursCriticalBypass: false,
      },
    ]
    const deliver = await import("@/lib/notifications/deliver")
    const dispatch = await import("@/lib/notifications/dispatch")
    const { markQuietPending } = await import("@/lib/digest")

    await dispatch.dispatchNotifications(ctx(), Buffer.alloc(32), [target()])

    expect(deliver.deliverTelegramMessage).not.toHaveBeenCalled()
    expect(markQuietPending).toHaveBeenCalledWith([1], expect.any(Date))
    expect(inserts).toHaveLength(0)
    expect(updates).toHaveLength(0)
  })

  it("does not send during a cooldown and keeps targets independent", async () => {
    cooldowns = [{ targetId: 1, eventType: "ratio_drop", snoozedUntil: new Date(Date.now() + 60_000) }]
    const deliver = await import("@/lib/notifications/deliver")
    const dispatch = await import("@/lib/notifications/dispatch")
    vi.mocked(deliver.deliverTelegramMessage).mockResolvedValue({
      success: true,
      status: "delivered",
    })
    vi.mocked(deliver.deliverDiscordWebhook).mockResolvedValue({
      success: true,
      status: "delivered",
    })

    await dispatch.dispatchNotifications(ctx(), Buffer.alloc(32), [
      target(),
      target({ id: 2, name: "Discord", type: "discord" }),
    ])

    expect(deliver.deliverTelegramMessage).not.toHaveBeenCalled()
    expect(deliver.deliverDiscordWebhook).toHaveBeenCalledTimes(1)
    expect(inserts).toEqual([
      expect.objectContaining({ targetId: 2, trackerId: 10, eventType: "ratio_drop" }),
    ])
  })

  it("does not record a cooldown when Telegram rate-limits", async () => {
    const deliver = await import("@/lib/notifications/deliver")
    const dispatch = await import("@/lib/notifications/dispatch")
    vi.mocked(deliver.deliverTelegramMessage).mockResolvedValue({
      success: false,
      status: "rate_limited",
      error: "Rate limited by Telegram",
    })

    await dispatch.dispatchNotifications(ctx(), Buffer.alloc(32), [target()])

    expect(inserts).toHaveLength(0)
    expect(updates).toEqual([expect.objectContaining({ lastDeliveryStatus: "rate_limited" })])
  })
})
