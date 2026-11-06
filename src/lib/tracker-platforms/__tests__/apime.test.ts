// src/lib/tracker-platforms/__tests__/apime.test.ts
//
// RetroFlix and SpeedApp share one API: GET /api/me behind an Authorization
// header, with the class as a numeric id and the site's ladder in the registry.
// Field names come from the live payloads the two sites serve.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApimeAdapter } from "../adapters/apime"

// SpeedApp's payload. Figures are anonymised; the account name and id are not
// real.
const SPEEDAPP_RESPONSE = {
  username: "example-user",
  user_id: 123456,
  class: 2,
  uploaded: 1234567890123,
  downloaded: 234567890123,
  credits: 4242,
  created_at: "2025-01-02T03:04:05.000000Z",
  seeding: 12,
  hit_and_run_count: 1,
  free_leech_tokens: 3,
}

// RetroFlix's payload, in the spelling its API uses.
const RETROFLIX_RESPONSE = {
  username: "example-user",
  user_id: 98765,
  class: 2,
  uploaded: 1234567890123,
  downloaded: 234567890123,
  seed_bonus: 77,
  created_at: "2024-02-03T04:05:06.000000Z",
  last_seen_at: "2026-11-06T10:20:30.000000Z",
  avatar_url: "https://retroflix.club/avatars/98765.png",
}

const SPEEDAPP_CLASSES = {
  "0": "Peasant",
  "1": "User",
  "2": "Power User",
  "3": "Elite User",
}

const RETROFLIX_CLASSES = {
  "0": "Film Dummy",
  "1": "Film Stunt",
  "2": "Movie Lover",
  "3": "Cinema Addicted",
}

const okResponse = (body: unknown) => ({ ok: true, json: async () => body }) as Response

describe("ApimeAdapter", () => {
  const adapter = new ApimeAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("maps SpeedApp's /api/me response into TrackerStats", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(SPEEDAPP_RESPONSE))

    const stats = await adapter.fetchStats("https://speedapp.io", "fake-token", "/api/me", {
      apimeClassMap: SPEEDAPP_CLASSES,
    })

    expect(stats.username).toBe("example-user")
    expect(stats.group).toBe("Power User")
    expect(stats.uploadedBytes).toBe(1234567890123n)
    expect(stats.downloadedBytes).toBe(234567890123n)
    expect(stats.ratio).toBeCloseTo(1234567890123 / 234567890123, 4)
    expect(stats.bufferBytes).toBe(1234567890123n - 234567890123n)
    expect(stats.seedbonus).toBe(4242)
    expect(stats.seedingCount).toBe(12)
    expect(stats.leechingCount).toBeNull()
    expect(stats.hitAndRuns).toBe(1)
    expect(stats.freeleechTokens).toBe(3)
    expect(stats.remoteUserId).toBe(123456)
    expect(stats.joinedDate).toBe("2025-01-02T03:04:05.000000Z")
    expect(stats.lastAccessDate).toBeUndefined()
  })

  it("maps RetroFlix's /api/me response, including its bonus and last-seen fields", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(RETROFLIX_RESPONSE))

    const stats = await adapter.fetchStats("https://retroflix.club", "fake-token", "/api/me", {
      apimeClassMap: RETROFLIX_CLASSES,
    })

    expect(stats.group).toBe("Movie Lover")
    expect(stats.seedbonus).toBe(77)
    expect(stats.remoteUserId).toBe(98765)
    expect(stats.joinedDate).toBe("2024-02-03T04:05:06.000000Z")
    expect(stats.lastAccessDate).toBe("2026-11-06T10:20:30.000000Z")
    expect(stats.lastAccessField).toBe("last_seen_at")
    expect(stats.avatarUrl).toBe("https://retroflix.club/avatars/98765.png")
    // RetroFlix reports no seed count in this payload.
    expect(stats.seedingCount).toBeNull()
  })

  it("reads the class as an id through the site's map, and shows it as sent when the map has no entry", async () => {
    for (const [reported, expected] of [
      [2, "Power User"],
      ["2", "Power User"],
      [99, "99"],
      ["VIP", "VIP"],
    ] as const) {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        okResponse({ ...SPEEDAPP_RESPONSE, class: reported })
      )
      const stats = await adapter.fetchStats("https://speedapp.io", "fake-token", "/api/me", {
        apimeClassMap: SPEEDAPP_CLASSES,
      })
      expect(stats.group, String(reported)).toBe(expected)
    }
  })

  it("shows the numeric class id when the registry supplies no map", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(SPEEDAPP_RESPONSE))

    const stats = await adapter.fetchStats("https://speedapp.io", "fake-token", "/api/me")

    expect(stats.group).toBe("2")
  })

  it("reports no class when the payload carries none", async () => {
    for (const value of [undefined, null, "", "   "]) {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        okResponse({ ...SPEEDAPP_RESPONSE, class: value })
      )
      const stats = await adapter.fetchStats("https://speedapp.io", "fake-token", "/api/me")
      expect(stats.group).toBeNull()
    }
  })

  it("reads a bonus the API sends as a decimal string", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({ ...SPEEDAPP_RESPONSE, credits: "4242.50" })
    )

    const stats = await adapter.fetchStats("https://speedapp.io", "fake-token", "/api/me")

    expect(stats.seedbonus).toBe(4242.5)
  })

  it("rejects a missing byte total instead of reading it as zero", async () => {
    for (const field of ["uploaded", "downloaded"] as const) {
      const { [field]: _dropped, ...body } = SPEEDAPP_RESPONSE
      vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(body))

      await expect(
        adapter.fetchStats("https://speedapp.io", "fake-token", "/api/me")
      ).rejects.toThrow(`Unexpected response from speedapp.io: missing ${field}`)
    }
  })

  it("rejects a non-numeric byte total", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({ ...SPEEDAPP_RESPONSE, uploaded: "1234567890123" })
    )

    await expect(
      adapter.fetchStats("https://speedapp.io", "fake-token", "/api/me")
    ).rejects.toThrow("Unexpected response from speedapp.io: non-numeric uploaded")
  })

  it("sends the raw key in the Authorization header by default and leaves it out of the URL", async () => {
    let capturedUrl: string | undefined
    let capturedInit: RequestInit | undefined
    vi.spyOn(global, "fetch").mockImplementationOnce((url, init) => {
      capturedUrl = String(url)
      capturedInit = init
      return Promise.resolve(okResponse(SPEEDAPP_RESPONSE))
    })

    await adapter.fetchStats("https://speedapp.io", "secret-token", "/api/me")

    const headers = capturedInit?.headers as Record<string, string> | undefined
    expect(headers?.Authorization).toBe("secret-token")
    expect(capturedUrl).toBe("https://speedapp.io/api/me")
    expect(capturedUrl).not.toContain("secret-token")
  })

  it("prefixes the key with Bearer when the site asks for that spelling", async () => {
    let capturedInit: RequestInit | undefined
    vi.spyOn(global, "fetch").mockImplementationOnce((_url, init) => {
      capturedInit = init
      return Promise.resolve(okResponse(SPEEDAPP_RESPONSE))
    })

    await adapter.fetchStats("https://speedapp.io", "secret-token", "/api/me", {
      headerAuthStyle: "bearer",
    })

    const headers = capturedInit?.headers as Record<string, string> | undefined
    expect(headers?.Authorization).toBe("Bearer secret-token")
  })

  it("does not expose the API token in non-ok response errors", async () => {
    const secretToken = "super-secret-api-token-12345"

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response)

    await expect(
      adapter.fetchStats("https://speedapp.io", secretToken, "/api/me")
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).toContain("401")
      expect(err.message).not.toContain(secretToken)
      return true
    })
  })
})

describe("ApimeAdapter - fetchRaw", () => {
  const adapter = new ApimeAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the raw response for the debug view", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(SPEEDAPP_RESPONSE))

    const calls = await adapter.fetchRaw("https://speedapp.io", "token", "/api/me", {
      apimeClassMap: SPEEDAPP_CLASSES,
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].label).toBe("User Stats")
    expect(calls[0].endpoint).toBe("/api/me")
    expect(calls[0].error).toBeNull()
    expect(calls[0].data).toEqual(SPEEDAPP_RESPONSE)
  })

  it("flags a 200 that fetchStats would fail, with the poll's message (standard 2.6)", async () => {
    const { uploaded: _dropped, ...body } = SPEEDAPP_RESPONSE
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(body))

    const calls = await adapter.fetchRaw("https://speedapp.io", "token", "/api/me")

    expect(calls[0].error).toBe("Unexpected response from speedapp.io: missing uploaded")
    // The offending body stays in data for the debug view.
    expect(calls[0].data).toEqual(body)
  })

  it("reports a 401 as an error call for the debug view", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response)

    const calls = await adapter.fetchRaw("https://speedapp.io", "token", "/api/me")

    expect(calls[0].data).toBeNull()
    expect(calls[0].error).toContain("401")
  })

  it("reports an error DebugApiCall instead of throwing when fetch rejects", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("fetch failed"))

    const calls = await adapter.fetchRaw("https://speedapp.io", "token", "/api/me")

    expect(calls[0].data).toBeNull()
    expect(calls[0].error).toBeTruthy()
    expect(calls[0].endpoint).toBe("/api/me")
  })
})
