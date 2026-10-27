import { afterEach, describe, expect, it, vi } from "vitest"
import type { ProwlarrIndexer, ProwlarrIndexerMatch } from "@/lib/prowlarr"
import {
  buildProwlarrSearchIndexers,
  mapProwlarrSearchRelease,
  searchProwlarrIndexers,
} from "@/lib/prowlarr-search"

const INDEXER: ProwlarrIndexer = {
  id: 5,
  name: "AlphaRatio",
  implementation: "AlphaRatio",
  fields: [{ name: "baseUrl", value: "https://alpharatio.cc" }],
}

const CHOICE = {
  indexerId: 5,
  indexerName: "AlphaRatio",
  implementation: "AlphaRatio",
  trackerSlug: "alpharatio",
  trackerName: "AlphaRatio",
  ownership: "owned" as const,
  accountName: "My AlphaRatio",
  reason: "Matched owned tracker account.",
}

function release(overrides: Record<string, unknown> = {}) {
  return {
    title: "Example.Release.2026.1080p",
    indexerId: 5,
    indexer: "AlphaRatio",
    size: 1024 ** 3,
    seeders: 12,
    leechers: 3,
    publishDate: "2026-10-26T12:00:00.000Z",
    protocol: "torrent",
    indexerFlags: [],
    ...overrides,
  }
}

function response(body: unknown, status = 200): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("buildProwlarrSearchIndexers", () => {
  it("distinguishes owned accounts, paused placeholders, no account and unsupported", () => {
    const choices = buildProwlarrSearchIndexers(
      [
        INDEXER,
        { ...INDEXER, id: 6, name: "Aither", fields: [{ name: "baseUrl", value: "https://aither.cc" }] },
        { ...INDEXER, id: 7, name: "Mystery Tracker", fields: [] },
      ],
      [
        {
          id: 1,
          name: "My Alpha",
          registrySlug: "alpharatio",
          userPausedAt: null,
          hasStats: true,
        },
        {
          id: 2,
          name: "Imported Aither",
          registrySlug: "aither",
          userPausedAt: "2026-10-01T00:00:00.000Z",
          hasStats: false,
        },
      ]
    )

    expect(choices.map((choice) => choice.ownership)).toEqual([
      "owned",
      "placeholder",
      "unsupported",
    ])
    expect(choices[1].reason).toContain("not a configured or healthy account")
  })

  it("reports no-account separately from an unsupported indexer", () => {
    const choices = buildProwlarrSearchIndexers(
      [INDEXER, { ...INDEXER, id: 8, name: "Mystery Tracker", fields: [] }],
      []
    )
    expect(choices[0].ownership).toBe("no-account")
    expect(choices[0].trackerSlug).toBe("alpharatio")
    expect(choices[1].ownership).toBe("unsupported")
  })

  it("reports ambiguous mappings without choosing a tracker", () => {
    const ambiguous: ProwlarrIndexerMatch = {
      candidates: [],
      matched: null,
      ambiguous: true,
    }
    const choices = buildProwlarrSearchIndexers([INDEXER], [], () => ambiguous)
    expect(choices[0].ownership).toBe("ambiguous")
    expect(choices[0].trackerSlug).toBeNull()
  })
})

describe("mapProwlarrSearchRelease", () => {
  it("keeps explicit freeleech and half-leech factors", () => {
    expect(
      mapProwlarrSearchRelease(release({ indexerFlags: ["freeleech"] }), {
        indexerId: 5,
        indexerName: "AlphaRatio",
      })
    ).toMatchObject({ downloadFactor: 0, downloadFactorLabel: "Freeleech (0% download)" })
    expect(
      mapProwlarrSearchRelease(release({ indexerFlags: ["halfleech"] }), {
        indexerId: 5,
        indexerName: "AlphaRatio",
      })
    ).toMatchObject({ downloadFactor: 0.5 })
    expect(
      mapProwlarrSearchRelease(release({ indexerFlags: ["neutralleech"] }), {
        indexerId: 5,
        indexerName: "AlphaRatio",
      })
    ).toMatchObject({ downloadFactor: 0 })
  })

  it("leaves missing or conflicting factors unknown", () => {
    for (const flags of [[], ["doubleupload"], ["freeleech", "halfleech"], "freeleech"]) {
      expect(
        mapProwlarrSearchRelease(release({ indexerFlags: flags }), {
          indexerId: 5,
          indexerName: "AlphaRatio",
        })
      ).toMatchObject({ downloadFactor: null, downloadFactorLabel: null })
    }
  })

  it("keeps missing size, seeders and publication date unknown", () => {
    const mapped = mapProwlarrSearchRelease(
      release({ size: 0, seeders: null, publishDate: "not-a-date" }),
      { indexerId: 5, indexerName: "AlphaRatio" }
    )
    expect(mapped).toMatchObject({
      sizeBytes: null,
      seeders: null,
      publishDate: null,
    })
  })

  it("does not expose download, magnet, info URLs or guids", () => {
    const mapped = mapProwlarrSearchRelease(
      release({
        downloadUrl: "https://prowlarr.example/download?apikey=secret",
        magnetUrl: "magnet:?xt=urn:btih:secret",
        infoUrl: "https://tracker.example/details?passkey=secret",
        guid: "https://tracker.example/secret-guid",
      }),
      { indexerId: 5, indexerName: "AlphaRatio" }
    )
    const serialized = JSON.stringify(mapped)
    expect(serialized).not.toContain("secret")
    expect(serialized).not.toContain("downloadUrl")
    expect(serialized).not.toContain("magnetUrl")
    expect(serialized).not.toContain("infoUrl")
    expect(serialized).not.toContain("guid")
  })
})

describe("searchProwlarrIndexers", () => {
  it("keeps successful results when another indexer fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes("indexerIds=5")) return response([release()])
        return response({ error: "boom" }, 500)
      })
    )
    const result = await searchProwlarrIndexers({
      baseUrl: "https://prowlarr.invalid",
      apiKey: "server-only-key",
      allowPrivate: false,
      indexers: [
        CHOICE,
        { ...CHOICE, indexerId: 6, indexerName: "Broken" },
      ],
      query: "example",
      limit: 10,
      offset: 0,
    })

    expect(result.releases).toHaveLength(1)
    expect(result.responded).toBe(1)
    expect(result.failures).toEqual([
      { indexerId: 6, indexerName: "Broken", error: "Prowlarr search failed (HTTP 500)" },
    ])
    expect(result.hasMore).toBe(false)
  })

  it("maps timeout, malformed, rate-limit and oversized responses to failures", async () => {
    const responses: (() => Promise<Response>)[] = [
      async () => {
        const err = new Error("timed out")
        err.name = "TimeoutError"
        throw err
      },
      async () => response("not json"),
      async () => response({}, 429),
      async () => response("x".repeat(1024 * 1024 + 1)),
    ]
    for (const next of responses) {
      vi.stubGlobal("fetch", vi.fn(next))
      const result = await searchProwlarrIndexers({
        baseUrl: "https://prowlarr.invalid",
        apiKey: "server-only-key",
        allowPrivate: false,
        indexers: [CHOICE],
        query: "example",
        limit: 10,
        offset: 0,
      })
      expect(result.responded).toBe(0)
      expect(result.failures).toHaveLength(1)
      expect(result.failures[0].error).not.toContain("server-only-key")
    }
  })

  it("keeps duplicate titles instead of inferring equivalence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response([
          release({ title: "Same.Name", size: 100 }),
          release({ title: "Same.Name", size: 100 }),
        ])
      )
    )
    const result = await searchProwlarrIndexers({
      baseUrl: "https://prowlarr.invalid",
      apiKey: "server-only-key",
      allowPrivate: false,
      indexers: [CHOICE],
      query: "same",
      limit: 10,
      offset: 0,
    })
    expect(result.releases).toHaveLength(2)
    expect(result.releases.map((item) => item.title)).toEqual(["Same.Name", "Same.Name"])
  })

  it("sends the key only in the header and bounds concurrency", async () => {
    let active = 0
    let maxActive = 0
    const seen: { url: string; key: string | null }[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        active++
        maxActive = Math.max(maxActive, active)
        seen.push({
          url: String(input),
          key: new Headers(init?.headers).get("X-Api-Key"),
        })
        await new Promise((resolve) => setTimeout(resolve, 5))
        active--
        return response([])
      })
    )
    const indexers = Array.from({ length: 8 }, (_, index) => ({
      ...CHOICE,
      indexerId: index + 1,
      indexerName: `Indexer ${index + 1}`,
    }))
    await searchProwlarrIndexers({
      baseUrl: "https://prowlarr.invalid",
      apiKey: "server-only-key",
      allowPrivate: false,
      indexers,
      query: "example",
      limit: 10,
      offset: 0,
    })
    expect(maxActive).toBeLessThanOrEqual(3)
    expect(seen.every((entry) => entry.key === "server-only-key")).toBe(true)
    expect(seen.every((entry) => !entry.url.includes("server-only-key"))).toBe(true)
    expect(seen.every((entry) => entry.url.includes("query=example"))).toBe(true)
  })

  it("marks hasMore when an indexer fills the requested page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(Array.from({ length: 10 }, (_, index) => release({ title: `R${index}` }))))
    )
    const result = await searchProwlarrIndexers({
      baseUrl: "https://prowlarr.invalid",
      apiKey: "server-only-key",
      allowPrivate: false,
      indexers: [CHOICE],
      query: "example",
      limit: 10,
      offset: 0,
    })
    expect(result.hasMore).toBe(true)
  })

  it("rejects an unapproved private Prowlarr URL before fetch", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(
      searchProwlarrIndexers({
        baseUrl: "http://127.0.0.1:9696",
        apiKey: "server-only-key",
        allowPrivate: false,
        indexers: [CHOICE],
        query: "example",
        limit: 10,
        offset: 0,
      })
    ).rejects.toThrow("private network")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
