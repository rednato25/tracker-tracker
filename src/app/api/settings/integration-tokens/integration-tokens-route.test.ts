import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/lib/db"
import {
  INTEGRATION_MAX_ACTIVE_TOKENS,
  INTEGRATION_TOKEN_NAME_MAX,
  INTEGRATION_TOKEN_PATTERN,
} from "@/lib/integration-scopes"

const h = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  selectLimit: vi.fn(),
  insertValues: vi.fn(),
  insertReturning: vi.fn(),
  updateSet: vi.fn(),
  updateReturning: vi.fn(),
  selectRows: [] as unknown[],
  insertedRows: [] as unknown[],
  updatedRows: [] as unknown[],
}))
const {
  authenticateMock,
  selectLimit,
  insertValues,
  insertReturning,
  updateSet,
  updateReturning,
} = h

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return { ...actual, authenticate: h.authenticateMock }
})

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve(h.selectRows),
          limit: h.selectLimit,
        }),
        orderBy: () => Promise.resolve(h.selectRows),
        limit: h.selectLimit,
      }),
    })),
    insert: vi.fn(() => ({
      values: (values: unknown) => {
        h.insertValues(values)
        return { returning: h.insertReturning }
      },
    })),
    update: vi.fn(() => ({
      set: (values: unknown) => {
        h.updateSet(values)
        return { where: () => ({ returning: h.updateReturning }) }
      },
    })),
  },
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { DELETE as DELETE_BY_ID } from "./[id]/route"
import { GET, POST } from "./route"

const CREATED_AT = new Date("2026-10-26T10:00:00.000Z")

beforeEach(() => {
  vi.clearAllMocks()
  authenticateMock.mockResolvedValue({ encryptionKey: "00".repeat(32) })
  h.selectRows = []
  h.insertedRows = []
  h.updatedRows = []
  selectLimit.mockResolvedValue([])
  insertReturning.mockImplementation(async () => [h.insertedRows[0]])
  updateReturning.mockImplementation(async () => h.updatedRows)
})

function req(url: string, init?: RequestInit) {
  return new Request(url, init)
}

async function body(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

describe("GET /api/settings/integration-tokens", () => {
  it("returns metadata only, never a hash or plaintext", async () => {
    h.selectRows = [
      {
        id: 1,
        name: "Widget",
        scopes: ["summary:read"],
        createdAt: CREATED_AT,
        lastUsedAt: null,
        revokedAt: null,
      },
    ]

    const res = await GET()
    expect(res.status).toBe(200)
    const payload = await body(res)
    expect(payload.tokens).toEqual([
      {
        id: 1,
        name: "Widget",
        scopes: ["summary:read"],
        createdAt: CREATED_AT.toISOString(),
        lastUsedAt: null,
        revokedAt: null,
      },
    ])
    expect(JSON.stringify(payload)).not.toContain("tokenHash")
  })

  it("returns 401 without a session", async () => {
    authenticateMock.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )
    const res = await GET()
    expect(res.status).toBe(401)
    expect(db.select).not.toHaveBeenCalled()
  })
})

describe("POST /api/settings/integration-tokens", () => {
  it("returns the plaintext once and stores only its hash with scopes", async () => {
    selectLimit.mockResolvedValue([{ count: 0 }])
    h.insertedRows = [
      {
        id: 5,
        name: "Living room",
        scopes: ["summary:read", "actions:read"],
        createdAt: CREATED_AT,
        lastUsedAt: null,
        revokedAt: null,
      },
    ]

    const res = await POST(
      req("http://localhost/api/settings/integration-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "  Living room  ",
          scopes: ["actions:read", "summary:read", "actions:read"],
        }),
      })
    )

    expect(res.status).toBe(201)
    const payload = await body(res)
    expect(payload.token).toMatch(INTEGRATION_TOKEN_PATTERN)
    expect(payload.record).toEqual({
      id: 5,
      name: "Living room",
      scopes: ["summary:read", "actions:read"],
      createdAt: CREATED_AT.toISOString(),
      lastUsedAt: null,
      revokedAt: null,
    })

    const stored = insertValues.mock.calls[0][0] as Record<string, unknown>
    expect(stored.name).toBe("Living room")
    expect(stored.scopes).toEqual(["summary:read", "actions:read"])
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(stored.tokenHash).not.toBe(payload.token)
    expect(JSON.stringify(stored)).not.toContain(String(payload.token))
  })

  it.each([
    [{ name: "", scopes: ["summary:read"] }, "Name must be between"],
    [
      { name: "x".repeat(INTEGRATION_TOKEN_NAME_MAX + 1), scopes: ["summary:read"] },
      "Name must be between",
    ],
    [{ name: "Widget", scopes: [] }, "At least one scope"],
    [{ name: "Widget", scopes: ["admin:write"] }, "scopes must contain only"],
    [{ name: "Widget", scopes: ["summary:read", 42] }, "scopes must contain only"],
  ])("rejects invalid metadata %#", async (input, error) => {
    const res = await POST(
      req("http://localhost/api/settings/integration-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
    )
    expect(res.status).toBe(400)
    expect((await body(res)).error).toContain(error)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("bounds the number of active tokens", async () => {
    selectLimit.mockResolvedValue([{ count: INTEGRATION_MAX_ACTIVE_TOKENS }])
    const res = await POST(
      req("http://localhost/api/settings/integration-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Widget", scopes: ["summary:read"] }),
      })
    )
    expect(res.status).toBe(400)
    expect((await body(res)).error).toContain("Revoke an existing token")
    expect(db.insert).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/settings/integration-tokens/[id]", () => {
  it("revokes by setting revokedAt and returns no token material", async () => {
    h.updatedRows = [{ id: 5, revokedAt: CREATED_AT }]
    const res = await DELETE_BY_ID(
      req("http://localhost/api/settings/integration-tokens/5", { method: "DELETE" }),
      { params: Promise.resolve({ id: "5" }) }
    )

    expect(res.status).toBe(200)
    expect(updateSet).toHaveBeenCalledWith({ revokedAt: expect.any(Date) })
    const payload = await body(res)
    expect(payload).toEqual({
      revoked: true,
      id: 5,
      revokedAt: CREATED_AT.toISOString(),
    })
    expect(JSON.stringify(payload)).not.toContain("tokenHash")
  })

  it("returns 404 for an unknown or already revoked token", async () => {
    h.updatedRows = []
    const res = await DELETE_BY_ID(
      req("http://localhost/api/settings/integration-tokens/999", { method: "DELETE" }),
      { params: Promise.resolve({ id: "999" }) }
    )
    expect(res.status).toBe(404)
  })

  it("rejects a non-numeric id before writing", async () => {
    const res = await DELETE_BY_ID(
      req("http://localhost/api/settings/integration-tokens/nope", { method: "DELETE" }),
      { params: Promise.resolve({ id: "nope" }) }
    )
    expect(res.status).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })
})
