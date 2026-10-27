import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/lib/db"
import { fetchProwlarrIndexers } from "@/lib/prowlarr"
import { searchProwlarrIndexers } from "@/lib/prowlarr-search"
import { getTrackerListForDashboard } from "@/lib/server-data"

const h = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  selectLimit: vi.fn(),
}))

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return { ...actual, authenticate: h.authenticateMock }
})

vi.mock("@/lib/crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/crypto")>()
  return { ...actual, decrypt: vi.fn(() => "server-only-key") }
})

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ limit: h.selectLimit })),
    })),
  },
}))

vi.mock("@/lib/prowlarr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prowlarr")>()
  return { ...actual, fetchProwlarrIndexers: vi.fn() }
})

vi.mock("@/lib/prowlarr-search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prowlarr-search")>()
  return { ...actual, searchProwlarrIndexers: vi.fn() }
})

vi.mock("@/lib/server-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server-data")>()
  return { ...actual, getTrackerListForDashboard: vi.fn() }
})

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET as INDEXERS } from "./indexers/route"
import { POST as SEARCH } from "./route"

function settings(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    prowlarrUrl: "https://prowlarr.invalid",
    encryptedProwlarrApiKey: "ciphertext",
    prowlarrAllowPrivate: false,
    ...overrides,
  }
}

function searchRequest(body: unknown) {
  return new Request("http://localhost/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.authenticateMock.mockResolvedValue({ encryptionKey: "00".repeat(32) })
  h.selectLimit.mockResolvedValue([settings()])
  ;(fetchProwlarrIndexers as ReturnType<typeof vi.fn>).mockResolvedValue([
    {
      id: 5,
      name: "AlphaRatio",
      implementation: "AlphaRatio",
      fields: [{ name: "baseUrl", value: "https://alpharatio.cc" }],
    },
  ])
  ;(getTrackerListForDashboard as ReturnType<typeof vi.fn>).mockResolvedValue([
    {
      id: 1,
      name: "My AlphaRatio",
      registrySlug: "alpharatio",
      userPausedAt: null,
      latestStats: { ratio: 2 },
    },
  ])
  ;(searchProwlarrIndexers as ReturnType<typeof vi.fn>).mockResolvedValue({
    releases: [
      {
        indexerId: 5,
        indexerName: "AlphaRatio",
        title: "Example.Release",
        sizeBytes: 1024,
        seeders: 4,
        leechers: 1,
        publishDate: "2026-10-26T12:00:00.000Z",
        protocol: "torrent",
        downloadFactor: 0,
        downloadFactorLabel: "Freeleech (0% download)",
      },
    ],
    failures: [],
    selected: 1,
    responded: 1,
    hasMore: false,
  })
})

describe("GET /api/search/indexers", () => {
  it("returns ownership mapping from the existing Prowlarr connection", async () => {
    const res = await INDEXERS()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { indexers: { ownership: string }[] }
    expect(body.indexers[0].ownership).toBe("owned")
  })

  it("returns a configuration state without contacting Prowlarr", async () => {
    h.selectLimit.mockResolvedValue([settings({ prowlarrUrl: null })])
    const res = await INDEXERS()
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: "Prowlarr is not configured",
      code: "not-configured",
    })
    expect(fetchProwlarrIndexers).not.toHaveBeenCalled()
  })

  it("rejects a missing session", async () => {
    h.authenticateMock.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )
    const res = await INDEXERS()
    expect(res.status).toBe(401)
    expect(db.select).not.toHaveBeenCalled()
  })
})

describe("POST /api/search", () => {
  it("returns partial coverage and sanitized results without calling a client", async () => {
    ;(fetchProwlarrIndexers as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 5,
        name: "AlphaRatio",
        implementation: "AlphaRatio",
        fields: [{ name: "baseUrl", value: "https://alpharatio.cc" }],
      },
      { id: 6, name: "Broken", implementation: "Unknown", fields: [] },
    ])
    ;(searchProwlarrIndexers as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      releases: [
        {
          indexerId: 5,
          indexerName: "AlphaRatio",
          title: "Example.Release",
          sizeBytes: null,
          seeders: null,
          leechers: null,
          publishDate: null,
          protocol: "torrent",
          downloadFactor: null,
          downloadFactorLabel: null,
        },
      ],
      failures: [{ indexerId: 6, indexerName: "Broken", error: "Prowlarr search timed out" }],
      selected: 2,
      responded: 1,
      hasMore: true,
    })

    const res = await SEARCH(searchRequest({ query: "example", indexerIds: [5, 6], limit: 10 }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      results: Record<string, unknown>[]
      coverage: Record<string, unknown>
    }
    expect(body.results[0]).toMatchObject({
      title: "Example.Release",
      sizeBytes: null,
      seeders: null,
      downloadFactor: null,
      indexer: { ownership: "owned" },
    })
    expect(body.coverage).toMatchObject({
      partial: true,
      allFailed: false,
      hasMore: true,
      selected: 2,
      responded: 1,
    })
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain("server-only-key")
    expect(serialized).not.toContain("downloadUrl")
    expect(serialized).not.toContain("magnetUrl")
  })

  it("reports all-indexer failure as failure coverage, not an empty success", async () => {
    ;(searchProwlarrIndexers as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      releases: [],
      failures: [{ indexerId: 5, indexerName: "AlphaRatio", error: "Prowlarr rejected the API key" }],
      selected: 1,
      responded: 0,
      hasMore: false,
    })
    const res = await SEARCH(searchRequest({ query: "example", indexerIds: [5] }))
    const body = (await res.json()) as { coverage: { allFailed: boolean; partial: boolean } }
    expect(body.coverage.allFailed).toBe(true)
    expect(body.coverage.partial).toBe(false)
  })

  it.each([
    [{ query: "", indexerIds: [5] }, "query must be"],
    [{ query: "a".repeat(201), indexerIds: [5] }, "query must be"],
    [{ query: "bad\nquery", indexerIds: [5] }, "query must be"],
    [{ query: "x", indexerIds: [] }, "indexerIds must"],
    [{ query: "x", indexerIds: [5, 5] }, "duplicates"],
    [{ query: "x", indexerIds: [5], limit: 21 }, "limit/offset"],
    [{ query: "x", indexerIds: [5], offset: -1 }, "limit/offset"],
  ])("rejects invalid input %#", async (body, error) => {
    const res = await SEARCH(searchRequest(body))
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toContain(error)
    expect(searchProwlarrIndexers).not.toHaveBeenCalled()
  })

  it("rejects an indexer id that disappeared from Prowlarr", async () => {
    const res = await SEARCH(searchRequest({ query: "x", indexerIds: [99] }))
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toContain("no longer available")
    expect(searchProwlarrIndexers).not.toHaveBeenCalled()
  })

  it("rejects a missing session before any external request", async () => {
    h.authenticateMock.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )
    const res = await SEARCH(searchRequest({ query: "x", indexerIds: [5] }))
    expect(res.status).toBe(401)
    expect(fetchProwlarrIndexers).not.toHaveBeenCalled()
  })
})
