import { createRequire } from "node:module"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticateIntegration, integrationTokenHash } from "@/lib/integration-auth"

const require = createRequire(import.meta.url)
const recover = require("../../../scripts/recover.cjs")

const TOKEN = `tt_int_${"c".repeat(43)}`
const state = vi.hoisted(() => ({
  rows: [] as { id: number; scopes: string[]; revokedAt: Date | null }[],
}))

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => state.rows),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
    })),
  },
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

function plan() {
  return {
    updates: [],
    settingsSet: {},
    settings: { id: 1 },
    newHash: "new-password-hash",
    rewrapped: "wrapped-scheduler-key",
    disableTotp: false,
  }
}

function fakeSql({ failCommit = false }: { failCommit?: boolean } = {}) {
  const statements: string[] = []
  const tx = (first: unknown, ...rest: unknown[]) => {
    if (!Array.isArray(first)) return first
    const text = (first as string[]).join("?")
    statements.push(text)
    if (text.includes("DELETE FROM integration_tokens")) {
      state.rows = []
      return Promise.resolve([{ id: 1 }])
    }
    return Promise.resolve([])
  }
  tx.begin = async (fn: (client: typeof tx) => Promise<unknown>) => {
    const snapshot = [...state.rows]
    try {
      const result = await fn(tx)
      if (failCommit) throw new Error("simulated commit failure")
      return result
    } catch (err) {
      state.rows = snapshot
      throw err
    }
  }
  return { sql: tx, statements }
}

function tokenRequest() {
  return new Request("http://localhost/api/integrations/v1/summary", {
    headers: { authorization: `Bearer ${TOKEN}` },
  })
}

beforeEach(() => {
  state.rows = [
    {
      id: 4,
      scopes: ["summary:read"],
      revokedAt: null,
    },
  ]
})

describe("recovery and integration tokens", () => {
  it("rejects a previously valid token after a successful recovery", async () => {
    const before = await authenticateIntegration(tokenRequest(), "summary:read")
    expect(before).toEqual({ tokenId: 4, scopes: ["summary:read"] })

    const { sql, statements } = fakeSql()
    const result = await recover.commitRecovery(sql, plan())

    expect(result).toEqual({ revokedTokenCount: 1 })
    expect(statements.some((statement) => statement.includes("DELETE FROM integration_tokens"))).toBe(
      true
    )
    expect(state.rows).toEqual([])

    const after = await authenticateIntegration(tokenRequest(), "summary:read")
    expect(after).toBeInstanceOf(Response)
    expect((after as Response).status).toBe(401)
  })

  it("keeps a token valid when recovery fails and rolls back", async () => {
    const { sql } = fakeSql({ failCommit: true })

    await expect(recover.commitRecovery(sql, plan())).rejects.toThrow("simulated commit failure")
    expect(state.rows).toHaveLength(1)

    const after = await authenticateIntegration(tokenRequest(), "summary:read")
    expect(after).toEqual({ tokenId: 4, scopes: ["summary:read"] })
  })

  it("never exposes the token or its hash in the returned plan result", async () => {
    const { sql } = fakeSql()
    const result = await recover.commitRecovery(sql, plan())
    expect(JSON.stringify(result)).not.toContain(TOKEN)
    expect(JSON.stringify(result)).not.toContain(integrationTokenHash(TOKEN))
  })
})
