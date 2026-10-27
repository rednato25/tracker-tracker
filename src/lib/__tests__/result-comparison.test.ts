import { describe, expect, it } from "vitest"
import type { ProwlarrSearchIndexer } from "@/lib/prowlarr-search"
import { compareSearchResults } from "@/lib/result-comparison"

const NOW = new Date("2026-10-27T12:00:00.000Z")

function indexer(overrides: Partial<ProwlarrSearchIndexer> = {}): ProwlarrSearchIndexer {
  return {
    indexerId: 1,
    indexerName: "AlphaRatio",
    implementation: "AlphaRatio",
    trackerSlug: "alpharatio",
    trackerName: "AlphaRatio",
    ownership: "owned",
    accountName: "My AlphaRatio",
    account: {
      trackerId: 1,
      name: "My AlphaRatio",
      uploadedBytes: "1000",
      downloadedBytes: "500",
      requiredRatio: 1,
      lastPolledAt: "2026-10-27T11:00:00.000Z",
    },
    reason: "Matched owned tracker account.",
    ...overrides,
  }
}

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    title: "Example.Release.1080p",
    sizeBytes: 100,
    downloadFactor: 1,
    downloadFactorLabel: "Fully charged",
    indexer: indexer(),
    ...overrides,
  }
}

describe("compareSearchResults", () => {
  it("reuses the budget arithmetic and keeps target and minimum separate", () => {
    const result = compareSearchResults({
      candidates: [candidate()],
      targetRatio: 1.5,
      now: NOW,
    })
    const row = result.rows[0]

    expect(row.status).toBe("available")
    expect(row.chargedBytes).toBe(100)
    expect(row.targetRatio).toBe(1.5)
    expect(row.minimumRatio).toBe(1)
    expect(row.budget).toMatchObject({
      projectedRatio: 1000 / 600,
      remainingChargedAfterProposed: expect.closeTo(1000 / 1.5 - 600, 6),
      additionalUploadRequired: 0,
      safetyVerdict: "not-assessed",
    })
    expect(row.seedingObligation).toBe("unknown")
    expect(row.unknowns).toEqual([])
  })

  it("never treats freeleech or neutralleech zero as proof of safety", () => {
    const result = compareSearchResults({
      candidates: [
        candidate({
          id: "free",
          downloadFactor: 0,
          downloadFactorLabel: "Freeleech (0% download)",
        }),
      ],
      targetRatio: 1.5,
      now: NOW,
    })
    const row = result.rows[0]

    expect(row.status).toBe("scenario-only")
    expect(row.chargedBytes).toBe(0)
    expect(row.budget?.status).toBe("scenario-only")
    expect(row.budget?.safetyVerdict).toBe("not-assessed")
    expect(row.reasons.join(" ")).toContain("not proof of safety")
    expect(row.seedingObligation).toBe("unknown")
  })

  it("keeps unknown accounting, size and target unavailable instead of assuming zero", () => {
    const unknownFactor = compareSearchResults({
      candidates: [candidate({ downloadFactor: null })],
      targetRatio: 1,
      now: NOW,
    }).rows[0]
    expect(unknownFactor.chargedBytes).toBeNull()
    expect(unknownFactor.status).toBe("unavailable")
    expect(unknownFactor.unknowns.join(" ")).toContain("not assumed")

    const unknownSize = compareSearchResults({
      candidates: [candidate({ sizeBytes: null })],
      targetRatio: 1,
      now: NOW,
    }).rows[0]
    expect(unknownSize.chargedBytes).toBeNull()
    expect(unknownSize.status).toBe("unavailable")

    const noTarget = compareSearchResults({
      candidates: [candidate()],
      targetRatio: null,
      now: NOW,
    }).rows[0]
    expect(noTarget.status).toBe("unavailable")
    expect(noTarget.budget).toBeNull()
    expect(noTarget.chargedBytes).toBe(100)
    expect(noTarget.unknowns.join(" ")).toContain("target ratio")
  })

  it("keeps stale, missing, placeholder and ambiguous accounts unavailable", () => {
    const stale = compareSearchResults({
      candidates: [
        candidate({
          indexer: indexer({
            account: {
              trackerId: 1,
              name: "My AlphaRatio",
              uploadedBytes: "1000",
              downloadedBytes: "500",
              requiredRatio: 1,
              lastPolledAt: "2026-10-20T11:00:00.000Z",
            },
          }),
        }),
      ],
      targetRatio: 1,
      now: NOW,
    }).rows[0]
    expect(stale.accountState).toBe("available")
    expect(stale.accountFreshness).toBe("stale")
    expect(stale.status).toBe("unavailable")
    expect(stale.budget).toBeNull()
    expect(stale.chargedBytes).toBe(100)

    for (const ownership of ["placeholder", "no-account", "ambiguous", "unsupported"] as const) {
      const row = compareSearchResults({
        candidates: [
          candidate({ indexer: indexer({ ownership, account: null, accountName: null }) }),
        ],
        targetRatio: 1,
        now: NOW,
      }).rows[0]
      expect(row.status, ownership).toBe("unavailable")
      expect(row.budget).toBeNull()
    }
  })

  it("keeps selected alternatives independent for the documented 900/600 fixture", () => {
    const GiB = 1024 ** 3
    const account = {
      trackerId: 1,
      name: "My AlphaRatio",
      uploadedBytes: String(900 * GiB),
      downloadedBytes: String(600 * GiB),
      requiredRatio: 1,
      lastPolledAt: "2026-10-27T11:00:00.000Z",
    }
    const candidates = [
      candidate({ id: "normal", title: "Synthetic.Normal", sizeBytes: 80 * GiB, downloadFactor: 1 }),
      candidate({ id: "half", title: "Synthetic.Half", sizeBytes: 80 * GiB, downloadFactor: 0.5 }),
      candidate({ id: "free", title: "Synthetic.Free", sizeBytes: 80 * GiB, downloadFactor: 0 }),
      candidate({ id: "unknown", title: "Synthetic.Unknown", sizeBytes: 80 * GiB, downloadFactor: null }),
    ].map((item) => ({ ...item, indexer: indexer({ account }) }))

    const result = compareSearchResults({ candidates, targetRatio: 1, now: NOW })
    const [normal, half, free, unknown] = result.rows

    expect(normal.chargedBytes).toBe(80 * GiB)
    expect(normal.budget?.projectedRatio).toBeCloseTo(900 / 680, 6)
    expect(normal.budget?.remainingChargedAfterProposed).toBe(220 * GiB)
    expect(half.chargedBytes).toBe(40 * GiB)
    expect(half.budget?.projectedRatio).toBeCloseTo(900 / 640, 6)
    expect(half.budget?.remainingChargedAfterProposed).toBe(260 * GiB)
    expect(free.chargedBytes).toBe(0)
    expect(free.status).toBe("scenario-only")
    expect(free.budget?.projectedRatio).toBeCloseTo(1.5, 6)
    expect(free.budget?.remainingChargedAfterProposed).toBe(300 * GiB)
    expect(unknown.status).toBe("unavailable")
    expect(unknown.budget).toBeNull()
  })

  it("does not merge similar titles or infer equivalence", () => {
    const result = compareSearchResults({
      candidates: [
        candidate({ id: "a" }),
        candidate({ id: "b", title: "Example.Release.1080p.REPACK" }),
      ],
      targetRatio: 1,
      now: NOW,
    })
    expect(result.rows).toHaveLength(2)
    expect(result.rows.map((row) => row.id)).toEqual(["a", "b"])
    expect(result.rows.map((row) => row.title)).toEqual([
      "Example.Release.1080p",
      "Example.Release.1080p.REPACK",
    ])
  })

  it("does not credit future upload and reports unknown seeding obligations separately", () => {
    const result = compareSearchResults({
      candidates: [candidate({ sizeBytes: 200 })],
      targetRatio: 2,
      now: NOW,
    })
    const row = result.rows[0]
    expect(row.budget?.projectedRatio).toBe(1000 / 700)
    expect(row.budget?.additionalUploadRequired).toBe(400)
    expect(row.seedingObligation).toBe("unknown")
    expect(row.unknowns).toEqual([])
  })
})
