import type { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { GET, PUT } from "./route"

vi.mock("@/lib/api-helpers", () => ({
  authenticate: vi.fn(),
  parseJsonBody: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: { id: "id", dashboardSettings: "dashboardSettings" },
}))

let written: string | null = null
let stored: string | null = null

function mockStoredRow(value: string | null) {
  stored = value
  vi.mocked(db.select).mockReturnValue({
    from: () => ({ limit: () => Promise.resolve([{ id: 1, dashboardSettings: stored }]) }),
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  written = null
  vi.mocked(authenticate).mockResolvedValue({} as never)
  vi.mocked(db.update).mockReturnValue({
    set: (values: { dashboardSettings: string }) => {
      written = values.dashboardSettings
      stored = values.dashboardSettings
      return { where: () => Promise.resolve() }
    },
  } as never)
  mockStoredRow(JSON.stringify({ showLoginTimers: false }))
})

async function put(body: Record<string, unknown>) {
  vi.mocked(parseJsonBody).mockResolvedValue(body as never)
  const res = await PUT(
    new Request("http://localhost/api/settings/rank-manual-values", { method: "PUT" })
  )
  return { res: res as NextResponse, body: (await (res as NextResponse).json()) as Record<string, unknown> }
}

describe("rank manual values route", () => {
  it("stores a manual value in the existing dashboardSettings JSON", async () => {
    const { res, body } = await put({
      trackerId: 7,
      metric: "seedSizeBytes",
      manualValue: { value: 2, unit: "TiB", enteredAt: "2026-10-31" },
    })
    expect(res.status).toBe(200)
    expect(body).toEqual({
      rankManualValues: {
        "7": { seedSizeBytes: { value: 2, unit: "TiB", enteredAt: "2026-10-31" } },
      },
    })
    const writtenJson = JSON.parse(written as string) as Record<string, unknown>
    expect(writtenJson.showLoginTimers).toBe(false)
    expect(writtenJson.rankManualValues).toEqual(body.rankManualValues)
  })

  it("clears a manual value and removes an empty tracker entry", async () => {
    mockStoredRow(
      JSON.stringify({
        rankManualValues: {
          "7": { seedSizeBytes: { value: 2, unit: "TiB", enteredAt: "2026-10-31" } },
        },
      })
    )
    const { body } = await put({ trackerId: 7, metric: "seedSizeBytes", manualValue: null })
    expect(body).toEqual({ rankManualValues: {} })
    expect(JSON.parse(written as string).rankManualValues).toEqual({})
  })

  it("rejects an unknown metric and an invalid value", async () => {
    const unknown = await put({
      trackerId: 7,
      metric: "not-a-metric",
      manualValue: { value: 1, unit: "GiB", enteredAt: "2026-10-31" },
    })
    expect(unknown.res.status).toBe(400)

    const invalid = await put({
      trackerId: 7,
      metric: "seedSizeBytes",
      manualValue: { value: -1, unit: "GiB", enteredAt: "2026-10-31" },
    })
    expect(invalid.res.status).toBe(400)
  })

  it("returns the stored values", async () => {
    mockStoredRow(
      JSON.stringify({
        rankManualValues: {
          "7": { seedSizeBytes: { value: 2, unit: "TiB", enteredAt: "2026-10-31" } },
        },
      })
    )
    const res = await GET()
    const body = (await (res as NextResponse).json()) as {
      rankManualValues: Record<string, unknown>
    }
    expect(body.rankManualValues).toEqual({
      "7": { seedSizeBytes: { value: 2, unit: "TiB", enteredAt: "2026-10-31" } },
    })
  })
})
