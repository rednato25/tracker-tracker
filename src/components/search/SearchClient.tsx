// src/components/search/SearchClient.tsx

"use client"

import { H1, H2, Paragraph, Subtext } from "@typography"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Badge, Button, Card, Checkbox, Input, Notice } from "@/components/ui"
import { formatBytesNum, formatCount } from "@/lib/formatters"
import type {
  ProwlarrSearchIndexer,
  ProwlarrSearchRelease,
} from "@/lib/prowlarr-search"

interface SearchCoverage {
  selected: number
  responded: number
  failed: number
  failures: { indexerId: number; indexerName: string; error: string }[]
  partial: boolean
  allFailed: boolean
  hasMore: boolean
  limit: number
  offset: number
}

interface SearchResult extends ProwlarrSearchRelease {
  indexer: ProwlarrSearchIndexer | null
}

interface SearchResponse {
  generatedAt: string
  results: SearchResult[]
  coverage: SearchCoverage
}

interface LastSearch {
  query: string
  indexerIds: number[]
}

const PAGE_LIMIT = 10

function ownershipLabel(choice: ProwlarrSearchIndexer | null): string {
  if (!choice) return "Unknown indexer"
  switch (choice.ownership) {
    case "owned":
      return "Owned account"
    case "placeholder":
      return "Paused placeholder"
    case "no-account":
      return "No account"
    case "ambiguous":
      return "Ambiguous match"
    default:
      return "Unsupported indexer"
  }
}

function ownershipVariant(
  choice: ProwlarrSearchIndexer | null
): "success" | "warn" | "default" | "danger" {
  if (!choice) return "default"
  if (choice.ownership === "owned") return "success"
  if (choice.ownership === "placeholder") return "danger"
  if (choice.ownership === "ambiguous" || choice.ownership === "no-account") return "warn"
  return "default"
}

function publishedLabel(value: string | null): string {
  if (!value) return "Unknown"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return date.toLocaleString()
}

function sizeLabel(value: number | null): string {
  return value === null ? "Unknown" : formatBytesNum(value)
}

function seedersLabel(value: number | null): string {
  return value === null ? "Unknown" : formatCount(value)
}

function factorLabel(result: SearchResult): string {
  return result.downloadFactorLabel ?? "Unknown"
}

export function SearchClient() {
  const [indexers, setIndexers] = useState<ProwlarrSearchIndexer[]>([])
  const [indexerError, setIndexerError] = useState<string | null>(null)
  const [loadingIndexers, setLoadingIndexers] = useState(true)
  const [selected, setSelected] = useState<number[]>([])
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [coverage, setCoverage] = useState<SearchCoverage | null>(null)
  const [lastSearch, setLastSearch] = useState<LastSearch | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchNotice, setSearchNotice] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)

  const loadIndexers = useCallback(async () => {
    setLoadingIndexers(true)
    setIndexerError(null)
    try {
      const res = await fetch("/api/search/indexers")
      const body = (await res.json()) as { indexers?: ProwlarrSearchIndexer[]; error?: string }
      if (!res.ok) throw new Error(body.error || "Could not load Prowlarr indexers")
      setIndexers(body.indexers ?? [])
    } catch (err) {
      setIndexerError(err instanceof Error ? err.message : "Could not load Prowlarr indexers")
    } finally {
      setLoadingIndexers(false)
    }
  }, [])

  useEffect(() => {
    void loadIndexers()
  }, [loadIndexers])

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const ownAllSelected =
    indexers.length > 0 &&
    indexers.every((indexer) => selectedSet.has(indexer.indexerId))

  function toggleIndexer(indexerId: number, checked: boolean) {
    setSelected((current) =>
      checked
        ? [...new Set([...current, indexerId])]
        : current.filter((id) => id !== indexerId)
    )
  }

  function selectAll() {
    setSelected(indexers.map((indexer) => indexer.indexerId))
  }

  async function runSearch(page: number, search: LastSearch) {
    if (!search.query || search.indexerIds.length === 0) {
      setSearchError("Enter a query and select at least one indexer.")
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const requestId = ++requestIdRef.current
    setSearching(true)
    setSearchError(null)
    setSearchNotice(null)
    setResults([])
    setCoverage(null)
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: search.query,
          indexerIds: search.indexerIds,
          limit: PAGE_LIMIT,
          offset: (page - 1) * PAGE_LIMIT,
        }),
        signal: controller.signal,
      })
      if (requestId !== requestIdRef.current || controller.signal.aborted) return
      const body = (await res.json()) as SearchResponse & { error?: string }
      if (!res.ok) throw new Error(body.error || "Prowlarr search failed")
      if (requestId !== requestIdRef.current) return
      setResults(body.results ?? [])
      setCoverage(body.coverage ?? null)
      setLastSearch(search)
    } catch (err) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return
      setSearchError(err instanceof Error ? err.message : "Prowlarr search failed")
    } finally {
      if (requestId === requestIdRef.current) setSearching(false)
    }
  }

  function submitSearch(event?: React.FormEvent) {
    event?.preventDefault()
    const search = { query: query.trim(), indexerIds: selected }
    if (!search.query || search.indexerIds.length === 0) {
      setSearchError("Enter a query and select at least one indexer.")
      return
    }
    void runSearch(1, search)
  }

  function cancelSearch() {
    abortRef.current?.abort()
    requestIdRef.current++
    setSearching(false)
    setSearchNotice(
      "Search canceled in this page. Requests already dispatched to Prowlarr may still finish there."
    )
  }

  const page = coverage ? Math.floor(coverage.offset / coverage.limit) + 1 : 1
  const dirty =
    !lastSearch ||
    lastSearch.query !== query.trim() ||
    lastSearch.indexerIds.length !== selected.length ||
    lastSearch.indexerIds.some((id) => !selectedSet.has(id))

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 pt-14 md:pt-0" data-search-page>
      <div className="flex flex-col gap-1">
        <H1>Search</H1>
        <Paragraph className="max-w-3xl">
          Search releases through Prowlarr. Submitting a search contacts the selected
          indexers through Prowlarr; opening this page does not search.
        </Paragraph>
      </div>

      <Card elevation="raised" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <H2>Indexers</H2>
          <Paragraph>
            Select the indexers to query. Ownership labels show whether this application has
            a matching account; a paused placeholder is not a healthy account.
          </Paragraph>
        </div>
        {loadingIndexers ? (
          <p className="text-xs text-secondary">Loading indexers from Prowlarr…</p>
        ) : indexerError ? (
          <div className="flex flex-col gap-2">
            <Notice message={indexerError} />
            {indexerError.toLowerCase().includes("not configured") ? (
              <a className="text-xs text-accent underline underline-offset-2" href="/settings">
                Configure Prowlarr in Settings
              </a>
            ) : (
              <div>
                <Button size="sm" variant="secondary" text="Retry" onClick={() => void loadIndexers()} />
              </div>
            )}
          </div>
        ) : indexers.length === 0 ? (
          <Notice message="Prowlarr returned no indexers." />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                text={ownAllSelected ? "Clear all" : "Select all"}
                onClick={() => (ownAllSelected ? setSelected([]) : selectAll())}
              />
              <span className="text-2xs text-tertiary">{selected.length} selected</span>
            </div>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="sr-only">Search indexers</legend>
              {indexers.map((indexer) => (
                <div
                  key={indexer.indexerId}
                  className="flex items-start gap-2 border border-border bg-control-bg px-2.5 py-2"
                >
                  <Checkbox
                    checked={selectedSet.has(indexer.indexerId)}
                    onChange={(checked) => toggleIndexer(indexer.indexerId, checked)}
                  >
                    <span className="flex flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium text-primary">
                          {indexer.indexerName}
                        </span>
                        <Badge variant={ownershipVariant(indexer)}>
                          {ownershipLabel(indexer)}
                        </Badge>
                      </span>
                      {indexer.trackerSlug && (
                        <span className="text-2xs text-secondary">
                          Matched tracker: {indexer.trackerName} ({indexer.trackerSlug})
                        </span>
                      )}
                      {indexer.ownership !== "owned" && (
                        <span className="text-2xs text-tertiary">{indexer.reason}</span>
                      )}
                    </span>
                  </Checkbox>
                </div>
              ))}
            </fieldset>
          </div>
        )}
      </Card>

      <Card elevation="raised" className="flex flex-col gap-3">
        <form className="flex flex-col gap-3" onSubmit={submitSearch}>
          <Input
            label="Search releases"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Release name or search terms"
            maxLength={200}
            disabled={searching}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              text={searching ? "Searching…" : "Search selected indexers"}
              loading={searching}
              disabled={selected.length === 0}
            />
            {searching && (
              <Button size="sm" variant="secondary" text="Cancel" onClick={cancelSearch} />
            )}
            <span className="text-2xs text-tertiary">
              Explicit submission only. No grab, download or client action.
            </span>
          </div>
        </form>
        <Notice message={searchError} />
        <Notice message={searchNotice} />
      </Card>

      {coverage && (
        <section className="flex flex-col gap-3" aria-label="Search results">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-col gap-1">
              <H2>Results</H2>
              <p className="text-xs text-secondary">
                Page {page} · up to {coverage.limit} results per selected indexer · Prowlarr offset{" "}
                {coverage.offset}
              </p>
            </div>
            <Badge variant="default">
              {coverage.responded}/{coverage.selected} indexers responded
            </Badge>
          </div>

          {coverage.allFailed ? (
            <Notice
              variant="warn"
              box
              header="No indexer responded"
              message={`All ${coverage.selected} selected indexers failed. This is a failure, not an empty result. ${coverage.failures
                .map((failure) => `${failure.indexerName}: ${failure.error}`)
                .join(" · ")}`}
            />
          ) : coverage.partial ? (
            <Notice
              variant="warn"
              box
              header="Partial results"
              message={`${coverage.responded} of ${coverage.selected} indexers responded. Failed: ${coverage.failures
                .map((failure) => `${failure.indexerName} (${failure.error})`)
                .join(", ")}. The list below is incomplete.`}
            />
          ) : null}

          {results.length === 0 && !coverage.allFailed ? (
            <Notice
              variant="info"
              box
              header="No results"
              message={
                coverage.partial
                  ? "No releases came back from the responding indexers. Some selected indexers failed, so coverage is incomplete."
                  : "The selected indexers returned no releases for this query."
              }
            />
          ) : (
            <ul className="flex flex-col gap-2" data-search-results>
              {results.map((result, index) => (
                <li
                  key={`${result.indexerId}:${result.title}:${result.publishDate ?? "unknown"}:${index}`}
                  className="flex flex-col gap-2 border border-border bg-raised px-3 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 break-words font-mono text-xs text-primary">
                      {result.title}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={ownershipVariant(result.indexer)}>
                        {ownershipLabel(result.indexer)}
                      </Badge>
                      <Badge variant="default">
                        {result.indexer?.trackerName ?? result.indexerName}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-2xs text-secondary">
                    Indexer: {result.indexerName}
                    {result.indexer?.trackerSlug
                      ? ` · matched ${result.indexer.trackerName} (${result.indexer.trackerSlug})`
                      : result.indexer
                        ? ` · ${result.indexer.reason}`
                        : ""}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-tertiary">
                    <span>Size: {sizeLabel(result.sizeBytes)}</span>
                    <span>Seeders: {seedersLabel(result.seeders)}</span>
                    <span>Published: {publishedLabel(result.publishDate)}</span>
                    <span>
                      Download factor:{" "}
                      <Badge variant={result.downloadFactor === null ? "default" : "accent"}>
                        {factorLabel(result)}
                      </Badge>
                    </span>
                    {result.protocol && <span>Protocol: {result.protocol}</span>}
                  </div>
                  {result.indexer?.ownership === "placeholder" && (
                    <p className="text-2xs text-warn">
                      This indexer maps to an imported paused placeholder, not a healthy account.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              text="Previous page"
              disabled={page <= 1 || searching || dirty}
              onClick={() => {
                if (lastSearch) void runSearch(page - 1, lastSearch)
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              text="Next page"
              disabled={!coverage.hasMore || searching || dirty || coverage.offset + coverage.limit > 500}
              onClick={() => {
                if (lastSearch) void runSearch(page + 1, lastSearch)
              }}
            />
            {dirty && (
              <span className="text-2xs text-tertiary">
                Submit the edited query to page again.
              </span>
            )}
          </div>
        </section>
      )}

      <Subtext className="max-w-3xl">
        Results are not merged or treated as equivalent by name or size. Missing values stay
        unknown. This page never downloads, grabs or changes a client.
      </Subtext>
    </div>
  )
}
