import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SearchClient } from "@/components/search/SearchClient"
import type { ProwlarrSearchIndexer } from "@/lib/prowlarr-search"

const fetchMock = vi.fn()

const INDEXERS: ProwlarrSearchIndexer[] = [
  {
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
      lastPolledAt: "2026-10-26T11:00:00.000Z",
    },
    reason: "Matched owned tracker account.",
  },
  {
    indexerId: 2,
    indexerName: "Imported Aither",
    implementation: "Aither",
    trackerSlug: "aither",
    trackerName: "Aither",
    ownership: "placeholder",
    accountName: "Imported Aither",
    reason: "This is an imported PAUSED placeholder with no stats.",
  },
  {
    indexerId: 3,
    indexerName: "Mystery",
    implementation: "Unknown",
    trackerSlug: null,
    trackerName: null,
    ownership: "ambiguous",
    accountName: null,
    reason: "Multiple registry entries match this indexer.",
  },
]

function result(overrides: Record<string, unknown> = {}) {
  return {
    indexerId: 1,
    indexerName: "AlphaRatio",
    title: "Example.Release.2026.1080p",
    sizeBytes: 1024,
    seeders: 4,
    leechers: 1,
    publishDate: "2026-10-26T12:00:00.000Z",
    protocol: "torrent",
    downloadFactor: 0,
    downloadFactorLabel: "Freeleech (0% download)",
    indexer: INDEXERS[0],
    ...overrides,
  }
}

function searchResponse(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: "2026-10-26T12:10:00.000Z",
    results: [result()],
    coverage: {
      selected: 1,
      responded: 1,
      failed: 0,
      failures: [],
      partial: false,
      allFailed: false,
      hasMore: false,
      limit: 10,
      offset: 0,
    },
    ...overrides,
  }
}

function json(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

function searchCalls() {
  return fetchMock.mock.calls.filter(
    ([input, init]) => String(input) === "/api/search" && (init as RequestInit | undefined)?.method === "POST"
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "/api/search/indexers") return json({ indexers: INDEXERS })
    if (String(input) === "/api/search" && init?.method === "POST") return json(searchResponse())
    throw new Error(`unexpected fetch ${String(input)}`)
  })
})

describe("SearchClient", () => {
  it("loads indexers but does not search on page load", async () => {
    render(<SearchClient />)
    expect(await screen.findByText("Owned account")).toBeInTheDocument()
    expect(screen.getByText("Paused placeholder")).toBeInTheDocument()
    expect(screen.getByText("Ambiguous match")).toBeInTheDocument()
    expect(searchCalls()).toHaveLength(0)
    expect(screen.getByText(/does not search/)).toBeInTheDocument()
  })

  it("submits only on explicit action and renders explicit metadata", async () => {
    const user = userEvent.setup()
    render(<SearchClient />)

    await screen.findByText("Owned account")
    await user.click(screen.getByRole("checkbox", { name: /AlphaRatio/ }))
    await user.type(screen.getByLabelText("Search releases"), "example")
    await user.click(screen.getByRole("button", { name: "Search selected indexers" }))

    expect(await screen.findByText("Example.Release.2026.1080p")).toBeInTheDocument()
    expect(screen.getByText("Freeleech (0% download)")).toBeInTheDocument()
    expect(screen.getByText(/Size:\s*1\.00\s*KiB/)).toBeInTheDocument()
    expect(screen.getByText(/Seeders:\s*4/)).toBeInTheDocument()
    expect(screen.getByText(/Published:\s*/)).toBeInTheDocument()
    expect(searchCalls()).toHaveLength(1)
    expect(JSON.parse(String((searchCalls()[0][1] as RequestInit).body))).toMatchObject({
      query: "example",
      indexerIds: [1],
      limit: 10,
      offset: 0,
    })
    expect(screen.queryByRole("button", { name: /grab/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /download/i })).not.toBeInTheDocument()
  })

  it("leaves missing size, seeders and accounting factor unknown", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/search/indexers") return json({ indexers: INDEXERS })
      if (init?.method === "POST") {
        return json(
          searchResponse({
            results: [
              result({
                sizeBytes: null,
                seeders: null,
                publishDate: null,
                downloadFactor: null,
                downloadFactorLabel: null,
              }),
            ],
          })
        )
      }
      throw new Error("unexpected")
    })
    const user = userEvent.setup()
    render(<SearchClient />)
    await screen.findByText("Owned account")
    await user.click(screen.getByRole("checkbox", { name: /AlphaRatio/ }))
    await user.type(screen.getByLabelText("Search releases"), "example")
    await user.click(screen.getByRole("button", { name: "Search selected indexers" }))

    expect(await screen.findByText("Size: Unknown")).toBeInTheDocument()
    expect(screen.getByText("Seeders: Unknown")).toBeInTheDocument()
    expect(screen.getByText("Published: Unknown")).toBeInTheDocument()
    expect(screen.getByText("Unknown")).toBeInTheDocument()
  })

  it("compares independently selected results with a user target ratio", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/search/indexers") return json({ indexers: INDEXERS })
      if (init?.method === "POST") {
        return json(
          searchResponse({
            results: [
              result(),
              result({ title: "Example.Release.Other", sizeBytes: 2048 }),
            ],
          })
        )
      }
      throw new Error("unexpected")
    })
    const user = userEvent.setup()
    render(<SearchClient />)
    await screen.findByText("Owned account")
    await user.click(screen.getByRole("checkbox", { name: /AlphaRatio/ }))
    await user.type(screen.getByLabelText("Search releases"), "example")
    await user.click(screen.getByRole("button", { name: "Search selected indexers" }))
    await screen.findByText("Example.Release.2026.1080p")
    const compareBoxes = screen.getAllByRole("checkbox", { name: "Compare" })
    await user.click(compareBoxes[0])
    await user.click(compareBoxes[1])
    expect(screen.getByText("Compare selected results")).toBeInTheDocument()
    await user.type(screen.getByLabelText("Your target ratio"), "1.5")
    expect(screen.getAllByText(/Projected ratio:/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/download action/i)).not.toBeInTheDocument()
  })

  it("shows partial coverage and all-failed states distinctly", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/search/indexers") return json({ indexers: INDEXERS })
      if (init?.method === "POST") {
        return json(
          searchResponse({
            coverage: {
              selected: 2,
              responded: 1,
              failed: 1,
              failures: [{ indexerId: 2, indexerName: "Imported Aither", error: "Prowlarr search timed out" }],
              partial: true,
              allFailed: false,
              hasMore: false,
              limit: 10,
              offset: 0,
            },
          })
        )
      }
      throw new Error("unexpected")
    })
    const user = userEvent.setup()
    render(<SearchClient />)
    await screen.findByText("Owned account")
    await user.click(screen.getByRole("checkbox", { name: /AlphaRatio/ }))
    await user.type(screen.getByLabelText("Search releases"), "example")
    await user.click(screen.getByRole("button", { name: "Search selected indexers" }))
    expect(await screen.findByText("Partial results")).toBeInTheDocument()
    expect(screen.getByText(/Imported Aither \(Prowlarr search timed out\)/)).toBeInTheDocument()
    expect(screen.getByText(/incomplete/)).toBeInTheDocument()
  })

  it("reports all failed as failure, not empty success", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/search/indexers") return json({ indexers: INDEXERS })
      if (init?.method === "POST") {
        return json(
          searchResponse({
            results: [],
            coverage: {
              selected: 1,
              responded: 0,
              failed: 1,
              failures: [{ indexerId: 1, indexerName: "AlphaRatio", error: "Prowlarr rejected the API key" }],
              partial: false,
              allFailed: true,
              hasMore: false,
              limit: 10,
              offset: 0,
            },
          })
        )
      }
      throw new Error("unexpected")
    })
    const user = userEvent.setup()
    render(<SearchClient />)
    await screen.findByText("Owned account")
    await user.click(screen.getByRole("checkbox", { name: /AlphaRatio/ }))
    await user.type(screen.getByLabelText("Search releases"), "example")
    await user.click(screen.getByRole("button", { name: "Search selected indexers" }))
    expect(await screen.findByText("No indexer responded")).toBeInTheDocument()
    expect(screen.getByText(/not an empty result/)).toBeInTheDocument()
  })

  it("shows an empty state for a successful empty search", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/search/indexers") return json({ indexers: INDEXERS })
      if (init?.method === "POST") {
        return json(
          searchResponse({
            results: [],
          })
        )
      }
      throw new Error("unexpected")
    })
    const user = userEvent.setup()
    render(<SearchClient />)
    await screen.findByText("Owned account")
    await user.click(screen.getByRole("checkbox", { name: /AlphaRatio/ }))
    await user.type(screen.getByLabelText("Search releases"), "nothing")
    await user.click(screen.getByRole("button", { name: "Search selected indexers" }))
    expect(await screen.findByText("No results")).toBeInTheDocument()
    expect(screen.getByText(/returned no releases/)).toBeInTheDocument()
  })

  it("requests the next Prowlarr offset explicitly", async () => {
    let calls = 0
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/search/indexers") return json({ indexers: INDEXERS })
      if (init?.method === "POST") {
        calls++
        return json(
          searchResponse({
            coverage: {
              selected: 1,
              responded: 1,
              failed: 0,
              failures: [],
              partial: false,
              allFailed: false,
              hasMore: calls === 1,
              limit: 10,
              offset: calls === 1 ? 0 : 10,
            },
          })
        )
      }
      throw new Error("unexpected")
    })
    const user = userEvent.setup()
    render(<SearchClient />)
    await screen.findByText("Owned account")
    await user.click(screen.getByRole("checkbox", { name: /AlphaRatio/ }))
    await user.type(screen.getByLabelText("Search releases"), "example")
    await user.click(screen.getByRole("button", { name: "Search selected indexers" }))
    await screen.findByText("Example.Release.2026.1080p")
    await user.click(screen.getByRole("button", { name: "Next page" }))
    await waitFor(() => {
      expect(JSON.parse(String((searchCalls()[1][1] as RequestInit).body))).toMatchObject({
        offset: 10,
        limit: 10,
      })
    })
  })

  it("cancels and ignores the late response from the canceled search", async () => {
    let resolveSearch: ((value: unknown) => void) | undefined
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/search/indexers") return json({ indexers: INDEXERS })
      if (init?.method === "POST") {
        return new Promise((resolve) => {
          resolveSearch = resolve
        })
      }
      throw new Error("unexpected")
    })
    const user = userEvent.setup()
    render(<SearchClient />)
    await screen.findByText("Owned account")
    await user.click(screen.getByRole("checkbox", { name: /AlphaRatio/ }))
    await user.type(screen.getByLabelText("Search releases"), "slow")
    await user.click(screen.getByRole("button", { name: "Search selected indexers" }))
    await user.click(await screen.findByRole("button", { name: "Cancel" }))
    expect(await screen.findByText(/Search canceled in this page/)).toBeInTheDocument()
    expect(resolveSearch).toBeDefined()
    if (!resolveSearch) throw new Error("search was not started")
    resolveSearch(json(searchResponse()))
    await waitFor(() => {
      expect(screen.queryByText("Example.Release.2026.1080p")).not.toBeInTheDocument()
    })
  })
})
