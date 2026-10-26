import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/lib/db"
import {
  loadIntegrationClients,
  loadIntegrationSettings,
  loadIntegrationTrackers,
} from "@/lib/integration-api"
import type { TrackerSummary } from "@/types/api"

const { authenticateMock, selectLimit } = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  selectLimit: vi.fn(),
}))
const fetchMock = vi.fn()

vi.mock("@/lib/integration-auth", () => ({
  authenticateIntegration: authenticateMock,
}))

vi.mock("@/lib/integration-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integration-api")>()
  return {
    ...actual,
    loadIntegrationSettings: vi.fn(),
    loadIntegrationTrackers: vi.fn(),
    loadIntegrationClients: vi.fn(),
  }
})

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: selectLimit,
          }),
        }),
      }),
    })),
  },
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET as ACTIONS } from "./actions/route"
import { GET as HISTORY } from "./history/route"
import { GET as SUMMARY } from "./summary/route"

const NOW = new Date("2026-10-26T12:00:00.000Z")

function tracker(): TrackerSummary {
  return {
    id: 1,
    name: "Private Example",
    baseUrl: "https://private.example.invalid",
    registrySlug: null,
    platformType: "unit3d",
    isActive: true,
    lastPolledAt: "2026-10-26T11:55:00.000Z",
    lastError: "https://private.example.invalid/api?apikey=leaked",
    lastErrorAt: "2026-10-26T11:55:00.000Z",
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    color: "#123456",
    qbtTag: "tt",
    mouseholeUrl: null,
    hasMouseholeToken: false,
    useProxy: false,
    countCrossSeedUnsatisfied: false,
    hideUnreadBadges: false,
    isFavorite: false,
    sortOrder: 1,
    joinedAt: "2020-01-01",
    lastAccessAt: "2026-10-20T00:00:00.000Z",
    remoteUserId: 42,
    platformMeta: null,
    createdAt: "2020-01-01T00:00:00.000Z",
    latestStats: {
      ratio: 2,
      ratioIsInfinite: false,
      uploadedBytes: "1000",
      downloadedBytes: "500",
      bufferBytes: "500",
      seedingCount: 3,
      leechingCount: 1,
      requiredRatio: 1,
      warned: false,
      freeleechTokens: 0,
      hitAndRuns: 0,
      seedbonus: 10,
      shareScore: null,
      username: "owner-name",
      group: "Power User",
    },
  }
}

function req(path: string) {
  return new Request(`http://localhost${path}`, {
    headers: { authorization: "Bearer tt_int_placeholder" },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  authenticateMock.mockResolvedValue({ tokenId: 1, scopes: ["summary:read", "actions:read", "history:read"] })
  ;(loadIntegrationSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
    identityMode: "none",
    storeUsernames: true,
  })
  ;(loadIntegrationTrackers as ReturnType<typeof vi.fn>).mockResolvedValue([tracker()])
  ;(loadIntegrationClients as ReturnType<typeof vi.fn>).mockResolvedValue([])
  selectLimit.mockResolvedValue([])
})

describe("integration read routes", () => {
  it("summary requires summary:read and returns only explicit private fields", async () => {
    const res = await SUMMARY(req("/api/integrations/v1/summary"))
    expect(res.status).toBe(200)
    expect(authenticateMock).toHaveBeenCalledWith(expect.any(Request), "summary:read")
    expect(res.headers.get("Cache-Control")).toBe("no-store")

    const json = JSON.stringify(await res.json())
    expect(json).toContain('"apiVersion":"v1"')
    expect(json).toContain('"trackerId":1')
    expect(json).not.toContain("Private Example")
    expect(json).not.toContain("owner-name")
    expect(json).not.toContain("private.example.invalid")
    expect(json).not.toContain("lastError")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("actions requires actions:read and runs the stored evaluator without I/O", async () => {
    const res = await ACTIONS(req("/api/integrations/v1/actions"))
    expect(res.status).toBe(200)
    expect(authenticateMock).toHaveBeenCalledWith(expect.any(Request), "actions:read")
    const body = (await res.json()) as { actions: unknown[] }
    expect(Array.isArray(body.actions)).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("history requires history:read and returns stored rows oldest-first", async () => {
    selectLimit.mockResolvedValue([
      {
        trackerId: 1,
        polledAt: new Date("2026-10-26T11:00:00.000Z"),
        uploadedBytes: 2000n,
        downloadedBytes: 1000n,
        ratio: 2,
        bufferBytes: 1000n,
        seeding: 4,
        leeching: 0,
        isManual: false,
      },
      {
        trackerId: 1,
        polledAt: new Date("2026-10-26T10:00:00.000Z"),
        uploadedBytes: 1000n,
        downloadedBytes: 500n,
        ratio: 2,
        bufferBytes: 500n,
        seeding: 3,
        leeching: 1,
        isManual: false,
      },
    ])

    const res = await HISTORY(req("/api/integrations/v1/history?trackerId=1&days=7&limit=2"))
    expect(res.status).toBe(200)
    expect(authenticateMock).toHaveBeenCalledWith(expect.any(Request), "history:read")
    const body = (await res.json()) as {
      items: { polledAt: string; uploadedBytes: string }[]
      range: { trackerId: number; limit: number }
    }
    expect(body.range).toMatchObject({ trackerId: 1, limit: 2 })
    expect(body.items.map((item) => item.polledAt)).toEqual([
      "2026-10-26T10:00:00.000Z",
      "2026-10-26T11:00:00.000Z",
    ])
    expect(body.items[0].uploadedBytes).toBe("1000")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects an oversized history range before touching the database", async () => {
    const res = await HISTORY(req("/api/integrations/v1/history?days=91"))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: "days must be an integer between 1 and 90",
    })
    expect(db.select).not.toHaveBeenCalled()
  })

  it("passes the request through to bearer authentication before reading data", async () => {
    const url = "/api/integrations/v1/summary?access_token=leaked"
    const res = await SUMMARY(req(url))
    expect(res.status).toBe(200)
    expect(authenticateMock).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining("access_token=leaked") }),
      "summary:read"
    )
  })
})
