import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ComparisonPanel } from "@/components/search/ComparisonPanel"
import type { ProwlarrSearchIndexer } from "@/lib/prowlarr-search"

const NOW = new Date("2026-10-28T12:00:00.000Z")
const FRESH_POLL = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString()
const STALE_POLL = new Date(NOW.getTime() - 25 * 60 * 60 * 1000).toISOString()

const ACCOUNT_SNAPSHOT = {
  trackerId: 1,
  name: "My AlphaRatio",
  uploadedBytes: "1000",
  downloadedBytes: "500",
  requiredRatio: 1,
  lastPolledAt: FRESH_POLL,
}

const ACCOUNT: ProwlarrSearchIndexer = {
  indexerId: 1,
  indexerName: "AlphaRatio",
  implementation: "AlphaRatio",
  trackerSlug: "alpharatio",
  trackerName: "AlphaRatio",
  ownership: "owned",
  accountName: "My AlphaRatio",
  account: ACCOUNT_SNAPSHOT,
  reason: "Matched owned tracker account.",
}

function result(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    indexerId: 1,
    indexerName: "AlphaRatio",
    title: "Example.Release.1080p",
    sizeBytes: 100,
    seeders: 4,
    leechers: 0,
    publishDate: "2026-10-26T12:00:00.000Z",
    protocol: "torrent",
    downloadFactor: 1,
    downloadFactorLabel: "Fully charged",
    indexer: ACCOUNT,
    ...overrides,
  }
}

describe("ComparisonPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows concrete account arithmetic without ranking or safety claims", () => {
    render(
      <ComparisonPanel
        results={[
          result(),
          result({
            id: "r2",
            title: "Example.Release.1080p.Other",
            indexer: { ...ACCOUNT, account: { ...ACCOUNT_SNAPSHOT, uploadedBytes: "1000" } },
          }),
        ]}
      />
    )

    fireEvent.change(screen.getByLabelText("Your target ratio"), { target: { value: "1.5" } })
    expect(screen.getAllByText(/Projected ratio:/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Remaining charged allowance:/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Additional upload needed:/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Seeding\/H&R obligation: unknown/).length).toBeGreaterThan(0)
    expect(screen.getByText(/No ranking or universal/)).toBeInTheDocument()
  })

  it("keeps missing factor and stale account rows unavailable", () => {
    render(
      <ComparisonPanel
        results={[
          result({ downloadFactor: null, downloadFactorLabel: null }),
          result({
            id: "stale",
            indexer: {
              ...ACCOUNT,
              account: { ...ACCOUNT_SNAPSHOT, lastPolledAt: STALE_POLL },
            },
          }),
        ]}
      />
    )
    expect(screen.getAllByText("Comparison unavailable").length).toBeGreaterThan(0)
    expect(screen.getByText(/zero\/normal charge is not assumed/)).toBeInTheDocument()
    expect(screen.getByText(/Account observations are stale/)).toBeInTheDocument()
  })

  it("labels an explicit freeleech result as a scenario, not a safe/cheap default", () => {
    render(
      <ComparisonPanel
        results={[
          result({ downloadFactor: 0, downloadFactorLabel: "Freeleech (0% download)" }),
          result({ id: "r2", title: "Another.Release", downloadFactor: null }),
        ]}
      />
    )
    fireEvent.change(screen.getByLabelText("Your target ratio"), { target: { value: "1.5" } })
    expect(screen.getByText("Zero-charge scenario")).toBeInTheDocument()
    expect(screen.getByText(/not proof of safety/)).toBeInTheDocument()
    expect(screen.getByText(/freeleech result is not automatically preferred/)).toBeInTheDocument()
  })
})
