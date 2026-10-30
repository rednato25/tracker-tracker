import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/lib/db"

const h = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  selectLimit: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
}))

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return { ...actual, authenticate: h.authenticateMock }
})

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        limit: h.selectLimit,
      }),
    })),
    update: vi.fn(() => ({
      set: (values: unknown) => {
        h.updateSet(values)
        return { where: h.updateWhere }
      },
    })),
  },
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET, PUT } from "./route"

function req(body?: unknown) {
  return new Request("http://localhost/api/recruitment/wishlist", {
    method: body === undefined ? "GET" : "PUT",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.authenticateMock.mockResolvedValue({ encryptionKey: "00".repeat(32) })
  h.selectLimit.mockResolvedValue([
    {
      id: 1,
      recruitmentState:
        '{"version":2,"desiredTrackerSlug":"TorrentLeech","hiddenPathKeys":["a>b"],"goalLinks":[]}',
    },
  ])
  h.updateWhere.mockResolvedValue([])
})

describe("/api/recruitment/wishlist", () => {
  it("returns normalized state for the session", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      state: {
        version: 2,
        desiredTrackerSlug: "TorrentLeech",
        hiddenPathKeys: ["a>b"],
        goalLinks: [],
        pinnedRoutes: {},
      },
    })
  })

  it("persists only normalized fields and returns the effective state", async () => {
    const res = await PUT(
      req({
        state: {
          desiredTrackerSlug: "TorrentLeech",
          hiddenPathKeys: ["a>b", "a>b", 42],
          goalLinks: [
            {
              routeId: "tp:torrentleech:broadcasthenet",
              conditionId: "source-age",
              sourceTrackerSlug: "torrentleech",
              goalTrackerSlug: "torrentleech",
              targetRank: "Power User",
              metric: "accountAgeDays",
              comparison: "gte",
              requiredValue: 14,
            },
          ],
          extra: "not persisted",
        },
      })
    )

    expect(res.status).toBe(200)
    const payload = (await res.json()) as { state: Record<string, unknown> }
    expect(payload.state.extra).toBeUndefined()
    expect(payload.state.hiddenPathKeys).toEqual(["a>b"])
    expect((payload.state.goalLinks as unknown[]).length).toBe(1)

    expect(h.updateSet).toHaveBeenCalledWith({
      recruitmentState: expect.stringContaining('"desiredTrackerSlug":"TorrentLeech"'),
    })
    const stored = h.updateSet.mock.calls[0][0] as { recruitmentState: string }
    expect(stored.recruitmentState).not.toContain("extra")
  })

  it("drops an unknown desired tracker instead of persisting a broken slug", async () => {
    const res = await PUT(
      req({ state: { desiredTrackerSlug: "not-a-tracker", hiddenPathKeys: [] } })
    )
    expect(res.status).toBe(200)
    const payload = (await res.json()) as { state: { desiredTrackerSlug: null } }
    expect(payload.state.desiredTrackerSlug).toBeNull()
  })

  it("rejects requests without a session", async () => {
    h.authenticateMock.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )
    const res = await GET()
    expect(res.status).toBe(401)
    expect(db.select).not.toHaveBeenCalled()
  })
})
