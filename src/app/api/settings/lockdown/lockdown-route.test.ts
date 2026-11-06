// src/app/api/settings/lockdown/lockdown-route.test.ts
//
// The emergency lockdown destroys credentials, so it must confirm intent with
// the master password. This pins the ordering as much as the status codes: a
// wrong password has to return before the scheduler is stopped or any row is
// touched.

import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { clearSession, verifyPassword } from "@/lib/auth"
import { generateSalt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { stopScheduler } from "@/lib/scheduler"
import { clearSchedulerKey } from "@/lib/scheduler-key-store"
import { POST } from "./route"

vi.mock("@/lib/api-helpers", () => ({
  authenticate: vi.fn(),
  parseJsonBody: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  clearSession: vi.fn(),
  verifyPassword: vi.fn(),
}))

vi.mock("@/lib/crypto", () => ({
  generateSalt: vi.fn(() => "new-salt"),
}))

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: { id: "app_settings.id" },
  downloadClients: {},
  integrationTokens: {},
  notificationTargets: {},
  trackers: {},
}))

vi.mock("@/lib/scheduler", () => ({
  stopScheduler: vi.fn(),
}))

vi.mock("@/lib/scheduler-key-store", () => ({
  clearSchedulerKey: vi.fn(),
}))

const SETTINGS = { id: 1, passwordHash: "argon2-hash" }

function makeRequest(body: Record<string, unknown> = {}): Request {
  return new Request("http://localhost/api/settings/lockdown", { method: "POST" })
}

function mockSettings() {
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([SETTINGS]),
    }),
  })
}

function mockTransaction() {
  const tx = {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    }),
    delete: vi.fn().mockResolvedValue(undefined),
  }
  ;(db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (fn: (transaction: unknown) => Promise<unknown>) => fn(tx)
  )
  return tx
}

describe("POST /api/settings/lockdown", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: "a".repeat(64) })
    ;(generateSalt as ReturnType<typeof vi.fn>).mockReturnValue("new-salt")
    mockSettings()
  })

  it("returns 401 when the session is missing", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const res = await POST(makeRequest({ password: "secret" }))

    expect(res.status).toBe(401)
    expect(stopScheduler).not.toHaveBeenCalled()
  })

  it("rejects a missing master password before doing any work", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const res = await POST(makeRequest())

    expect(res.status).toBe(400)
    expect(verifyPassword).not.toHaveBeenCalled()
    expect(stopScheduler).not.toHaveBeenCalled()
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it("rejects a wrong master password before stopping schedulers or touching rows", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ password: "wrong" })
    ;(verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(false)

    const res = await POST(makeRequest({ password: "wrong" }))

    expect(res.status).toBe(401)
    expect(clearSession).not.toHaveBeenCalled()
    expect(stopScheduler).not.toHaveBeenCalled()
    expect(clearSchedulerKey).not.toHaveBeenCalled()
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it("runs the lockdown only after the master password matches", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ password: "correct" })
    ;(verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    const tx = mockTransaction()

    const res = await POST(makeRequest({ password: "correct" }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ success: true })
    expect(verifyPassword).toHaveBeenCalledWith("argon2-hash", "correct")
    expect(stopScheduler).toHaveBeenCalledOnce()
    expect(clearSchedulerKey).toHaveBeenCalledWith(SETTINGS.id)
    expect(tx.delete).toHaveBeenCalledOnce()
    expect(clearSession).toHaveBeenCalledOnce()
  })
})
