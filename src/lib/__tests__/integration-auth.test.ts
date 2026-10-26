import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/lib/db"
import {
  authenticateIntegration,
  createIntegrationTokenValue,
  integrationTokenHash,
} from "@/lib/integration-auth"
import { INTEGRATION_TOKEN_PATTERN } from "@/lib/integration-scopes"

const TOKEN = `tt_int_${"a".repeat(43)}`
const selectLimit = vi.fn()
const updateWhere = vi.fn()
let row: { id: number; scopes: string[]; revokedAt: Date | null } | null

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({ limit: selectLimit }),
      }),
    })),
    update: vi.fn(() => ({
      set: () => ({ where: updateWhere }),
    })),
  },
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

function request(headers: Record<string, string> = {}, url = "http://localhost/api/integrations/v1/summary") {
  return new Request(url, { headers })
}

beforeEach(() => {
  vi.clearAllMocks()
  row = { id: 7, scopes: ["summary:read", "history:read"], revokedAt: null }
  selectLimit.mockImplementation(async () => (row ? [row] : []))
  updateWhere.mockResolvedValue([])
})

describe("integration token primitives", () => {
  it("generates a prefixed high-entropy token", () => {
    const value = createIntegrationTokenValue()
    expect(value).toMatch(INTEGRATION_TOKEN_PATTERN)
    expect(value).not.toBe(createIntegrationTokenValue())
  })

  it("hashes deterministically to a 64-character digest", () => {
    expect(integrationTokenHash(TOKEN)).toMatch(/^[0-9a-f]{64}$/)
    expect(integrationTokenHash(TOKEN)).toBe(integrationTokenHash(TOKEN))
    expect(integrationTokenHash(TOKEN)).not.toBe(integrationTokenHash(`${TOKEN}x`))
  })
})

describe("authenticateIntegration", () => {
  it("rejects query-string tokens even when a valid header is also present", async () => {
    const res = await authenticateIntegration(
      request(
        { authorization: `Bearer ${TOKEN}` },
        "http://localhost/api/integrations/v1/summary?token=value"
      ),
      "summary:read"
    )
    expect(res).toBeInstanceOf(Response)
    expect((res as Response).status).toBe(400)
    expect(db.select).not.toHaveBeenCalled()
  })

  it("rejects a missing or malformed Authorization header", async () => {
    const missing = await authenticateIntegration(request(), "summary:read")
    expect((missing as Response).status).toBe(401)
    expect((missing as Response).headers.get("WWW-Authenticate")).toBe(
      'Bearer realm="tracker-tracker"'
    )

    const basic = await authenticateIntegration(
      request({ authorization: "Basic abc" }),
      "summary:read"
    )
    expect((basic as Response).status).toBe(401)
  })

  it("rejects unknown and revoked tokens with the same generic 401", async () => {
    row = null
    const unknown = await authenticateIntegration(
      request({ authorization: `Bearer ${TOKEN}` }),
      "summary:read"
    )
    expect((unknown as Response).status).toBe(401)
    await expect((unknown as Response).json()).resolves.toEqual({ error: "Unauthorized" })

    row = { id: 7, scopes: ["summary:read"], revokedAt: new Date("2026-10-01T00:00:00Z") }
    const revoked = await authenticateIntegration(
      request({ authorization: `Bearer ${TOKEN}` }),
      "summary:read"
    )
    expect((revoked as Response).status).toBe(401)
  })

  it("returns 403 without echoing token material when the scope is absent", async () => {
    row = { id: 7, scopes: ["history:read"], revokedAt: null }
    const res = await authenticateIntegration(
      request({ authorization: `Bearer ${TOKEN}` }),
      "summary:read"
    )
    expect((res as Response).status).toBe(403)
    const body = (await (res as Response).json()) as Record<string, unknown>
    expect(body).toEqual({ error: "Forbidden", requiredScope: "summary:read" })
    expect(JSON.stringify(body)).not.toContain(TOKEN)
    expect(updateWhere).not.toHaveBeenCalled()
  })

  it("accepts a valid scoped token and records usage without returning the token", async () => {
    const result = await authenticateIntegration(
      request({ authorization: `Bearer ${TOKEN}` }),
      "summary:read"
    )
    expect(result).toEqual({ tokenId: 7, scopes: ["summary:read", "history:read"] })
    expect(JSON.stringify(result)).not.toContain(TOKEN)
    expect(updateWhere).toHaveBeenCalledTimes(1)
  })

  it("keeps a valid read working when usage metadata cannot be written", async () => {
    updateWhere.mockRejectedValueOnce(new Error("metadata unavailable"))
    const result = await authenticateIntegration(
      request({ authorization: `Bearer ${TOKEN}` }),
      "summary:read"
    )
    expect(result).toEqual({ tokenId: 7, scopes: ["summary:read", "history:read"] })
  })
})
