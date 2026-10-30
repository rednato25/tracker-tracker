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

import { PUT } from "./route"

function req(body: unknown) {
  return new Request("http://localhost/api/recruitment/rank-checks", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.authenticateMock.mockResolvedValue({ encryptionKey: "00".repeat(32) })
  h.selectLimit.mockResolvedValue([
    {
      id: 1,
      recruitmentState: JSON.stringify({
        version: 2,
        desiredTrackerSlug: "TorrentLeech",
        hiddenPathKeys: ["a>b"],
        goalLinks: [],
        pinnedRoutes: { Aither: "tp:AlphaRatio:Aither" },
        rankChecks: {},
      }),
    },
  ])
  h.updateWhere.mockResolvedValue([])
})

describe("/api/recruitment/rank-checks", () => {
  it("stores a check without dropping the other recruitment state", async () => {
    const res = await PUT(
      req({
        trackerId: 7,
        check: {
          verdict: "wrong",
          note: "The site says 200 GiB, not 1 TiB",
          checkedAt: "2026-10-30",
        },
      })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      rankChecks: {
        "7": {
          verdict: "wrong",
          note: "The site says 200 GiB, not 1 TiB",
          checkedAt: "2026-10-30",
        },
      },
    })
    const stored = h.updateSet.mock.calls[0][0] as { recruitmentState: string }
    const state = JSON.parse(stored.recruitmentState) as Record<string, unknown>
    expect(state.desiredTrackerSlug).toBe("TorrentLeech")
    expect(state.hiddenPathKeys).toEqual(["a>b"])
    expect(state.pinnedRoutes).toEqual({ Aither: "tp:AlphaRatio:Aither" })
    expect(state.rankChecks).toEqual({
      "7": {
        verdict: "wrong",
        note: "The site says 200 GiB, not 1 TiB",
        checkedAt: "2026-10-30",
      },
    })
  })

  it("clears a check with null", async () => {
    h.selectLimit.mockResolvedValue([
      {
        id: 1,
        recruitmentState: JSON.stringify({
          version: 2,
          desiredTrackerSlug: null,
          hiddenPathKeys: [],
          goalLinks: [],
          pinnedRoutes: {},
          rankChecks: { "7": { verdict: "matches", note: null, checkedAt: "2026-10-30" } },
        }),
      },
    ])
    const res = await PUT(req({ trackerId: 7, check: null }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ rankChecks: {} })
  })

  it("rejects an invalid verdict or date", async () => {
    const res = await PUT(
      req({ trackerId: 7, check: { verdict: "maybe", checkedAt: "2026-10-30" } })
    )
    expect(res.status).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })

  it("rejects an invalid tracker id", async () => {
    const res = await PUT(req({ trackerId: "not-a-tracker", check: null }))
    expect(res.status).toBe(400)
    expect(db.select).not.toHaveBeenCalled()
  })

  it("rejects requests without a session", async () => {
    h.authenticateMock.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )
    const res = await PUT(req({ trackerId: 7, check: null }))
    expect(res.status).toBe(401)
    expect(db.select).not.toHaveBeenCalled()
  })
})
