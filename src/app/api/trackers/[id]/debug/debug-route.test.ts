// src/app/api/trackers/[id]/debug/debug-route.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate, decodeKey, parseTrackerId } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { UNLINKED_RESTORE_ERROR } from "@/lib/tracker-status"
import { POST } from "./route"

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return {
    ...actual,
    authenticate: vi.fn(),
    decodeKey: vi.fn(),
    parseTrackerId: vi.fn(),
  }
})

vi.mock("@/lib/db", () => ({
  db: { select: vi.fn() },
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const fetchRaw = vi.fn()
const fetchStats = vi.fn()

vi.mock("@/lib/tracker-platforms", () => ({
  getAdapter: vi.fn(() => ({ fetchRaw, fetchStats })),
  buildFetchOptions: vi.fn(() => ({})),
}))

vi.mock("@/lib/tunnel", () => ({
  buildProxyAgentFromSettings: vi.fn(() => undefined),
}))

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn(() => "api-token"),
}))

vi.mock("@/lib/scrub-object", () => ({
  scrubObject: vi.fn((value: unknown) => value),
}))

const VALID_KEY = "abcd1234".repeat(8)

function mockTrackerRow(overrides: Record<string, unknown> = {}) {
  const row = {
    id: 42,
    name: "Restored",
    baseUrl: "https://attacker.example.net",
    apiPath: "/api/user",
    platformType: "unit3d",
    registrySlug: null,
    encryptedApiToken: "encrypted",
    isActive: true,
    remoteUserId: null,
    useProxy: false,
    pausedAt: new Date("2026-03-20T10:00:00Z"),
    lastError: UNLINKED_RESTORE_ERROR,
    ...overrides,
  }
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([row]),
      }),
    }),
  })
}

describe("POST /api/trackers/[id]/debug", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: VALID_KEY })
    ;(decodeKey as ReturnType<typeof vi.fn>).mockReturnValue(Buffer.alloc(32))
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(42)
  })

  it("refuses to send the token to an address a restore could not place", async () => {
    mockTrackerRow()

    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "42" }),
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: "Resume this tracker before debugging it",
    })
    // Neither the raw nor the normalized call may run, so the key never leaves.
    expect(fetchRaw).not.toHaveBeenCalled()
    expect(fetchStats).not.toHaveBeenCalled()
  })

  it("debugs an ordinary failure-paused row normally", async () => {
    mockTrackerRow({ lastError: "Connection refused", pausedAt: new Date() })
    // The settings read is the route's second db.select.
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 42,
              name: "Restored",
              baseUrl: "https://attacker.example.net",
              apiPath: "/api/user",
              platformType: "unit3d",
              registrySlug: null,
              encryptedApiToken: "encrypted",
              isActive: true,
              remoteUserId: null,
              useProxy: false,
              pausedAt: new Date(),
              lastError: "Connection refused",
            },
          ]),
        }),
      }),
    })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ proxyEnabled: false }]),
      }),
    })
    fetchRaw.mockResolvedValue([])
    fetchStats.mockResolvedValue({
      username: "u",
      group: null,
      uploadedBytes: 1n,
      downloadedBytes: 0n,
      ratio: null,
      bufferBytes: 1n,
      seedingCount: null,
      leechingCount: null,
      seedbonus: null,
      hitAndRuns: null,
      requiredRatio: null,
      warned: null,
      freeleechTokens: null,
      shareScore: null,
      remoteUserId: null,
      joinedDate: null,
      lastAccessDate: null,
      platformMeta: null,
      avatarUrl: null,
    })

    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "42" }),
    })

    expect(res.status).toBe(200)
    expect(fetchStats).toHaveBeenCalledTimes(1)
  })
})
